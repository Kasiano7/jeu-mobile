import Phaser from 'phaser';
import { DEBUG } from '../core/debug';
import { store } from '../core/instance';
import { DropScene } from './drop/DropScene';
import { FactoryScene } from './factory/FactoryScene';
import { applyMode } from './mode';
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
    this.game.events.emit('mm-ready');
  }
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
    // windowEvents off: taps on React overlays must never reach game objects under them.
    input: { activePointers: 3, windowEvents: false },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, DropScene, FactoryScene],
  });

  if (DEBUG) (window as any).__PHASER_GAME__ = game;
  const offMode = store.events.on('modeChanged', (m) => applyMode(game, m, true));
  const offSettings = store.events.on('settings', (s) => (sfx.enabled = s.sound));
  sfx.enabled = store.state.settings.sound;

  const ro = new ResizeObserver(() => {
    const h = logicalHeight(parent);
    if (Math.abs(h - game.scale.gameSize.height) > 4) game.scale.setGameSize(WORLD_WIDTH, h);
    else game.scale.refresh(); // CSS size only; scenes ignore resizes that keep the logical size
  });
  ro.observe(parent);

  game.events.once('destroy', () => {
    offMode();
    offSettings();
    ro.disconnect();
  });
  return game;
}
