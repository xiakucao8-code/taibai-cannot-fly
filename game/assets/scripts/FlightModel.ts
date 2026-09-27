/** Stage 1 tuning values, in design units and seconds. */
export const FLIGHT = {
  gravity: 1500,
  thrust: 2000,
  tapRiseSpeed: 260,
  maxRiseSpeed: 520,
  maxFallSpeed: 620,
  radius: 30,
  step: 1 / 120,
  maxFrameTime: 0.1,
} as const;

export type Phase = 'ready' | 'playing' | 'dead';

export class FlightModel {
  phase: Phase = 'ready';
  y = 0;
  velocity = 0;
  angle = 0;
  held = false;

  reset(): void {
    this.phase = 'ready';
    this.y = this.velocity = this.angle = 0;
    this.held = false;
  }

  start(): void {
    if (this.phase === 'ready') this.phase = 'playing';
  }

  /** Each press produces immediate lift; holding then continues to accelerate. */
  press(): void {
    if (this.phase !== 'playing') return;
    this.velocity = Math.min(FLIGHT.maxRiseSpeed,
      Math.max(this.velocity, FLIGHT.tapRiseSpeed));
    this.held = true;
  }

  step(dt: number): void {
    if (this.phase !== 'playing') return;
    const acceleration = (this.held ? FLIGHT.thrust : 0) - FLIGHT.gravity;
    this.velocity = Math.max(-FLIGHT.maxFallSpeed,
      Math.min(FLIGHT.maxRiseSpeed, this.velocity + acceleration * dt));
    this.y += this.velocity * dt;
    const target = this.velocity >= 0
      ? this.velocity / FLIGHT.maxRiseSpeed * 25
      : this.velocity / FLIGHT.maxFallSpeed * 40;
    this.angle += (target - this.angle) * (1 - Math.exp(-9 * dt));
  }

  die(): void {
    this.phase = 'dead';
    this.held = false;
    this.velocity = 0;
  }
}

export function circleHitsRect(cx: number, cy: number, radius: number,
  left: number, bottom: number, width: number, height: number): boolean {
  const dx = cx - Math.max(left, Math.min(left + width, cx));
  const dy = cy - Math.max(bottom, Math.min(bottom + height, cy));
  return dx * dx + dy * dy <= radius * radius;
}
