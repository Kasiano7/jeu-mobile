import Phaser from 'phaser';
import { store } from '../core/instance';
import type { Mode } from '../core/types';
import { DropScene } from './drop/DropScene';
import { FactoryScene } from './factory/FactoryScene';
import { sfx } from './shared/audio';
import { createFonts } from './shared/font';
import { generateBaseTextures } from './shared/textures';

export const WORLD_WIDTH = 1080;

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  create() {
    generateBaseTextures(this);
    createFonts(this);
    this.scene.launch('drop');
    this.scene.launch('factory');
    this.scene.bringToTop('drop');
    applyMode(this.game, store.mode, false);
    this.game.events.emit('mm-ready');
  }
}

/** Shows one machine and keeps the other simulating in the background (real production). */
function applyMode(game: Phaser.Game, mode: Mode, animate = true) {
  const drop = game.scene.getScene('drop');
  const factory = game.scene.getScene('factory');
  if (!drop?.sys || !factory?.sys) return;
  const show = mode === 'drop' ? drop : factory;
  const hide = mode === 'drop' ? factory : drop;
  hide.sys.setVisible(false);
  hide.input.enabled = false;
  show.sys.setVisible(true);
  show.input.enabled = true;
  game.scene.bringToTop(show.sys.settings.key);
  if (animate && !store.state.settings.reducedMotion) show.cameras.main.fadeIn(260, 10, 4, 30);
}

/** Logical height for the current host aspect ratio (width is always 1080 units). */
function logicalHeight(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return 1500;
  return Math.round(Math.max(1180, Math.min(2100, (WORLD_WIDTH * r.height) / r.width)));
}

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#120838',
    width: WORLD_WIDTH,
    height: logicalHeight(parent),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
    fps: { target: 60, smoothStep: false },
    input: { activePointers: 3 },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, DropScene, FactoryScene],
  });

  (window as any).__PHASER_GAME__ = game;
  const offMode = store.events.on('modeChanged', (m) => applyMode(game, m));
  const offSettings = store.events.on('settings', (s) => (sfx.enabled = s.sound));
  sfx.enabled = store.state.settings.sound;

  const ro = new ResizeObserver(() => {
    const h = logicalHeight(parent);
    if (Math.abs(h - game.scale.gameSize.height) > 4) game.scale.setGameSize(WORLD_WIDTH, h);
    else game.scale.refresh();
  });
  ro.observe(parent);

  game.events.once('destroy', () => {
    offMode();
    offSettings();
    ro.disconnect();
  });
  return game;
}
