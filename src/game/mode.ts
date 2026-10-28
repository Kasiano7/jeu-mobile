import Phaser from 'phaser';
import { store } from '../core/instance';
import type { Mode } from '../core/types';

/**
 * Shows one machine and keeps the other simulating in the background (real production).
 * Each scene also calls this at the end of create(): Systems.start() would otherwise
 * re-enable visibility/input of a scene launched after the mode was applied.
 */
export function applyMode(game: Phaser.Game, mode: Mode = store.mode, animate = false) {
  const drop = game.scene.getScene('drop');
  const factory = game.scene.getScene('factory');
  const show = mode === 'drop' ? drop : factory;
  const hide = mode === 'drop' ? factory : drop;
  if (hide?.sys?.settings) {
    hide.sys.setVisible(false);
    if (hide.input) hide.input.enabled = false;
  }
  if (show?.sys?.settings) {
    show.sys.setVisible(true);
    if (show.input) show.input.enabled = true;
    if (show.sys.isActive()) game.scene.bringToTop(show.sys.settings.key);
    if (animate && !store.state.settings.reducedMotion) show.cameras?.main?.fadeIn(260, 10, 4, 30);
  }
}
