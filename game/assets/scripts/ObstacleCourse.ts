import { circleHitsRect, FLIGHT } from './FlightModel';

export type LowerKind = 'mountain' | 'pillar' | 'fireball';
export type UpperKind = 'cloud' | 'lightning' | 'wheel';
export const LOWER_KINDS: readonly LowerKind[] = ['mountain', 'pillar', 'fireball'];
export const UPPER_KINDS: readonly UpperKind[] = ['cloud', 'lightning', 'wheel'];
export const LIGHTNING = {
  warningDistance: 400,
  strikeDistance: 160,
  boltWidthRatio: 0.46,
  cloudRadiusRatio: 0.45,
} as const;
export type LightningPhase = 'dormant' | 'warning' | 'strike';

export interface ObstaclePair {
  x: number;
  width: number;
  center: number;
  gap: number;
  lower: LowerKind;
  upper: UpperKind;
  amplitude: number;
  phase: number;
  age: number;
  scored: boolean;
  serial: number;
}

export interface CourseDifficulty {
  speed: number;
  gap: number;
  spacing: number;
  amplitude: number;
}

export interface CourseStep {
  hit: boolean;
  gained: number;
}

/** Pure gameplay data. Graphics nodes are pooled separately by GameDirector. */
export class ObstacleCourse {
  readonly active: ObstaclePair[] = [];
  readonly pool: ObstaclePair[] = [];
  score = 0;
  generated = 0;
  private previousCenter = 0;
  private previousCombination = '';

  constructor(
    readonly width: number,
    readonly height: number,
    readonly playerX: number,
    private readonly random: () => number = Math.random,
  ) {}

  get difficulty(): CourseDifficulty {
    const level = Math.min(1, Math.max(0, (this.score - 3) / 24));
    const available = Math.max(0, this.height - 48);
    return {
      speed: 220 + 100 * level,
      gap: Math.min(available - 96, Math.max(FLIGHT.radius * 2 + 100, 400 - 65 * level)),
      spacing: 480 - 60 * level,
      amplitude: 10 + 12 * level,
    };
  }

  reset(): void {
    while (this.active.length) this.pool.push(this.active.pop()!);
    this.score = 0;
    this.generated = 0;
    this.previousCenter = 0;
    this.previousCombination = '';
    this.fillAhead();
  }

  /** Move, collide, score, then recycle. The player can never score on a fatal step. */
  step(dt: number, playerY: number): CourseStep {
    const speed = this.difficulty.speed;
    for (const pair of this.active) {
      pair.x -= speed * dt;
      pair.age += dt;
      if (this.hits(pair, playerY)) return { hit: true, gained: 0 };
    }
    let gained = 0;
    for (const pair of this.active) {
      if (!pair.scored && pair.x + pair.width / 2 < this.playerX) {
        pair.scored = true;
        gained++;
      }
    }
    this.score += gained;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const pair = this.active[i];
      if (pair.x + pair.width / 2 < -this.width / 2) {
        this.pool.push(pair);
        this.active.splice(i, 1);
      }
    }
    this.fillAhead();
    return { hit: false, gained };
  }

  /** Visible opening is guaranteed even at each dynamic hazard's motion extreme. */
  private hits(pair: ObstaclePair, playerY: number): boolean {
    const gapBottom = pair.center - pair.gap / 2;
    const gapTop = pair.center + pair.gap / 2;
    const left = pair.x - pair.width / 2;
    const halfHeight = this.height / 2 - 24;
    if (pair.lower === 'fireball') {
      const radius = pair.width * 0.4;
      const y = fireballY(pair);
      if (circleHitsCircle(this.playerX, playerY, FLIGHT.radius, pair.x, y, radius)) return true;
    } else if (pair.lower === 'mountain') {
      const lowerHeight = gapBottom + halfHeight;
      const tipHeight = Math.min(lowerHeight, pair.width * 1.65);
      const shaftTop = -halfHeight + Math.max(0, lowerHeight - tipHeight + 16);
      if (circleHitsRect(this.playerX, playerY, FLIGHT.radius,
        left, -halfHeight, pair.width, shaftTop + halfHeight)
        || circleHitsTriangle(this.playerX, playerY, FLIGHT.radius,
          pair.x, gapBottom, left, shaftTop, left + pair.width, shaftTop)) return true;
    } else if (circleHitsRect(this.playerX, playerY, FLIGHT.radius,
      left, -halfHeight, pair.width, gapBottom + halfHeight)) return true;

    if (pair.upper === 'wheel') {
      const radius = pair.width * 0.43;
      const y = wheelY(pair);
      return circleHitsCircle(this.playerX, playerY, FLIGHT.radius, pair.x, y, radius);
    }
    if (pair.upper === 'lightning') {
      const radius = pair.width * LIGHTNING.cloudRadiusRatio;
      if (circleHitsCircle(this.playerX, playerY, FLIGHT.radius,
        pair.x, lightningCloudY(pair), radius)) return true;
      if (lightningPhase(pair, this.playerX) !== 'strike') return false;
      return circleHitsRect(this.playerX, playerY, FLIGHT.radius,
        pair.x - pair.width * LIGHTNING.boltWidthRatio / 2, gapTop,
        pair.width * LIGHTNING.boltWidthRatio, lightningCloudY(pair) - gapTop);
    }
    return circleHitsRect(this.playerX, playerY, FLIGHT.radius,
      left, gapTop, pair.width, halfHeight - gapTop);
  }

  private fillAhead(): void {
    const right = this.width / 2;
    let lastX = this.active.length ? Math.max(...this.active.map(pair => pair.x)) : right + 180;
    if (!this.active.length) {
      this.spawn(lastX);
    }
    while (lastX < right + this.difficulty.spacing * 2) {
      lastX += this.difficulty.spacing;
      this.spawn(lastX);
    }
  }

  private spawn(x: number): void {
    const difficulty = this.difficulty;
    const opening = difficulty.gap;
    const half = this.height / 2 - 24;
    let index = Math.floor(this.unitRandom() * 9);
    if (`${LOWER_KINDS[Math.floor(index / 3)]}+${UPPER_KINDS[index % 3]}`
      === this.previousCombination) index = (index + 1 + Math.floor(this.unitRandom() * 8)) % 9;
    const lower = LOWER_KINDS[Math.floor(index / 3)];
    const upper = UPPER_KINDS[index % 3];
    const combination = `${lower}+${upper}`;
    const minCenter = -half + opening / 2 + 48;
    // A storm cloud needs enough visible sky for its warning lane and body.
    const upperRoom = upper === 'lightning'
      ? Math.min(170, Math.max(48, 2 * half - opening - 48)) : 48;
    const maxCenter = half - opening / 2 - upperRoom;
    const minReach = this.generated ? Math.max(minCenter, this.previousCenter - 180) : minCenter;
    const maxReach = this.generated ? Math.min(maxCenter, this.previousCenter + 180) : maxCenter;
    const center = minReach + (maxReach - minReach) * this.unitRandom();
    const pair = this.pool.pop() || {} as ObstaclePair;
    pair.x = x;
    pair.width = 82 + 28 * this.unitRandom();
    pair.center = center;
    pair.gap = opening;
    pair.lower = lower;
    pair.upper = upper;
    pair.amplitude = difficulty.amplitude;
    pair.phase = this.unitRandom() * Math.PI * 2;
    pair.age = 0;
    pair.scored = false;
    pair.serial = this.generated++;
    this.previousCenter = center;
    this.previousCombination = combination;
    this.active.push(pair);
  }

  private unitRandom(): number {
    return Math.max(0, Math.min(0.999999, this.random()));
  }
}

export function circleHitsCircle(ax: number, ay: number, ar: number,
  bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= (ar + br) * (ar + br);
}

/** A forgiving triangular cap follows the painted mountain instead of a hidden rectangle. */
export function circleHitsTriangle(cx: number, cy: number, radius: number,
  ax: number, ay: number, bx: number, by: number, dx: number, dy: number): boolean {
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const s1 = cross(ax, ay, bx, by, cx, cy);
  const s2 = cross(bx, by, dx, dy, cx, cy);
  const s3 = cross(dx, dy, ax, ay, cx, cy);
  if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return true;
  const edgeDistanceSquared = (px: number, py: number, qx: number, qy: number) => {
    const vx = qx - px, vy = qy - py;
    const t = Math.max(0, Math.min(1, ((cx - px) * vx + (cy - py) * vy) / (vx * vx + vy * vy)));
    const ex = cx - (px + vx * t), ey = cy - (py + vy * t);
    return ex * ex + ey * ey;
  };
  return edgeDistanceSquared(ax, ay, bx, by) <= radius * radius
    || edgeDistanceSquared(bx, by, dx, dy) <= radius * radius
    || edgeDistanceSquared(dx, dy, ax, ay) <= radius * radius;
}

export function fireballY(pair: ObstaclePair): number {
  const radius = pair.width * 0.4;
  return pair.center - pair.gap / 2 - radius - pair.amplitude
    + Math.sin(pair.age * 2.2 + pair.phase) * pair.amplitude;
}

export function wheelY(pair: ObstaclePair): number {
  const radius = pair.width * 0.43;
  return pair.center + pair.gap / 2 + radius + pair.amplitude
    + Math.sin(pair.age * 2.6 + pair.phase) * pair.amplitude;
}

export function wheelAngle(pair: ObstaclePair): number {
  return (pair.age * 120) % 360;
}

export function lightningCloudY(pair: ObstaclePair): number {
  return pair.center + pair.gap / 2 + pair.width * LIGHTNING.cloudRadiusRatio + 50;
}

/** Distance-driven states ensure the bolt is warned before it can reach the player. */
export function lightningPhase(pair: ObstaclePair, playerX: number): LightningPhase {
  const distance = pair.x - playerX;
  if (distance > LIGHTNING.warningDistance) return 'dormant';
  return distance > LIGHTNING.strikeDistance ? 'warning' : 'strike';
}
