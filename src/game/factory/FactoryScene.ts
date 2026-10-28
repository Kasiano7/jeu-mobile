import Phaser from 'phaser';
import { Decimal, formatMoney, formatMult, formatNumber } from '../../core/bignum';
import { FACTORY } from '../../core/config';
import { store } from '../../core/instance';
import { applyMode } from '../mode';
import { sfx } from '../shared/audio';
import { FONTS } from '../shared/font';
import { Fx, pulse } from '../shared/fx';
import { ITEM_TIERS, WHEEL_RADIUS, factoryBackground } from '../shared/textures';
import { ConveyorLoop, sliderY } from './geometry';

const W = 1080;
const BELT = 46;
const CRANK = WHEEL_RADIUS * 0.55;
const ROD = 150;
const HUB = 24;

interface Item {
  s: number;
  value: Decimal;
  base: Decimal;
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  tier: number;
  pulse: number;
  falling: number; // >0 while dropping into the vault (ms elapsed)
  fromX: number;
  fromY: number;
}

interface Slot {
  index: number;
  x: number;
  y: number;
  row: 0 | 1;
  station: number;
  wheel: Phaser.GameObjects.Image | null;
  hubLabel: Phaser.GameObjects.BitmapText | null;
  press: Phaser.GameObjects.Image | null;
  pressFlash: number;
  hit: Phaser.GameObjects.Zone;
  placeholder: Phaser.GameObjects.Container;
}

export class FactoryScene extends Phaser.Scene {
  private loop!: ConveyorLoop;
  private H = 1400;
  private sStart = 0;
  private items: Item[] = [];
  private itemPool: { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }[] = [];
  private slots: Slot[] = [];
  private cleats: Phaser.GameObjects.Image[] = [];
  private pulleys: Phaser.GameObjects.Image[] = [];
  private mech!: Phaser.GameObjects.Graphics;
  private beltPhase = 0;
  private angle = 0;
  private spawnAcc = 0;
  private fx!: Fx;
  private vault!: Phaser.GameObjects.Image;
  private vaultPos = { x: 0, y: 0 };
  private motor!: Phaser.GameObjects.Image;
  private motorGear!: Phaser.GameObjects.Image;
  private chainLabel!: Phaser.GameObjects.BitmapText;
  private rateLabel!: Phaser.GameObjects.BitmapText;
  private built: Phaser.GameObjects.GameObject[] = [];
  private unsub: (() => void)[] = [];
  private lastStationSfx = 0;

  constructor() {
    super({ key: 'factory' });
  }

  create() {
    this.fx = new Fx(this);
    this.fx.reduced = store.state.settings.reducedMotion;
    this.build();
    this.unsub.push(
      store.events.on('stats', () => this.refresh()),
      store.events.on('wheelAdded', (i) => this.onWheelAdded(i)),
      store.events.on('wheelUpgraded', (i) => this.onWheelUpgraded(i)),
      store.events.on('slotsExpanded', () => {
        this.refresh();
        if (this.sys.settings.visible) {
          sfx.play('buy');
          this.fx.celebrate(W / 2, this.H / 2);
        }
      }),
      store.events.on('settings', (s) => (this.fx.reduced = s.reducedMotion)),
      store.events.on('reset', () => {
        for (const it of [...this.items]) this.releaseItem(it);
        this.items = [];
        this.build();
      }),
    );
    this.scale.on('resize', this.onResize, this);
    const cleanup = () => {
      this.unsub.forEach((u) => u());
      this.unsub = [];
      this.scale.off('resize', this.onResize, this);
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    applyMode(this.game);
  }

  private onResize() {
    this.cameras.main.setSize(this.scale.gameSize.width, this.scale.gameSize.height);
    // Items keep their belt position (arc length): nothing in production is lost.
    if (this.scale.gameSize.height !== this.H) this.build();
  }

  /* -------------------------------- Layout --------------------------------- */

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.built.push(o);
    return o;
  }

  private build() {
    for (const o of this.built) o.destroy();
    this.built = [];
    this.cleats = [];
    this.pulleys = [];
    this.slots = [];
    this.H = this.scale.gameSize.height;
    const H = this.H;
    const top = 300;
    const bottom = H - 330;
    this.loop = new ConveyorLoop(96, top, 984, bottom, 70);
    this.sStart = this.loop.sTop(210);

    factoryBackground(this, 'factory-bg', W, H);
    this.keep(this.add.image(0, 0, 'factory-bg').setOrigin(0).setDepth(0));

    // Header
    this.keep(this.add.bitmapText(W / 2, 62, FONTS.gold, 'MONEY FACTORY', 70).setOrigin(0.5).setDepth(30));
    this.rateLabel = this.keep(this.add.bitmapText(W / 2, 122, FONTS.main, '', 34).setOrigin(0.5).setDepth(30).setAlpha(0.9));

    // Static belt body
    const g = this.keep(this.add.graphics().setDepth(2));
    const L = this.loop;
    g.lineStyle(BELT + 14, 0x0b0d1a, 0.6);
    g.strokeRoundedRect(L.left, L.top + 6, L.right - L.left, L.bottom - L.top, L.r);
    g.lineStyle(BELT + 8, 0x3a3f55, 1);
    g.strokeRoundedRect(L.left, L.top, L.right - L.left, L.bottom - L.top, L.r);
    g.lineStyle(BELT, 0x1d2033, 1);
    g.strokeRoundedRect(L.left, L.top, L.right - L.left, L.bottom - L.top, L.r);
    g.lineStyle(3, 0x6b7190, 0.8);
    g.strokeRoundedRect(L.left - BELT / 2, L.top - BELT / 2, L.right - L.left + BELT, L.bottom - L.top + BELT, L.r + BELT / 2);
    g.strokeRoundedRect(L.left + BELT / 2, L.top + BELT / 2, L.right - L.left - BELT, L.bottom - L.top - BELT, Math.max(4, L.r - BELT / 2));

    // Moving cleats
    const n = Math.floor(L.length / 58);
    for (let i = 0; i < n; i++) this.cleats.push(this.keep(this.add.image(0, 0, 'cleat').setDepth(3)));

    // Corner pulleys
    for (const c of L.corners()) this.pulleys.push(this.keep(this.add.image(c.x, c.y, 'pulley').setDepth(4).setScale(0.95)));

    // Input hopper, motor, vault
    this.keep(this.add.image(210, top - 12, 'hopper').setOrigin(0.5, 1).setScale(0.8).setDepth(12));
    this.motor = this.keep(this.add.image(880, top - 92, 'motor').setScale(0.72).setDepth(12));
    this.motorGear = this.keep(this.add.image(800, top - 92, 'gearSmall').setScale(0.8).setDepth(13));
    this.vaultPos = { x: 190, y: bottom + 150 };
    this.vault = this.keep(this.add.image(this.vaultPos.x, this.vaultPos.y, 'vault').setDepth(12));
    this.keep(this.add.bitmapText(this.vaultPos.x, this.vaultPos.y + 108, FONTS.main, 'COLLECT', 30).setOrigin(0.5).setDepth(13));
    this.chainLabel = this.keep(this.add.bitmapText(640, bottom + 120, FONTS.main, '', 40).setOrigin(0.5).setDepth(13));

    // Mechanism layer (rods, belts) redrawn every frame
    this.mech = this.keep(this.add.graphics().setDepth(9));

    // Wheel slots: row 0 left->right on the top belt, row 1 right->left on the bottom belt.
    const xs = [255, 445, 635, 825];
    const y0 = top + (bottom - top) * 0.34;
    const y1 = top + (bottom - top) * 0.7;
    for (let i = 0; i < FACTORY.maxSlots; i++) {
      const row = (i < 4 ? 0 : 1) as 0 | 1;
      const x = row === 0 ? xs[i] : xs[7 - i];
      const y = row === 0 ? y0 : y1;
      const station = row === 0 ? L.sTop(x) : L.sBottom(x);
      const hit = this.keep(this.add.zone(x, y, WHEEL_RADIUS * 2 + 20, WHEEL_RADIUS * 2 + 20).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => this.onSlotTap(i));
      const placeholder = this.keep(this.add.container(x, y).setDepth(5));
      this.slots.push({ index: i, x, y, row, station, wheel: null, hubLabel: null, press: null, pressFlash: 0, hit, placeholder });
    }
    this.refresh();
  }

  /** Syncs wheels/placeholders/labels with the store. */
  private refresh() {
    const st = store.state.factory;
    const stats = store.factoryStats;
    this.slots.forEach((slot, i) => {
      const owned = i < st.wheels.length;
      if (owned && !slot.wheel) this.createWheel(slot, false);
      if (!owned && slot.wheel) this.destroyWheel(slot);
      if (owned) {
        slot.hubLabel!.setText(formatMult(stats.wheelMults[i]));
        slot.wheel!.setTexture(`wheel${Math.min(4, Math.floor(st.wheels[i] / 5))}`);
      }
      this.drawPlaceholder(slot, owned ? 'owned' : i < st.slotsUnlocked ? (i === st.wheels.length ? 'next' : 'empty') : 'locked');
    });
    this.chainLabel.setText(`CHAÎNE ${formatMult(stats.totalMult)}`);
    this.rateLabel.setText(`${stats.itemsPerSecond.toFixed(1)} liasses/s • ${formatMoney(stats.itemValue)} / liasse`);
  }

  private drawPlaceholder(slot: Slot, state: 'owned' | 'next' | 'empty' | 'locked') {
    const c = slot.placeholder;
    this.tweens.killTweensOf(c);
    c.setScale(1);
    c.removeAll(true);
    if (state === 'owned') return;
    const g = this.add.graphics();
    const R = WHEEL_RADIUS - 6;
    if (state === 'locked') {
      g.fillStyle(0x000000, 0.35).fillCircle(0, 0, R);
      g.lineStyle(4, 0x6b7190, 0.6).strokeCircle(0, 0, R);
      // padlock
      g.lineStyle(9, 0xc7cede, 1).beginPath().arc(0, -14, 20, Math.PI, 0).strokePath();
      g.fillStyle(0xffb400, 1).fillRoundedRect(-28, -14, 56, 44, 10);
      g.fillStyle(0x7a3d00, 1).fillCircle(0, 6, 7);
      c.add(g);
      const cost = store.expandCost;
      if (cost && slot.index === store.state.factory.slotsUnlocked) {
        c.add(this.add.bitmapText(0, R - 8, FONTS.main, 'EXPAND ' + formatMoney(cost), 26).setOrigin(0.5));
      }
      return;
    }
    g.fillStyle(0xffffff, state === 'next' ? 0.08 : 0.03).fillCircle(0, 0, R);
    // dashed ring
    const dashes = 22;
    g.lineStyle(5, state === 'next' ? 0x38e8c6 : 0x6b7190, state === 'next' ? 0.9 : 0.5);
    for (let k = 0; k < dashes; k++) {
      const a0 = (k / dashes) * Math.PI * 2;
      g.beginPath().arc(0, 0, R, a0, a0 + (Math.PI / dashes) * 1.1).strokePath();
    }
    c.add(g);
    if (state === 'next') {
      c.add(this.add.bitmapText(0, -14, FONTS.main, '+', 80).setOrigin(0.5));
      c.add(this.add.bitmapText(0, 40, FONTS.main, formatMoney(store.wheelCost), 28).setOrigin(0.5));
      this.tweens.add({ targets: c, scale: { from: 1, to: 1.05 }, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
    }
  }

  private createWheel(slot: Slot, animate: boolean) {
    this.tweens.killTweensOf(slot.placeholder);
    slot.placeholder.setScale(1);
    slot.wheel = this.keep(this.add.image(slot.x, slot.y, 'wheel0').setDepth(7));
    slot.hubLabel = this.keep(this.add.bitmapText(slot.x, slot.y + 2, FONTS.main, '', 30).setOrigin(0.5).setDepth(11));
    slot.press = this.keep(this.add.image(slot.x, slot.y, 'press').setDepth(8));
    if (animate) {
      slot.wheel.setScale(0);
      slot.hubLabel.setScale(0);
      slot.press.setScale(0);
      this.tweens.add({ targets: [slot.wheel, slot.hubLabel, slot.press], scale: 1, duration: 520, ease: 'Back.Out' });
    }
  }

  private destroyWheel(slot: Slot) {
    slot.wheel?.destroy();
    slot.hubLabel?.destroy();
    slot.press?.destroy();
    slot.wheel = slot.hubLabel = slot.press = null;
  }

  private onWheelAdded(index: number) {
    const slot = this.slots[index];
    if (!slot) return;
    if (!slot.wheel) this.createWheel(slot, true);
    this.refresh();
    if (this.sys.settings.visible) {
      sfx.play('wheel');
      this.fx.celebrate(slot.x, slot.y);
      this.fx.burst(slot.x, slot.y, 0xffd23f, 24);
      this.fx.float(slot.x, slot.y - 100, 'NOUVELLE ROUE !', { gold: true, size: 48, rise: 120, duration: 1100, priority: true });
      this.cameras.main.shake(160, store.state.settings.reducedMotion ? 0 : 0.003);
    }
  }

  private onWheelUpgraded(index: number) {
    const slot = this.slots[index];
    this.refresh();
    if (!slot?.wheel || !this.sys.settings.visible) return;
    pulse(this, slot.wheel, 0.12);
    sfx.play('buy');
    this.fx.burst(slot.x, slot.y, 0x38e8c6, 16);
    this.fx.float(slot.x, slot.y - 90, formatMult(store.factoryStats.wheelMults[index]), { gold: true, size: 50, priority: true });
  }

  private onSlotTap(index: number) {
    if (!this.sys.settings.visible || !store.factoryUnlocked) return;
    sfx.unlock();
    const st = store.state.factory;
    if (index < st.wheels.length) {
      store.events.emit('ui', { open: 'wheel', index });
      sfx.play('click');
      return;
    }
    if (index === st.wheels.length && index < st.slotsUnlocked) {
      if (!store.addWheel()) {
        sfx.play('deny');
        store.events.emit('toast', { text: `Il faut ${formatMoney(store.wheelCost)} pour cette roue`, tone: 'warn' });
      }
      return;
    }
    if (index >= st.slotsUnlocked) {
      const cost = store.expandCost;
      if (cost && !store.expandFactory()) {
        sfx.play('deny');
        store.events.emit('toast', { text: `Agrandissement : ${formatMoney(cost)}`, tone: 'warn' });
      }
    }
  }

  /* --------------------------------- Items --------------------------------- */

  private spawnItem() {
    const stats = store.factoryStats;
    let v = this.itemPool.pop();
    if (!v) {
      v = {
        img: this.add.image(0, 0, 'item0').setDepth(14),
        label: this.add.bitmapText(0, 0, FONTS.main, '', 28).setOrigin(0.5).setDepth(15),
      };
    }
    v.img.setVisible(true).setScale(0);
    v.label.setVisible(true).setScale(0);
    const it: Item = {
      s: this.sStart,
      value: stats.itemValue,
      base: stats.itemValue,
      img: v.img,
      label: v.label,
      tier: -1,
      pulse: 0,
      falling: 0,
      fromX: 0,
      fromY: 0,
    };
    this.items.push(it);
    this.updateItemVisual(it);
  }

  private updateItemVisual(it: Item) {
    const ratio = it.value.div(it.base).toNumber();
    const tier = Math.max(0, Math.min(ITEM_TIERS.length - 1, ratio <= 1 ? 0 : Math.floor(Math.log(ratio) / Math.log(2.4)) + 1));
    if (tier !== it.tier) {
      it.tier = tier;
      it.img.setTexture(`item${tier}`);
    }
    const t = formatNumber(it.value);
    it.label.setText(t).setFontSize(t.length <= 3 ? 34 : t.length === 4 ? 30 : 26);
  }

  private releaseItem(it: Item) {
    it.img.setVisible(false);
    it.label.setVisible(false);
    this.itemPool.push({ img: it.img, label: it.label });
  }

  /* --------------------------------- Update -------------------------------- */

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 250) / 1000;
    const stats = store.factoryStats;
    const st = store.state.factory;
    const v = stats.beltSpeed;
    const visible = this.sys.settings.visible;

    this.beltPhase = (this.beltPhase + v * dt) % this.loop.length;
    this.angle += (v / 70) * dt;

    if (store.factoryUnlocked) {
      this.spawnAcc += dt;
      const interval = FACTORY.itemSpacing / v;
      if (this.spawnAcc >= interval) {
        this.spawnAcc = Math.min(this.spawnAcc - interval, interval);
        if (this.items.length < 60) this.spawnItem();
      }
    }

    const exit = this.loop.sExit;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.falling > 0) {
        it.falling += dt * 1000;
        const k = Math.min(1, it.falling / 320);
        const x = Phaser.Math.Linear(it.fromX, this.vaultPos.x, k);
        const y = Phaser.Math.Linear(it.fromY, this.vaultPos.y - 70, k) - Math.sin(k * Math.PI) * 60;
        if (visible) it.img.setPosition(x, y).setScale(1 - 0.4 * k);
        if (visible) it.label.setPosition(x, y).setScale(1 - 0.4 * k);
        if (k >= 1) {
          const credited = store.earn(it.value, 'factory');
          store.recordItem();
          this.items.splice(i, 1);
          this.releaseItem(it);
          if (visible) {
            pulse(this, this.vault, 0.08);
            sfx.play('coin', 3);
            this.fx.burst(this.vaultPos.x, this.vaultPos.y - 70, 0xffd23f, 8);
            this.fx.float(this.vaultPos.x + 40, this.vaultPos.y - 120, '+' + formatMoney(credited), { gold: true, size: 44, rise: 120, priority: true });
          }
        }
        continue;
      }
      const prev = it.s;
      it.s += v * dt;
      for (let k = 0; k < st.wheels.length; k++) {
        const sl = this.slots[k];
        if (prev < sl.station && it.s >= sl.station) {
          const m = stats.wheelMults[k];
          it.value = it.value.mul(m);
          it.pulse = 1;
          sl.pressFlash = 1;
          this.updateItemVisual(it);
          if (visible) {
            if (this.time.now - this.lastStationSfx > 70) {
              sfx.play('click');
              this.lastStationSfx = this.time.now;
            }
            const p = this.loop.point(sl.station);
            this.fx.glow(p.x, p.y, 0x38e8c6, 4);
            this.fx.float(p.x, p.y - 50, formatMult(m), { size: 30, tint: 0x9dfff0, rise: 50, duration: 500 });
          }
        }
      }
      if (it.s >= exit) {
        const p = this.loop.point(exit);
        it.falling = 1;
        it.fromX = p.x;
        it.fromY = p.y;
        continue;
      }
      if (visible) {
        it.pulse = Math.max(0, it.pulse - dt * 5);
        const p = this.loop.point(it.s);
        const grow = Math.min(1, it.img.scale + dt * 5);
        const sc = it.pulse > 0 ? 1 + 0.3 * it.pulse : grow;
        it.img.setPosition(p.x, p.y - 18).setScale(sc);
        it.label.setPosition(p.x, p.y - 20).setScale(sc);
      }
    }

    if (visible) this.renderMechanics(dt);
  }

  private renderMechanics(dt: number) {
    const L = this.loop;
    // belt cleats
    const n = this.cleats.length;
    const spacing = L.length / n;
    for (let i = 0; i < n; i++) {
      const p = L.point(this.beltPhase + i * spacing);
      this.cleats[i].setPosition(p.x, p.y).setRotation(p.angle);
    }
    for (const p of this.pulleys) p.setRotation(this.angle * 1.5);
    this.motorGear.setRotation(-this.angle * 2.2);
    this.motor.setY(this.loop.top - 92 + Math.sin(this.angle * 9) * 1.2);

    const g = this.mech;
    g.clear();
    const st = store.state.factory;
    const owned = st.wheels.length;
    const th = this.angle;
    const pins: { x: number; y: number }[] = [];

    // Drive belt: motor gear -> top-right pulley
    const corners = L.corners();
    this.drawBelt(g, 800, this.loop.top - 92, corners[1].x, corners[1].y, 20, 0xffb400);
    // Top-left pulley -> first wheel hub
    if (owned > 0) this.drawBelt(g, corners[0].x, corners[0].y, this.slots[0].x, this.slots[0].y, HUB, 0x2a2d40);

    for (let i = 0; i < owned; i++) {
      const sl = this.slots[i];
      if (!sl.wheel || !sl.press) continue;
      sl.wheel.setRotation(th);
      const px = sl.x + Math.cos(th) * CRANK;
      const py = sl.y + Math.sin(th) * CRANK;
      pins.push({ x: px, y: py });
      const up = sl.row === 0;
      const sy = sliderY(sl.x, px, py, ROD, up);
      // guide rail
      g.lineStyle(10, 0x2a2d40, 1);
      g.lineBetween(sl.x, up ? L.top + 30 : L.bottom - 30, sl.x, sy);
      // connecting rod (bielle)
      g.lineStyle(14, 0x9aa3b8, 1);
      g.lineBetween(px, py, sl.x, sy);
      g.lineStyle(4, 0xe8ecf7, 1);
      g.lineBetween(px, py - 3, sl.x, sy - 3);
      g.fillStyle(0xffb400, 1).fillCircle(sl.x, sy, 9);
      sl.press.setPosition(sl.x, sy + (up ? -14 : 14)).setFlipY(!up);
      sl.pressFlash = Math.max(0, sl.pressFlash - dt * 5);
      sl.press.setTint(sl.pressFlash > 0 ? Phaser.Display.Color.GetColor(255, 255, Math.round(255 - 180 * sl.pressFlash)) : 0xffffff);
    }

    // Coupling rods between neighbours on the same row (same phase -> stays parallel)
    for (let i = 0; i + 1 < pins.length; i++) {
      if (this.slots[i].row !== this.slots[i + 1].row) continue;
      const a = pins[i];
      const b = pins[i + 1];
      g.lineStyle(18, 0x5b6078, 1).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(10, 0xffb400, 1).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(3, 0xfff2b0, 1).lineBetween(a.x, a.y - 3, b.x, b.y - 3);
    }
    for (const p of pins) {
      g.fillStyle(0x2a2d40, 1).fillCircle(p.x, p.y, 13);
      g.fillStyle(0xf2f4ff, 1).fillCircle(p.x, p.y, 7);
    }
    // Vertical belt between the two rows
    if (owned > 4) this.drawBelt(g, this.slots[3].x, this.slots[3].y, this.slots[4].x, this.slots[4].y, HUB, 0x2a2d40);
  }

  /** Open belt between two pulleys of equal radius with moving teeth marks. */
  private drawBelt(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, r: number, color: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    g.lineStyle(9, color, 1);
    g.lineBetween(x1 + nx * r, y1 + ny * r, x2 + nx * r, y2 + ny * r);
    g.lineBetween(x1 - nx * r, y1 - ny * r, x2 - nx * r, y2 - ny * r);
    g.lineStyle(9, color, 1);
    g.strokeCircle(x1, y1, r);
    g.strokeCircle(x2, y2, r);
    // teeth marks travelling along both strands (opposite directions)
    const step = 34;
    const off = (this.beltPhase * 0.6) % step;
    g.fillStyle(0xffffff, 0.35);
    for (let d = off; d < len; d += step) {
      const t = d / len;
      g.fillCircle(x1 + dx * t + nx * r, y1 + dy * t + ny * r, 2.5);
      const t2 = 1 - t;
      g.fillCircle(x1 + dx * t2 - nx * r, y1 + dy * t2 - ny * r, 2.5);
    }
  }
}
