import Phaser from 'phaser';
import { FONTS } from './font';

/**
 * Pooled floating labels and particle bursts. Hidden scenes skip FX entirely,
 * and "reduced motion" cuts particle counts.
 */
export class Fx {
  private pool: Phaser.GameObjects.BitmapText[] = [];
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private dots: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  reduced = false;
  /** Timestamps of recent floating labels, to keep the screen readable at high production. */
  private recent: number[] = [];

  constructor(private scene: Phaser.Scene, depth = 50) {
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 180, max: 520 },
      lifespan: { min: 350, max: 650 },
      scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 900,
      blendMode: 'ADD',
      emitting: false,
    });
    this.sparks.setDepth(depth);
    this.dots = scene.add.particles(0, 0, 'dot', {
      speed: { min: 60, max: 220 },
      lifespan: 450,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.dots.setDepth(depth);
    this.confetti = scene.add.particles(0, 0, 'confetti', {
      speed: { min: 300, max: 900 },
      angle: { min: 230, max: 310 },
      lifespan: 1600,
      gravityY: 1300,
      rotate: { start: 0, end: 720 },
      scaleX: { start: 1, end: 0.2 },
      tint: [0xffd23f, 0x38e8c6, 0xff4f8b, 0x7b5cff, 0xffffff],
      emitting: false,
    });
    this.confetti.setDepth(depth + 1);
  }

  get active() {
    return this.scene.sys.settings.visible;
  }

  burst(x: number, y: number, tint: number, count = 10) {
    if (!this.active) return;
    const n = this.reduced ? Math.ceil(count / 4) : count;
    this.sparks.setParticleTint(tint);
    this.sparks.explode(n, x, y);
  }

  glow(x: number, y: number, tint: number, count = 6) {
    if (!this.active || this.reduced) return;
    this.dots.setParticleTint(tint);
    this.dots.explode(count, x, y);
  }

  celebrate(x: number, y: number) {
    if (!this.active) return;
    this.confetti.explode(this.reduced ? 12 : 60, x, y);
  }

  float(
    x: number,
    y: number,
    text: string,
    opts: { gold?: boolean; size?: number; tint?: number; rise?: number; duration?: number; priority?: boolean } = {},
  ) {
    if (!this.active) return;
    const now = this.scene.time.now;
    while (this.recent.length && now - this.recent[0] > 1000) this.recent.shift();
    const budget = this.reduced ? 5 : 12;
    if (!opts.priority && this.recent.length >= budget) return;
    this.recent.push(now);
    let t = this.pool.pop();
    const font = opts.gold ? FONTS.gold : FONTS.main;
    if (!t) {
      t = this.scene.add.bitmapText(0, 0, font, '', 40).setOrigin(0.5).setDepth(60);
    } else {
      t.setFont(font);
    }
    t.setText(text)
      .setFontSize(opts.size ?? 44)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(0.5)
      .setVisible(true)
      .setTint(opts.tint ?? 0xffffff);
    const rise = opts.rise ?? 110;
    const dur = opts.duration ?? 900;
    this.scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: t,
      y: y - rise,
      alpha: 0,
      duration: dur,
      delay: 120,
      ease: 'Cubic.In',
      onComplete: () => {
        t!.setVisible(false);
        if (this.pool.length < 40) this.pool.push(t!);
        else t!.destroy();
      },
    });
  }
}

/** Squash-and-stretch pulse used by most interactive pieces. */
export function pulse(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, amount = 0.18, duration = 110) {
  const t = target as any;
  const sx = t.__baseScaleX ?? (t.__baseScaleX = t.scaleX);
  const sy = t.__baseScaleY ?? (t.__baseScaleY = t.scaleY);
  scene.tweens.killTweensOf(target);
  t.setScale(sx * (1 + amount), sy * (1 + amount));
  scene.tweens.add({ targets: target, scaleX: sx, scaleY: sy, duration: duration * 2, ease: 'Back.Out' });
}
