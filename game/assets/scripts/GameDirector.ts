import {
  _decorator, Component, Node, UITransform, Graphics, Color, Label,
  Layers, input, Input, EventTouch, game, Game, view, profiler, UIOpacity,
  Sprite, SpriteFrame, resources, HorizontalTextAlignment,
} from 'cc';
import { FlightModel, FLIGHT } from './FlightModel';
import {
  ObstacleCourse, ObstaclePair, LIGHTNING, fireballY, wheelY, wheelAngle,
  lightningCloudY, lightningPhase,
} from './ObstacleCourse';

const { ccclass } = _decorator;
type ArtKey = 'sky' | 'far' | 'mid' | 'bank' | 'idle' | 'rise' | 'fall' | 'hit'
  | 'mountain' | 'mountainBase' | 'pillar' | 'fireball' | 'cloud' | 'lightning' | 'wheel'
  | 'title' | 'panel' | 'button' | 'hold';
const ART: Record<ArtKey, string> = {
  sky: 'backgrounds/sky', far: 'backgrounds/far_islands', mid: 'backgrounds/mid_palace',
  bank: 'backgrounds/cloud_bank', idle: 'characters/taibai_idle',
  rise: 'characters/taibai_rise', fall: 'characters/taibai_fall', hit: 'characters/taibai_hit',
  mountain: 'obstacles/mountain', mountainBase: 'obstacles/mountain_base',
  pillar: 'obstacles/stone_pillar',
  fireball: 'obstacles/fireball', cloud: 'obstacles/storm_cloud',
  lightning: 'obstacles/lightning', wheel: 'obstacles/wind_fire_wheel',
  title: 'ui/title', panel: 'ui/results_panel', button: 'ui/primary_button',
  hold: 'ui/hold_hint',
};
const CREAM = new Color(255, 247, 222);
const INK = new Color(48, 65, 75);

type PairVisual = {
  root: Node;
  lower: Node;
  upper: Node;
  lowerSprite: Sprite;
  lowerBaseSprite: Sprite;
  upperSprite: Sprite;
  lowerBase: Graphics;
  upperBase: Graphics;
  cloudAura: Graphics;
  cloudStack: Sprite[];
  warning: Node;
  strike: Node;
  strikeSprite: Sprite;
  warningInk: Graphics;
  strikeInk: Graphics;
  warningOpacity: UIOpacity;
  strikeOpacity: UIOpacity;
};
type Burst = { node: Node; ink: Graphics; age: number; duration: number; x: number; y: number; kind: 'lift' | 'score' | 'hit' };

/** Stage 4 presentation over the existing fixed-step, pooled gameplay model. */
@ccclass('GameDirector')
export class GameDirector extends Component {
  private flight = new FlightModel();
  private course!: ObstacleCourse;
  private width = 720;
  private height = 1280;
  private playerX = -160;
  private accumulator = 0;
  private idleTime = 0;
  private elapsed = 0;
  private deathTime = 0;
  private touchId: number | null = null;
  private suspended = false;
  private layoutRoot!: Node;
  private scenery!: Node;
  private far!: Node;
  private mid!: Node;
  private bank!: Node;
  private obstacleLayer!: Node;
  private player!: Node;
  private heroSprite!: Sprite;
  private heroFallback!: Graphics;
  private title!: Node;
  private readyHint!: Node;
  private result!: Node;
  private resultScore!: Label;
  private scoreLabel!: Label;
  private scoreBadge!: Node;
  private flash!: Node;
  private visuals = new Map<number, PairVisual>();
  private visualPool: PairVisual[] = [];
  private bursts: Burst[] = [];
  private frames = new Map<ArtKey, SpriteFrame>();
  public assetsReady = false;
  public assetErrors: string[] = [];

  onLoad(): void {
    profiler.hideStats();
    this.buildView();
    input.on(Input.EventType.TOUCH_START, this.onPress, this);
    input.on(Input.EventType.TOUCH_END, this.onRelease, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onRelease, this);
    // @ts-expect-error InputEventMap omits the Cocos 3.8.8 mouse-leave event.
    input.on(Input.EventType.MOUSE_LEAVE, this.clearInput, this);
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    view.on('canvas-resize', this.onResize, this);
    this.resetRound();
    this.loadArt();
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onPress, this);
    input.off(Input.EventType.TOUCH_END, this.onRelease, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onRelease, this);
    // @ts-expect-error Same InputEventMap omission as the listener above.
    input.off(Input.EventType.MOUSE_LEAVE, this.clearInput, this);
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    view.off('canvas-resize', this.onResize, this);
  }

  private loadArt(): void {
    const keys = Object.keys(ART) as ArtKey[];
    let remaining = keys.length;
    for (const key of keys) {
      resources.load(`stage4/${ART[key]}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (!this.node.isValid) return;
        if (error || !frame) this.assetErrors.push(`${key}: ${error?.message || 'missing sprite frame'}`);
        else this.frames.set(key, frame);
        if (--remaining === 0) {
          this.assetsReady = true;
          this.applyArt();
        }
      });
    }
  }

  private applyArt(): void {
    const background = this.scenery.getChildByName('Sky')!.getComponent(Sprite)!;
    this.useFrame(background, 'sky');
    this.useFrame(this.far.getComponent(Sprite)!, 'far');
    this.useFrame(this.mid.getComponent(Sprite)!, 'mid');
    this.useFrame(this.bank.getComponent(Sprite)!, 'bank');
    this.useFrame(this.title.getComponent(Sprite)!, 'title');
    this.useFrame(this.readyHint.getChildByName('HoldIcon')!.getComponent(Sprite)!, 'hold');
    this.useFrame(this.result.getChildByName('Panel')!.getComponent(Sprite)!, 'panel');
    this.useFrame(this.result.getChildByName('RestartButton')!.getComponent(Sprite)!, 'button');
    this.heroFallback.enabled = !this.frames.has('idle');
    this.updateHeroArt();
    for (const pair of this.course.active) {
      const visual = this.visuals.get(pair.serial);
      if (visual) this.paintPair(visual, pair);
    }
    if (this.assetErrors.length) console.warn('[Stage4] Some sprites failed to load', this.assetErrors);
  }

  update(dt: number): void {
    if (this.suspended) return;
    const step = Math.min(dt, FLIGHT.maxFrameTime);
    this.elapsed += step;
    this.updateScenery();
    this.updateBursts(step);
    if (this.flight.phase === 'ready') {
      this.idleTime += step;
      this.player.setPosition(this.playerX, Math.sin(this.idleTime * 2.5) * 9);
      this.heroSprite.node.setScale(1 + Math.sin(this.idleTime * 3.2) * 0.025,
        1 - Math.sin(this.idleTime * 3.2) * 0.025, 1);
      return;
    }
    if (this.flight.phase !== 'playing') return;
    this.accumulator += step;
    while (this.accumulator >= FLIGHT.step && this.flight.phase === 'playing') {
      this.accumulator -= FLIGHT.step;
      this.simulate(FLIGHT.step);
    }
    this.player.setPosition(this.playerX, this.flight.y);
    this.player.angle = this.flight.angle;
    const flutter = Math.sin(this.elapsed * (this.flight.held ? 13 : 9)) * 0.025;
    this.heroSprite.node.setScale(1 + flutter, 1 - flutter * 0.6, 1);
    this.updateHeroArt();
  }

  private simulate(dt: number): void {
    this.flight.step(dt);
    const bottom = -this.height / 2 + 24;
    const top = this.height / 2 - 24;
    if (this.flight.y - FLIGHT.radius <= bottom || this.flight.y + FLIGHT.radius >= top) {
      this.flight.y = Math.max(bottom + FLIGHT.radius, Math.min(top - FLIGHT.radius, this.flight.y));
      this.endRound();
      return;
    }
    const result = this.course.step(dt, this.flight.y);
    if (result.hit) { this.endRound(); return; }
    if (result.gained) {
      this.scoreLabel.string = `${this.course.score}`;
      this.spawnBurst(this.playerX + 65, this.flight.y + 45, 'score');
    }
    this.syncVisuals();
  }

  private onPress(event: EventTouch): void {
    if (this.suspended || this.touchId !== null) return;
    this.touchId = event.getID();
    if (this.flight.phase === 'dead') {
      if (this.elapsed - this.deathTime >= 0.3) this.resetRound();
      return;
    }
    if (this.flight.phase === 'ready') {
      this.flight.y = this.player.position.y;
      this.flight.start();
      this.title.active = false;
      this.readyHint.active = false;
      this.scoreBadge.active = true;
    }
    this.flight.press();
    this.spawnBurst(this.playerX - 48, this.flight.y - 28, 'lift');
  }

  private onRelease(event: EventTouch): void {
    if (event.getID() === this.touchId) this.clearInput();
  }
  private clearInput(): void { this.touchId = null; this.flight.held = false; }
  private onHide(): void { this.clearInput(); this.accumulator = 0; this.suspended = true; }
  private onShow(): void { this.clearInput(); this.accumulator = 0; this.suspended = false; }

  private onResize(): void {
    this.layoutRoot.destroy();
    this.visuals.clear();
    this.visualPool.length = 0;
    this.bursts.length = 0;
    this.buildView();
    this.resetRound();
    if (this.assetsReady) this.applyArt();
  }

  private endRound(): void {
    this.flight.die();
    this.clearInput();
    this.accumulator = 0;
    this.deathTime = this.elapsed;
    this.resultScore.string = `本局得分  ${this.course.score}`;
    this.result.active = true;
    this.scoreBadge.active = false;
    this.updateHeroArt();
    this.spawnBurst(this.playerX, this.flight.y, 'hit');
    this.flash.active = true;
  }

  private resetRound(): void {
    this.flight.reset();
    this.clearInput();
    this.accumulator = 0;
    this.idleTime = 0;
    this.player.setPosition(this.playerX, 0);
    this.player.angle = 0;
    this.heroSprite.node.setScale(1, 1, 1);
    this.title.active = true;
    this.readyHint.active = true;
    this.result.active = false;
    this.scoreBadge.active = false;
    this.scoreLabel.string = '0';
    this.flash.active = false;
    for (const visual of this.visuals.values()) { visual.root.active = false; this.visualPool.push(visual); }
    this.visuals.clear();
    for (const burst of this.bursts) burst.node.destroy();
    this.bursts.length = 0;
    this.course.reset();
    this.syncVisuals();
    this.updateHeroArt();
  }

  private makeNode(name: string, parent: Node, width = 1, height = 1): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.addComponent(UITransform).setContentSize(width, height);
    return node;
  }

  private spriteNode(name: string, parent: Node, width: number, height: number): Sprite {
    const node = this.makeNode(name, parent, width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    return sprite;
  }

  private useFrame(sprite: Sprite, key: ArtKey): void {
    const frame = this.frames.get(key);
    if (frame) sprite.spriteFrame = frame;
  }

  private label(name: string, parent: Node, value: string, width: number, height: number,
    size: number, color = CREAM): Label {
    const node = this.makeNode(name, parent, width, height);
    const label = node.addComponent(Label);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = size * 1.35;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.color = color;
    label.overflow = Label.Overflow.SHRINK;
    return label;
  }

  private buildView(): void {
    const visible = view.getVisibleSize();
    this.width = visible.width;
    this.height = visible.height;
    this.playerX = -this.width * 0.23;
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    this.layoutRoot = this.makeNode('Stage4Root', this.node, this.width, this.height);
    this.scenery = this.makeNode('Scenery', this.layoutRoot);
    const skyHeight = Math.max(this.height, this.width * 1.5);
    const underpaint = this.makeNode('SkyFallback', this.scenery).addComponent(Graphics);
    underpaint.fillColor = new Color(102, 172, 217);
    underpaint.fillRect(-this.width, -this.height, this.width * 2, this.height * 2);
    this.spriteNode('Sky', this.scenery, skyHeight * 2 / 3, skyHeight);
    this.far = this.spriteNode('FarIslands', this.scenery, Math.max(this.width * 1.12, 700),
      Math.max(this.width * 1.12, 700) * 0.612).node;
    this.mid = this.spriteNode('MidPalace', this.scenery, Math.max(this.width * 1.16, 730),
      Math.max(this.width * 1.16, 730) * 0.64).node;
    this.bank = this.spriteNode('CloudBank', this.scenery, Math.max(this.width * 1.12, 720),
      Math.max(this.width * 1.12, 720) * 0.30).node;
    this.far.setPosition(0, -halfH + this.height * 0.30);
    this.mid.setPosition(this.width * 0.12, -halfH + this.height * 0.13);
    this.bank.setPosition(0, -halfH + 34);
    this.far.addComponent(UIOpacity).opacity = 160;
    this.mid.addComponent(UIOpacity).opacity = 204;
    this.bank.addComponent(UIOpacity).opacity = 208;
    this.course = new ObstacleCourse(this.width, this.height, this.playerX);
    this.obstacleLayer = this.makeNode('ObstacleLayer', this.layoutRoot);
    this.player = this.makeNode('Taibai', this.layoutRoot, 110, 84);
    this.heroSprite = this.spriteNode('TaibaiPose', this.player, 124, 77);
    this.heroFallback = this.player.addComponent(Graphics);
    this.heroFallback.fillColor = new Color(255, 243, 211);
    this.heroFallback.ellipse(0, 0, 42, 31);
    this.heroFallback.fill();
    const hud = this.makeNode('HUD', this.layoutRoot);
    this.scoreBadge = this.makeNode('ScoreBadge', hud, 116, 74);
    this.scoreBadge.setPosition(-halfW + 89, halfH - 80);
    const badgeInk = this.scoreBadge.addComponent(Graphics);
    badgeInk.fillColor = new Color(41, 67, 83, 180);
    badgeInk.roundRect(-55, -31, 110, 62, 22); badgeInk.fill();
    badgeInk.strokeColor = new Color(255, 235, 184, 220);
    badgeInk.lineWidth = 3; badgeInk.roundRect(-55, -31, 110, 62, 22); badgeInk.stroke();
    this.scoreLabel = this.label('Score', this.scoreBadge, '0', 100, 62, 38);
    this.title = this.spriteNode('Title', hud, Math.min(this.width - 44, 560),
      Math.min(this.width - 44, 560) * 0.53).node;
    this.title.setPosition(0, halfH - Math.min(280, this.height * 0.23));
    this.readyHint = this.makeNode('ReadyHint', hud, Math.min(this.width - 32, 550), 122);
    this.readyHint.setPosition(0, -halfH + 124);
    const hintBack = this.readyHint.addComponent(Graphics);
    hintBack.fillColor = new Color(40, 67, 81, 183);
    hintBack.roundRect(-this.readyHint.getComponent(UITransform)!.width / 2, -58,
      this.readyHint.getComponent(UITransform)!.width, 116, 25); hintBack.fill();
    this.spriteNode('HoldIcon', this.readyHint, 62, 62).node.setPosition(-this.readyHint.getComponent(UITransform)!.width / 2 + 51, 0);
    const hintText = this.label('HintText', this.readyHint,
      '点击抬升 · 长按持续上升\n松手下落，穿过云间通道',
      Math.min(this.width - 126, 430), 110, 22);
    hintText.node.setPosition(26, 0);
    this.result = this.makeNode('ResultOverlay', hud, this.width, this.height);
    const veil = this.makeNode('Veil', this.result, this.width, this.height).addComponent(Graphics);
    veil.fillColor = new Color(23, 43, 60, 154);
    veil.fillRect(-halfW, -halfH, this.width, this.height);
    const panelW = Math.min(this.width - 32, 535);
    this.spriteNode('Panel', this.result, panelW, panelW * 0.623).node.setPosition(0, 85);
    const resultTitle = this.label('ResultTitle', this.result, '飞行结束', panelW * 0.72, 70, 37, INK);
    resultTitle.node.setPosition(0, 108);
    this.resultScore = this.label('ResultScore', this.result, '本局得分  0', panelW * 0.72, 62, 29, INK);
    this.resultScore.node.setPosition(0, 35);
    const buttonW = Math.min(this.width * 0.52, 280);
    this.spriteNode('RestartButton', this.result, buttonW, buttonW * 0.2475).node.setPosition(0, -105);
    this.label('RestartText', this.result, '再来一次', buttonW - 22, 55, 27, INK).node.setPosition(0, -105);
    this.label('RestartHint', this.result, '轻点屏幕重新开始', this.width - 40, 50, 21).node.setPosition(0, -halfH + 100);
    const flashNode = this.makeNode('HitFlash', hud, this.width, this.height);
    const flashInk = flashNode.addComponent(Graphics);
    flashInk.fillColor = new Color(255, 245, 208, 85);
    flashInk.fillRect(-halfW, -halfH, this.width, this.height);
    this.flash = flashNode;
    this.flash.active = false;
  }

  private updateScenery(): void {
    const halfH = this.height / 2;
    this.far.setPosition(Math.sin(this.elapsed * 0.12) * 18, -halfH + this.height * 0.30);
    this.mid.setPosition(this.width * 0.12 + Math.sin(this.elapsed * 0.19) * 29,
      -halfH + this.height * 0.13);
    this.bank.setPosition(Math.sin(this.elapsed * 0.28) * 34, -halfH + 34);
    if (this.flash.active && this.elapsed - this.deathTime > 0.12) this.flash.active = false;
  }

  private updateHeroArt(): void {
    const key: ArtKey = this.flight.phase === 'dead' ? 'hit'
      : this.flight.phase === 'ready' ? 'idle'
      : this.flight.velocity > 55 ? 'rise' : this.flight.velocity < -70 ? 'fall' : 'idle';
    this.useFrame(this.heroSprite, key);
  }

  private syncVisuals(): void {
    for (const [serial, visual] of this.visuals) {
      if (!this.course.active.some(pair => pair.serial === serial)) {
        visual.root.active = false;
        this.visualPool.push(visual);
        this.visuals.delete(serial);
      }
    }
    for (const pair of this.course.active) {
      let visual = this.visuals.get(pair.serial);
      if (!visual) {
        visual = this.visualPool.pop() || this.makePairVisual();
        visual.root.active = true;
        visual.root.name = `Pair-${pair.serial}-${pair.lower}-${pair.upper}`;
        this.paintPair(visual, pair);
        this.visuals.set(pair.serial, visual);
      }
      visual.root.setPosition(pair.x, 0);
      if (pair.lower === 'fireball') visual.lower.setPosition(0, fireballY(pair));
      if (pair.upper === 'wheel') {
        visual.upper.setPosition(0, wheelY(pair));
        visual.upper.angle = wheelAngle(pair);
      } else if (pair.upper === 'lightning') {
        const phase = lightningPhase(pair, this.playerX);
        visual.warning.active = phase === 'warning';
        visual.strike.active = phase === 'strike';
        visual.warningOpacity.opacity = 165 + 60 * Math.abs(Math.sin(pair.age * 9));
        visual.strikeOpacity.opacity = 225 + 30 * Math.abs(Math.sin(pair.age * 18));
      }
    }
  }

  private makePairVisual(): PairVisual {
    const root = this.makeNode('ObstaclePair', this.obstacleLayer);
    const lower = this.makeNode('LowerHazard', root);
    const upper = this.makeNode('UpperHazard', root);
    const lowerBase = lower.addComponent(Graphics);
    const upperBase = upper.addComponent(Graphics);
    const cloudAura = upperBase;
    const lowerBaseSprite = this.spriteNode('LowerBaseArt', lower, 1, 1);
    const lowerSprite = this.spriteNode('LowerArt', lower, 1, 1);
    const upperSprite = this.spriteNode('UpperArt', upper, 1, 1);
    const warning = this.makeNode('LightningWarning', upper);
    const warningInk = warning.addComponent(Graphics);
    const warningOpacity = warning.addComponent(UIOpacity);
    const strike = this.makeNode('LightningStrike', upper);
    const strikeInk = strike.addComponent(Graphics);
    const strikeSprite = this.spriteNode('BoltArt', strike, 1, 1);
    const strikeOpacity = strike.addComponent(UIOpacity);
    const cloudStack: Sprite[] = [];
    return { root, lower, upper, lowerSprite, lowerBaseSprite, upperSprite, lowerBase, upperBase,
      cloudAura, cloudStack, warning, strike, strikeSprite, warningInk, strikeInk,
      warningOpacity, strikeOpacity };
  }

  private sizeSprite(sprite: Sprite, width: number, height: number, x = 0, y = 0): void {
    sprite.node.getComponent(UITransform)!.setContentSize(width, height);
    sprite.node.setPosition(x, y);
  }

  private paintPair(v: PairVisual, pair: ObstaclePair): void {
    v.lowerBase.clear(); v.upperBase.clear(); v.cloudAura.clear();
    v.warningInk.clear(); v.strikeInk.clear();
    v.lower.setPosition(0, 0); v.upper.setPosition(0, 0); v.upper.angle = 0;
    v.warning.active = false; v.strike.active = false;
    v.lowerBaseSprite.node.active = false;
    for (const cloud of v.cloudStack) cloud.node.active = false;
    const w = pair.width;
    const bottom = -this.height / 2 + 24;
    const top = this.height / 2 - 24;
    const gapBottom = pair.center - pair.gap / 2;
    const gapTop = pair.center + pair.gap / 2;
    const lowerHeight = gapBottom - bottom;
    const upperHeight = top - gapTop;
    if (pair.lower === 'fireball') {
      this.useFrame(v.lowerSprite, 'fireball');
      this.sizeSprite(v.lowerSprite, w * 0.8, w * 0.87);
      v.lowerBase.fillColor = new Color(247, 151, 65, 100);
      v.lowerBase.circle(0, 0, w * 0.4); v.lowerBase.fill();
    } else {
      const isMountain = pair.lower === 'mountain';
      this.useFrame(v.lowerSprite, isMountain ? 'mountain' : 'pillar');
      if (isMountain) {
        const tipHeight = Math.min(lowerHeight, w * 1.65);
        const shaftHeight = Math.max(0, lowerHeight - tipHeight + 16);
        v.lowerBaseSprite.node.active = shaftHeight > 0;
        this.useFrame(v.lowerBaseSprite, 'mountainBase');
        this.sizeSprite(v.lowerBaseSprite, w, shaftHeight, 0, bottom + shaftHeight / 2);
        this.sizeSprite(v.lowerSprite, w, tipHeight, 0, gapBottom - tipHeight / 2);
      } else {
        this.sizeSprite(v.lowerSprite, w, lowerHeight, 0, bottom + lowerHeight / 2);
      }
      if (!this.frames.has(isMountain ? 'mountain' : 'pillar')) {
        v.lowerBase.fillColor = isMountain ? new Color(73, 111, 106) : new Color(126, 125, 117);
        v.lowerBase.fillRect(-w / 2, bottom, w, lowerHeight);
      }
    }
    if (pair.upper === 'wheel') {
      this.useFrame(v.upperSprite, 'wheel');
      this.sizeSprite(v.upperSprite, w * 0.86, w * 0.87);
      v.upperBase.fillColor = new Color(203, 100, 62, 90);
      v.upperBase.circle(0, 0, w * 0.43); v.upperBase.fill();
    } else if (pair.upper === 'cloud') {
      this.useFrame(v.upperSprite, 'cloud');
      const imageH = w * 0.5;
      this.sizeSprite(v.upperSprite, w, imageH, 0, gapTop + imageH / 2);
      const stride = imageH * 0.38;
      const count = Math.ceil(Math.max(0, upperHeight - imageH) / stride);
      for (let i = 0; i < count; i++) {
        const cloud = v.cloudStack[i] || this.spriteNode(`CloudLayer-${i}`, v.upper, w, imageH);
        if (!v.cloudStack[i]) v.cloudStack.push(cloud);
        cloud.node.active = true;
        this.useFrame(cloud, 'cloud');
        const y = Math.min(top - imageH / 2, gapTop + imageH / 2 + (i + 1) * stride);
        this.sizeSprite(cloud, w * (i % 3 === 0 ? 1.18 : 1.04), imageH,
          ((i * 17) % 3 - 1) * w * 0.07, y);
        cloud.node.angle = i % 2 ? 5 : -5;
      }
      if (!this.frames.has('cloud')) {
        v.upperBase.fillColor = new Color(81, 92, 112, 228);
        v.upperBase.fillRect(-w / 2, gapTop, w, upperHeight);
      }
    } else {
      const cloudY = lightningCloudY(pair);
      const radius = w * LIGHTNING.cloudRadiusRatio;
      this.useFrame(v.upperSprite, 'cloud');
      this.sizeSprite(v.upperSprite, w * 0.9, w * 0.45, 0, cloudY);
      v.cloudAura.fillColor = new Color(70, 78, 105, 72);
      v.cloudAura.circle(0, cloudY, radius); v.cloudAura.fill();
      v.cloudAura.strokeColor = new Color(128, 140, 164, 180);
      v.cloudAura.lineWidth = 2; v.cloudAura.circle(0, cloudY, radius); v.cloudAura.stroke();
      const boltWidth = w * LIGHTNING.boltWidthRatio;
      const boltHeight = cloudY - gapTop;
      v.warningInk.fillColor = new Color(255, 213, 112, 58);
      v.warningInk.fillRect(-boltWidth / 2, gapTop, boltWidth, boltHeight);
      v.warningInk.strokeColor = new Color(255, 235, 155, 230);
      v.warningInk.lineWidth = 3;
      v.warningInk.rect(-boltWidth / 2, gapTop, boltWidth, boltHeight);
      v.warningInk.stroke();
      v.strikeInk.fillColor = new Color(255, 220, 111, 105);
      v.strikeInk.fillRect(-boltWidth / 2, gapTop, boltWidth, boltHeight);
      this.useFrame(v.strikeSprite, 'lightning');
      this.sizeSprite(v.strikeSprite, boltWidth, boltHeight, 0, gapTop + boltHeight / 2);
    }
  }

  private spawnBurst(x: number, y: number, kind: Burst['kind']): void {
    const node = this.makeNode(`VFX-${kind}`, this.layoutRoot);
    node.setPosition(x, y);
    const ink = node.addComponent(Graphics);
    this.bursts.push({ node, ink, age: 0, duration: kind === 'hit' ? 0.55 : 0.42, x, y, kind });
  }

  private updateBursts(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.age += dt;
      if (burst.age >= burst.duration) { burst.node.destroy(); this.bursts.splice(i, 1); continue; }
      const t = burst.age / burst.duration;
      burst.ink.clear();
      const rays = burst.kind === 'hit' ? 9 : 5;
      const spread = burst.kind === 'hit' ? 85 : 40;
      for (let j = 0; j < rays; j++) {
        const a = j * Math.PI * 2 / rays + (burst.kind === 'lift' ? 1.5 : 0);
        const distance = spread * t;
        burst.ink.fillColor = burst.kind === 'hit'
          ? new Color(255, 236, 176, Math.floor(210 * (1 - t)))
          : new Color(255, 250, 224, Math.floor(190 * (1 - t)));
        burst.ink.circle(Math.cos(a) * distance, Math.sin(a) * distance,
          (burst.kind === 'score' ? 7 : 5) * (1 - t * 0.6));
        burst.ink.fill();
      }
    }
  }
}
