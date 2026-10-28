/** Debug/test hooks (window.__MM__, window.__PHASER_GAME__) only in dev or with ?debug. */
export const DEBUG =
  import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'));
