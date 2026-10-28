// Stress test: maxes production for N seconds and reports JS frame cost and stability.
const { chromium, devices } = require('playwright');
const url = process.argv[2] || 'http://localhost:5173/';
const seconds = Number(process.argv[3] || 45);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'debug');
  await page.waitForFunction(() => window.__PHASER_GAME__ && window.__PHASER_GAME__.scene.getScene('drop')?.time0 > 0);
  await page.evaluate(() => {
    const s = window.__MM__;
    Object.assign(s.state.drop.upgrades, { value: 120, rate: 25, dropper: 4, gates: 60, bins: 50, obstacles: 3 });
    s.state.drop.board = 2;
    s.state.level = 30;
    s.state.lifetimeEarned = s.state.money.constructor.fromNumber(1e30);
    s.state.factory.upgrades.speed = 25;
    s.state.factory.slotsUnlocked = 8;
    s.state.factory.wheels = [10, 10, 10, 10, 10, 10, 10, 10];
    s.statsChanged();
    s.events.emit('slotsExpanded', 8);
    const g = window.__PHASER_GAME__;
    window.__prof = { js: 0, frames: 0, maxCoins: 0, maxItems: 0 };
    let t = 0;
    g.events.on('prestep', () => (t = performance.now()));
    g.events.on('postrender', () => {
      window.__prof.js += performance.now() - t;
      window.__prof.frames++;
      window.__prof.maxCoins = Math.max(window.__prof.maxCoins, g.scene.getScene('drop').coins.length);
      window.__prof.maxItems = Math.max(window.__prof.maxItems, g.scene.getScene('factory').items.length);
    });
  });
  const m0 = await page.evaluate(() => window.__MM__.state.money.toString());
  const c0 = await page.evaluate(() => window.__MM__.state.stats.coinsCollected);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  await page.screenshot({ path: process.argv[4] || 'stress.png' });
  // also the factory
  await page.evaluate(() => window.__MM__.setMode('factory'));
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: (process.argv[4] || 'stress.png').replace('.png', '-factory.png') });
  const r = await page.evaluate(() => ({ ...window.__prof, msPerFrame: window.__prof.js / window.__prof.frames, simTime: window.__PHASER_GAME__.scene.getScene('drop').time0, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, money: window.__MM__.state.money.toString(), coins: window.__MM__.state.stats.coinsCollected, rate: window.__MM__.measuredRate(10).toString() }));
  console.log(JSON.stringify({ m0, c0, ...r, errors }, null, 2));
  await browser.close();
})();
