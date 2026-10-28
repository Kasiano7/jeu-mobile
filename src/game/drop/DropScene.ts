import Phaser from 'phaser';
import { Decimal, formatMoney, formatMult, formatNumber } from '../../core/bignum';
import { store } from '../../core/instance';
import { gateMult } from '../../core/stats';
import { sfx } from '../shared/audio';
import { FONTS } from '../shared/font';
import { Fx, pulse } from '../shared/fx';
import {
  BUMPER_RADIUS,
  COIN_RADIUS,
  COIN_TIERS,
  PEG_RADIUS,
  binColor,
  binWallTexture,
  boardBackground,
  gateTexture,
} from '../shared/textures';
import { WORLD_W, buildDropLayout, type DropLayout, type GateLayout } from './layout';

const STEP = 1000 / 60;
const MAX_SPEED = 26;

type Tag =
  | { kind: 'coin'; coin: Coin }
  | { kind: 'gate'; gate: GateView }
  | { kind: 'bin'; index: number }
  | { kind: 'bumper'; view: Phaser.GameObjects.Image }
  | { kind: 'spinner'; id: number; view: Phaser.GameObjects.Image }
  | { kind: 'peg'; index: number }
  | { kind: 'orb' }
  | { kind: 'wall' };

interface Coin {
  body: MatterJS.BodyType;
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  value: Decimal;
  base: Decimal;
  tier: number;
  hits: Set<number>;
  bumpT: number;
  age: number;
  still: number;
  pulse: number;
  cloned: boolean;
  lucky: boolean;
  /** Number of coins this physical coin stands for (flow cap). */
  batch: number;
  alive: boolean;
}

interface GateView {
  def: GateLayout;
  body: MatterJS.BodyType;
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  flash: number;
}

interface Dropper {
  img: Phaser.GameObjects.Image;
  light: Phaser.GameObjects.Image;
  x: number;
  acc: number;
  phase: number;
  speed: number;
  squash: number;
}

export class DropScene extends Phaser.Scene {
  private layout!: DropLayout;
  private statics: MatterJS.BodyType[] = [];
  private staticViews: Phaser.GameObjects.GameObject[] = [];
  private pegViews: { img: Phaser.GameObjects.Image; flash: number }[] = [];
  private gates: GateView[] = [];
  private spinners: { body: MatterJS.BodyType; img: Phaser.GameObjects.Image; dir: number; angle: number }[] = [];
  private binLabels: Phaser.GameObjects.BitmapText[] = [];
  private binFlash: Phaser.GameObjects.Rectangle[] = [];
  private coins: Coin[] = [];
  private pool: { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }[] = [];
  private droppers: Dropper[] = [];
  private pending: { coin: Coin; bin: number }[] = [];
  private acc = 0;
  private time0 = 0;
  private fx!: Fx;
  private orb: { body: MatterJS.BodyType; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; until: number } | null = null;
  private nextOrbAt = 0;
  private lastTap = 0;
  private rushFrame!: Phaser.GameObjects.Graphics;
  private structureKey = '';
  private unsub: (() => void)[] = [];

  constructor() {
    super({
      key: 'drop',
      physics: {
        default: 'matter',
        matter: { gravity: { x: 0, y: 1.55 }, autoUpdate: false, enableSleeping: false, debug: false },
      },
    });
  }

  create() {
    this.fx = new Fx(this);
    this.fx.reduced = store.state.settings.reducedMotion;
    this.rushFrame = this.add.graphics().setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
    this.nextOrbAt = 12_000;
    this.rebuild();

    this.matter.world.on('collisionstart', (ev: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of ev.pairs) {
        const ta = ((pair.bodyA as any).parent ?? pair.bodyA).mm as Tag | undefined;
        const tb = ((pair.bodyB as any).parent ?? pair.bodyB).mm as Tag | undefined;
        if (!ta || !tb) continue;
        if (ta.kind === 'coin' && tb.kind !== 'coin') this.onHit(ta.coin, tb);
        else if (tb.kind === 'coin' && ta.kind !== 'coin') this.onHit(tb.coin, ta);
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));

    this.unsub.push(
      store.events.on('stats', () => this.onStats()),
      store.events.on('boardChanged', () => {
        this.rebuild();
        this.fx.celebrate(WORLD_W / 2, this.layout.H * 0.4);
      }),
      store.events.on('settings', (s) => (this.fx.reduced = s.reducedMotion)),
      store.events.on('reset', () => {
        for (const c of [...this.coins]) this.removeCoin(c);
        this.rebuild();
      }),
    );
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.unsub.forEach((u) => u());
      this.scale.off('resize', this.onResize, this);
    });
  }

  private onResize() {
    this.cameras.main.setSize(this.scale.gameSize.width, this.scale.gameSize.height);
    this.rebuild();
  }

  /* ------------------------------- Building -------------------------------- */

  private structureSignature() {
    const s = store.dropStats;
    return `${s.board.id}|${s.bumpers}|${s.spinners}|${s.splitter}|${this.scale.gameSize.height}|${s.droppers}`;
  }

  private onStats() {
    if (this.structureSignature() !== this.structureKey) this.rebuild();
    else this.refreshLabels();
  }

  private clearStatics() {
    for (const b of this.statics) this.matter.world.remove(b);
    this.statics = [];
    for (const v of this.staticViews) v.destroy();
    this.staticViews = [];
    this.pegViews = [];
    this.gates = [];
    this.spinners = [];
    this.binLabels = [];
    this.binFlash = [];
    for (const d of this.droppers) {
      d.img.destroy();
      d.light.destroy();
    }
    this.droppers = [];
    if (this.orb) this.despawnOrb(false);
  }

  private addStatic(body: MatterJS.BodyType, tag: Tag) {
    (body as any).mm = tag;
    this.statics.push(body);
    return body;
  }

  private view<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.staticViews.push(o);
    return o;
  }

  private rebuild() {
    this.clearStatics();
    const stats = store.dropStats;
    const H = this.scale.gameSize.height;
    const L = (this.layout = buildDropLayout(stats.board, stats, H));
    this.structureKey = this.structureSignature();
    const pal = stats.board.palette;
    const M = this.matter;

    boardBackground(this, {
      key: 'board-bg',
      width: L.W,
      height: L.H,
      bg1: pal.bg1,
      bg2: pal.bg2,
      frame: pal.frame,
      accent: pal.accent,
      bins: L.bins,
      binTop: L.binTop,
      binBottom: L.binBottom,
      railY: L.railY,
    });
    this.view(this.add.image(0, 0, 'board-bg').setOrigin(0).setDepth(0));

    // Walls and floor
    const wallOpts = { isStatic: true, restitution: 0.3, friction: 0 };
    this.addStatic(M.add.rectangle(L.wall / 2 - 20, H / 2, L.wall + 40, H * 2, wallOpts), { kind: 'wall' });
    this.addStatic(M.add.rectangle(L.W - L.wall / 2 + 20, H / 2, L.wall + 40, H * 2, wallOpts), { kind: 'wall' });
    this.addStatic(M.add.rectangle(L.W / 2, L.binBottom + 30, L.W, 60, wallOpts), { kind: 'wall' });

    // Pegs
    L.pegs.forEach((p, i) => {
      this.addStatic(M.add.circle(p.x, p.y, PEG_RADIUS, { isStatic: true, restitution: 0.55, friction: 0.001 }), { kind: 'peg', index: i });
      const img = this.view(this.add.image(p.x, p.y, 'peg').setDepth(5).setTint(pal.peg));
      this.pegViews.push({ img, flash: 0 });
    });

    // Bumpers
    for (const b of L.bumpers) {
      const img = this.view(this.add.image(b.x, b.y, 'bumper').setDepth(7));
      this.addStatic(M.add.circle(b.x, b.y, BUMPER_RADIUS, { isStatic: true, restitution: 1.05, friction: 0 }), { kind: 'bumper', view: img });
    }

    // Spinners
    for (const s of L.spinners) {
      const img = this.view(this.add.image(s.x, s.y, 'spinner').setDepth(7));
      const body = M.add.rectangle(s.x, s.y, 228, 26, { isStatic: true, restitution: 0.6, friction: 0, chamfer: { radius: 12 } });
      this.addStatic(body, { kind: 'spinner', id: s.id, view: img });
      this.spinners.push({ body, img, dir: s.dir, angle: 0 });
    }

    // Gates
    for (const g of L.gates) {
      const key = gateTexture(this, g.kind, g.w, g.h);
      const img = this.view(this.add.image(g.x, g.y, key).setDepth(6));
      const label = this.view(this.add.bitmapText(g.x, g.y + 2, FONTS.main, '', 36).setOrigin(0.5).setDepth(6.5));
      const body = M.add.rectangle(g.x, g.y, g.w - 10, g.h - 14, { isStatic: true, isSensor: true });
      const view: GateView = { def: g, body, img, label, flash: 0 };
      this.addStatic(body, { kind: 'gate', gate: view });
      if (g.locked) {
        img.setAlpha(0.22);
        label.setAlpha(0.6);
      }
      this.gates.push(view);
    }

    // Bins: dividers, sensors, labels
    const wallH = L.binBottom - L.binTop;
    for (let i = 1; i < L.bins.length; i++) {
      const x = L.bins[i].x0;
      this.view(this.add.image(x, L.binTop + wallH / 2, binWallTexture(this, wallH, '#c7cede')).setDepth(8));
      this.addStatic(M.add.rectangle(x, L.binTop + wallH / 2 + 6, 18, wallH - 6, { isStatic: true, restitution: 0.2 }), { kind: 'wall' });
      this.addStatic(M.add.circle(x, L.binTop + 9, 10, { isStatic: true, restitution: 0.4 }), { kind: 'wall' });
    }
    L.bins.forEach((b, i) => {
      const cx = (b.x0 + b.x1) / 2;
      const w = b.x1 - b.x0;
      const sensorTop = L.binTop + wallH * 0.42;
      this.addStatic(
        M.add.rectangle(cx, (sensorTop + L.binBottom) / 2, w - 22, L.binBottom - sensorTop, { isStatic: true, isSensor: true }),
        { kind: 'bin', index: i },
      );
      const color = Phaser.Display.Color.HexStringToColor(binColor(b.mult, b.jackpot)).color;
      const flash = this.view(this.add.rectangle(cx, (L.binTop + L.binBottom) / 2, w - 12, wallH, color, 1).setAlpha(0).setDepth(4));
      flash.setBlendMode(Phaser.BlendModes.ADD);
      this.binFlash.push(flash);
      const label = this.view(
        this.add.bitmapText(cx, L.binBottom - 52, b.jackpot ? FONTS.gold : FONTS.main, '', b.jackpot ? 40 : 46).setOrigin(0.5).setDepth(9),
      );
      this.binLabels.push(label);
    });

    // Droppers (generators)
    const n = stats.droppers;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(0, L.dropperY, 'dropper').setDepth(20).setOrigin(0.5, 0.5);
      if (n > 3) img.setScale(0.82);
      const light = this.add.image(0, L.dropperY - 64, 'dropperLight').setDepth(21).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3);
      this.droppers.push({ img, light, x: L.W / 2, acc: Math.random() * 0.5, phase: (i / n) * Math.PI * 2 + 0.5, speed: 0.45 + i * 0.07, squash: 0 });
    }

    this.refreshLabels();
  }

  private refreshLabels() {
    const s = store.dropStats;
    for (const g of this.gates) {
      const d = g.def;
      if (d.kind === 'add') g.label.setText('+' + formatNumber(s.gateUnit.mul(d.power)));
      else if (d.kind === 'mult') g.label.setText(formatMult(gateMult(d.power, s.gateMultBoost)));
      else g.label.setText(d.locked ? 'SPLIT • VERROUILLÉ' : 'SPLIT ×2');
      const maxW = d.w - 40;
      g.label.setFontSize(36);
      if (g.label.width > maxW) g.label.setFontSize((36 * maxW) / g.label.width);
    }
    this.layout.bins.forEach((b, i) => {
      const lbl = this.binLabels[i];
      lbl.setText(formatMult(b.mult * s.binScale));
      const maxW = b.x1 - b.x0 - 22;
      lbl.setFontSize(b.jackpot ? 40 : 46);
      if (lbl.width > maxW) lbl.setFontSize(((b.jackpot ? 40 : 46) * maxW) / lbl.width);
    });
  }

  /* --------------------------------- Coins --------------------------------- */

  private tierFor(c: Coin) {
    const ratio = c.value.div(c.base).toNumber();
    const t = ratio <= 1 ? 0 : Math.floor(Math.log(ratio) / Math.log(2.2)) + 1;
    return Math.max(0, Math.min(COIN_TIERS.length - 1, t + (c.lucky ? 2 : 0)));
  }

  private spawnCoin(x: number, y: number, value: Decimal, base: Decimal, opts: { lucky?: boolean; cloned?: boolean; vx?: number; vy?: number; batch?: number } = {}) {
    if (this.coins.length >= store.dropStats.maxCoins) return null;
    const body = this.matter.add.circle(x, y, COIN_RADIUS, {
      restitution: 0.42,
      friction: 0.002,
      frictionStatic: 0,
      frictionAir: 0.006,
      density: 0.0016,
      slop: 0.03,
    });
    this.matter.body.setVelocity(body, { x: opts.vx ?? (Math.random() - 0.5) * 3, y: opts.vy ?? 1.5 });
    let v = this.pool.pop();
    if (!v) {
      v = {
        img: this.add.image(0, 0, 'coin0').setDepth(10),
        label: this.add.bitmapText(0, 0, FONTS.main, '', 34).setOrigin(0.5).setDepth(11),
      };
    }
    v.img.setVisible(true).setScale(0.3).setPosition(x, y);
    v.label.setVisible(true).setScale(1).setPosition(x, y);
    const coin: Coin = {
      body,
      img: v.img,
      label: v.label,
      value,
      base,
      tier: -1,
      hits: new Set(),
      bumpT: 0,
      age: 0,
      still: 0,
      pulse: 0,
      cloned: !!opts.cloned,
      lucky: !!opts.lucky,
      batch: opts.batch ?? 1,
      alive: true,
    };
    (body as any).mm = { kind: 'coin', coin } satisfies Tag;
    this.coins.push(coin);
    this.updateCoinVisual(coin);
    return coin;
  }

  private updateCoinVisual(c: Coin) {
    const tier = this.tierFor(c);
    if (tier !== c.tier) {
      c.tier = tier;
      c.img.setTexture(c.lucky && tier <= 2 ? 'coinLucky' : `coin${tier}`);
    }
    const text = formatNumber(c.value);
    c.label.setText(text);
    const n = text.length;
    c.label.setFontSize(n <= 2 ? 40 : n === 3 ? 36 : n === 4 ? 30 : 25);
  }

  private removeCoin(c: Coin) {
    if (!c.alive) return;
    c.alive = false;
    this.matter.world.remove(c.body);
    const i = this.coins.indexOf(c);
    if (i >= 0) this.coins.splice(i, 1);
    c.img.setVisible(false);
    c.label.setVisible(false);
    this.pool.push({ img: c.img, label: c.label });
  }

  /* ------------------------------- Collisions ------------------------------ */

  private onHit(c: Coin, t: Tag) {
    if (!c.alive) return;
    const s = store.dropStats;
    const visible = this.sys.settings.visible;
    switch (t.kind) {
      case 'gate': {
        const g = t.gate;
        if (g.def.locked || c.hits.has(g.def.id)) return;
        c.hits.add(g.def.id);
        store.recordGateHit();
        g.flash = 1;
        const bx = c.body.position.x;
        const by = c.body.position.y;
        if (g.def.kind === 'add') {
          const add = s.gateUnit.mul(g.def.power * c.batch);
          c.value = c.value.add(add);
          if (visible) {
            sfx.play('gate');
            this.fx.float(bx, by - 40, '+' + formatNumber(add), { size: 34, tint: 0x9dffc8, rise: 70, duration: 600 });
            this.fx.burst(bx, by, 0x4dff9a, 6);
          }
        } else if (g.def.kind === 'mult') {
          const m = gateMult(g.def.power, s.gateMultBoost);
          c.value = c.value.mul(m);
          if (visible) {
            sfx.play('mult');
            this.fx.float(bx, by - 40, formatMult(m), { size: 38, tint: 0xb9c8ff, rise: 70, duration: 600 });
            this.fx.burst(bx, by, 0x8fa0ff, 8);
          }
        } else if (g.def.kind === 'split' && !c.cloned) {
          c.cloned = true;
          const clone = this.spawnCoin(bx + (Math.random() > 0.5 ? 30 : -30), by + 10, c.value, c.base, {
            cloned: true,
            lucky: c.lucky,
            batch: c.batch,
            vx: -c.body.velocity.x - 1.5,
            vy: c.body.velocity.y,
          });
          if (clone) {
            clone.hits = new Set(c.hits);
            if (visible) {
              sfx.play('pop');
              this.fx.burst(bx, by, 0xff7ad0, 10);
              this.fx.float(bx, by - 40, 'SPLIT!', { size: 36, tint: 0xffb3e6, rise: 70, duration: 600 });
            }
          }
        }
        c.pulse = 1;
        this.updateCoinVisual(c);
        return;
      }
      case 'bin':
        this.pending.push({ coin: c, bin: t.index });
        c.alive = false; // stop further hits this step
        return;
      case 'bumper': {
        if (this.time0 - c.bumpT < 220) return;
        c.bumpT = this.time0;
        store.recordBumperHit();
        const bonus = s.bumperBonus.mul(c.batch);
        c.value = c.value.add(bonus);
        const dx = c.body.position.x - t.view.x;
        const dy = c.body.position.y - t.view.y;
        const len = Math.hypot(dx, dy) || 1;
        this.matter.body.setVelocity(c.body, { x: (dx / len) * 11, y: (dy / len) * 11 });
        c.pulse = 1;
        this.updateCoinVisual(c);
        if (visible) {
          pulse(this, t.view, 0.25);
          sfx.play('bumper');
          this.fx.float(c.body.position.x, c.body.position.y - 40, '+' + formatNumber(bonus), { size: 30, tint: 0xffb3d1, rise: 60, duration: 500 });
          this.fx.glow(t.view.x, t.view.y, 0xff3d7f, 6);
        }
        return;
      }
      case 'spinner': {
        if (c.hits.has(t.id)) return;
        c.hits.add(t.id);
        c.value = c.value.mul(s.spinnerMult);
        c.pulse = 1;
        this.updateCoinVisual(c);
        if (visible) {
          sfx.play('mult');
          this.fx.float(c.body.position.x, c.body.position.y - 40, formatMult(s.spinnerMult), { size: 32, tint: 0xffe08a, rise: 60, duration: 500 });
        }
        return;
      }
      case 'orb':
        this.catchOrb();
        return;
      case 'peg': {
        const pv = this.pegViews[t.index];
        if (pv) pv.flash = 1;
        return;
      }
    }
  }

  private collect(c: Coin, binIndex: number) {
    const b = this.layout.bins[binIndex];
    const s = store.dropStats;
    const mult = b.mult * s.binScale;
    const x = c.body.position.x;
    const y = c.body.position.y;
    const credited = store.earn(c.value.mul(mult), 'drop');
    const best = this.layout.bins.every((o) => o.mult <= b.mult);
    store.recordCoin(best);
    c.alive = true; // allow removal bookkeeping
    this.removeCoin(c);
    if (!this.sys.settings.visible) return;
    const color = Phaser.Display.Color.HexStringToColor(binColor(b.mult, b.jackpot)).color;
    const flash = this.binFlash[binIndex];
    if (flash) {
      flash.setAlpha(0.45);
      this.tweens.add({ targets: flash, alpha: 0, duration: 380, ease: 'Quad.Out' });
    }
    const label = this.binLabels[binIndex];
    if (label) pulse(this, label, 0.22);
    this.fx.burst(x, y, color, b.jackpot ? 22 : best ? 14 : 8);
    this.fx.float(x, Math.min(y, this.layout.binTop + 40), '+' + formatMoney(credited), {
      gold: best || !!b.jackpot,
      size: best || b.jackpot ? 52 : 40,
      rise: 140,
      priority: best || !!b.jackpot,
    });
    if (b.jackpot) {
      sfx.play('jackpot');
      this.fx.celebrate(x, this.layout.binTop);
      this.cameras.main.shake(140, store.state.settings.reducedMotion ? 0 : 0.004);
    } else sfx.play('coin', b.mult);
  }

  /* ---------------------------------- Orb ---------------------------------- */

  private spawnOrb() {
    const spots = this.layout.orbSpots;
    if (!spots.length) return;
    const p = spots[Math.floor(Math.random() * spots.length)];
    const glow = this.add.image(p.x, p.y, 'glow').setDepth(8).setTint(0xffc400).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6);
    const img = this.add.image(p.x, p.y, 'orb').setDepth(9).setScale(0);
    this.tweens.add({ targets: img, scale: 1, duration: 400, ease: 'Back.Out' });
    this.tweens.add({ targets: glow, scale: 2.1, alpha: 0.5, yoyo: true, repeat: -1, duration: 600 });
    const body = this.matter.add.circle(p.x, p.y, 46, { isStatic: true, isSensor: true });
    (body as any).mm = { kind: 'orb' } satisfies Tag;
    this.orb = { body, img, glow, until: this.time0 + 11_000 };
  }

  private despawnOrb(caught: boolean) {
    const o = this.orb;
    if (!o) return;
    this.orb = null;
    this.matter.world.remove(o.body);
    this.tweens.killTweensOf([o.img, o.glow]);
    if (caught) {
      o.img.destroy();
      o.glow.destroy();
      return;
    }
    this.tweens.add({ targets: [o.img, o.glow], scale: 0, alpha: 0, duration: 300, onComplete: () => (o.img.destroy(), o.glow.destroy()) });
  }

  private catchOrb() {
    const o = this.orb;
    if (!o) return;
    const { x, y } = o.img;
    this.despawnOrb(true);
    store.activateRush();
    this.nextOrbAt = this.time0 + store.dropStats.orbInterval * 1000 * (0.8 + Math.random() * 0.4);
    if (this.sys.settings.visible) {
      sfx.play('orb');
      this.fx.celebrate(x, y);
      this.fx.burst(x, y, 0xffd23f, 26);
      this.fx.float(x, y - 30, 'RUSH ×2 !', { gold: true, size: 70, rise: 160, duration: 1300, priority: true });
    }
  }

  /* --------------------------------- Input --------------------------------- */

  private onTap(x: number, y: number) {
    sfx.unlock();
    if (this.orb && Math.hypot(this.orb.img.x - x, this.orb.img.y - y) < 95) {
      this.catchOrb();
      return;
    }
    if (y > this.layout.binTop - 40) return;
    if (this.time0 - this.lastTap < 130) return;
    this.lastTap = this.time0;
    const s = store.dropStats;
    const cx = Phaser.Math.Clamp(x, this.layout.wall + COIN_RADIUS + 4, WORLD_W - this.layout.wall - COIN_RADIUS - 4);
    const coin = this.spawnCoin(cx, this.layout.spawnY, s.coinValue, s.coinValue, { vy: 2 });
    if (coin) {
      store.recordTap();
      sfx.play('pop');
      this.fx.glow(cx, this.layout.spawnY, 0xffffff, 5);
    }
  }

  /* --------------------------------- Update -------------------------------- */

  update(_time: number, delta: number) {
    // Fixed 60 Hz physics, independent of the display refresh rate (60/120 Hz) and
    // able to catch up on slow frames without spiralling.
    const dt = Math.min(delta, 250);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.fixedStep();
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 8) this.acc = 0;
    this.render(dt);
  }

  private fixedStep() {
    this.time0 += STEP;
    const s = store.dropStats;
    const L = this.layout;
    const t = this.time0 / 1000;

    // Droppers move along the rail and spawn on their own timer.
    const n = this.droppers.length;
    const lane = (L.W - 2 * L.wall - 120) / n;
    this.droppers.forEach((d, i) => {
      const center = L.wall + 60 + lane * (i + 0.5);
      const amp = n === 1 ? (L.W - 2 * L.wall - 260) / 2 : Math.max(10, lane / 2 - 70);
      d.x = center + Math.sin(t * d.speed + d.phase) * amp;
      d.acc += STEP / 1000;
      if (d.acc >= s.spawnInterval) {
        if (this.coins.length < s.maxCoins) {
          d.acc -= s.spawnInterval;
          const lucky = s.board.luckyCoins && Math.random() < 0.03;
          const base = s.coinValue.mul(s.batch);
          const value = lucky ? base.mul(5) : base;
          this.spawnCoin(d.x + (Math.random() - 0.5) * 16, L.spawnY, value, base, { lucky, batch: s.batch });
          d.squash = 1;
        } else d.acc = s.spawnInterval;
      }
    });

    // Moving gates and spinners
    for (const g of this.gates) {
      if (!g.def.sway) continue;
      const x = g.def.x + Math.sin(t * 0.9 + g.def.phase) * g.def.sway;
      this.matter.body.setPosition(g.body, { x, y: g.def.y }, false);
    }
    for (const sp of this.spinners) {
      sp.angle += sp.dir * 0.045;
      this.matter.body.setAngle(sp.body, sp.angle, false);
    }

    this.matter.world.step(STEP);

    // Collect coins that reached a bin during this step.
    if (this.pending.length) {
      const list = this.pending;
      this.pending = [];
      for (const p of list) this.collect(p.coin, p.bin);
    }

    // Speed clamp, stuck detection, escapes.
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      const v = c.body.velocity;
      const sp = Math.hypot(v.x, v.y);
      if (sp > MAX_SPEED) this.matter.body.setVelocity(c.body, { x: (v.x / sp) * MAX_SPEED, y: (v.y / sp) * MAX_SPEED });
      c.age += STEP;
      const p = c.body.position;
      if (p.y > L.H + 200 || p.x < -100 || p.x > L.W + 100) {
        this.removeCoin(c);
        continue;
      }
      if (sp < 0.35 && p.y < L.binTop) {
        c.still += STEP;
        if (c.still > 900) {
          this.matter.body.setVelocity(c.body, { x: (Math.random() - 0.5) * 7, y: -2.5 });
          c.still = 0;
        }
      } else c.still = 0;
      if (c.age > 40_000 && p.y < L.binTop) {
        // Never lose a coin: route it to the nearest bin.
        const bin = L.bins.findIndex((b) => p.x >= b.x0 && p.x < b.x1);
        c.alive = false;
        this.collect(c, Math.max(0, bin));
      }
    }

    // Orb lifecycle
    if (!this.orb && this.time0 >= this.nextOrbAt) this.spawnOrb();
    if (this.orb && this.time0 > this.orb.until) {
      this.despawnOrb(false);
      this.nextOrbAt = this.time0 + s.orbInterval * 1000 * (0.8 + Math.random() * 0.4);
    }
  }

  private render(dt: number) {
    if (!this.sys.settings.visible) return;
    const k = dt / 1000;
    for (const c of this.coins) {
      const p = c.body.position;
      c.pulse = Math.max(0, c.pulse - k * 5);
      const grow = Math.min(1, c.img.scale + k * 7);
      const sc = grow * (1 + 0.32 * c.pulse);
      c.img.setPosition(p.x, p.y).setScale(sc);
      c.label.setPosition(p.x, p.y + 1).setScale(sc);
    }
    for (const d of this.droppers) {
      d.squash = Math.max(0, d.squash - k * 6);
      const base = this.droppers.length > 3 ? 0.82 : 1;
      d.img.setPosition(d.x, this.layout.dropperY).setScale(base * (1 + 0.08 * d.squash), base * (1 - 0.1 * d.squash));
      d.light.setPosition(d.x, this.layout.dropperY - 66 * base).setAlpha(0.25 + 0.75 * d.squash);
    }
    for (const g of this.gates) {
      if (g.def.sway) {
        g.img.x = g.body.position.x;
        g.label.x = g.body.position.x;
      }
      if (g.flash > 0) {
        g.flash = Math.max(0, g.flash - k * 4);
        g.img.setScale(1 + 0.08 * g.flash, 1 + 0.2 * g.flash);
      }
    }
    for (const sp of this.spinners) sp.img.setRotation(sp.angle);
    for (const pv of this.pegViews) {
      if (pv.flash <= 0) continue;
      pv.flash = Math.max(0, pv.flash - k * 6);
      pv.img.setScale(1 + 0.35 * pv.flash);
    }
    if (this.orb) this.orb.img.y += Math.sin(this.time0 / 220) * 0.4;

    // Rush frame glow
    this.rushFrame.clear();
    if (store.isRush() || store.isFrenzy()) {
      const a = 0.45 + 0.25 * Math.sin(this.time0 / 120);
      const color = store.isRush() ? 0xffc400 : 0xff4fd8;
      this.rushFrame.lineStyle(18, color, a);
      this.rushFrame.strokeRoundedRect(10, 10, this.layout.W - 20, this.layout.H - 20, 34);
    }
  }

  /** Number of coins currently simulated (for tests/diagnostics). */
  get coinCount() {
    return this.coins.length;
  }
}
