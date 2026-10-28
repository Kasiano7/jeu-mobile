// Browser smoke test: boots the game on an iPhone-sized viewport and checks the
// real gameplay loop (coins fall, money is credited, upgrades, factory, reload).
// Usage: node scripts/smoke.cjs [url] [screenshotDir]
const { chromium, devices } = require('playwright');
const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const tall = process.env.TALL !== '0';
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ...(tall ? { viewport: { width: 390, height: 844 } } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__MM__ && document.querySelector('canvas'), null, { timeout: 15000 });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const money = () => S(() => window.__MM__.state.money.toNumber());
  const report = {};

  await sleep(6000);
  report.moneyAfter6s = await money();
  report.coinsCollected = await S(() => window.__MM__.state.stats.coinsCollected);
  await page.screenshot({ path: `${out}/01-drop.png` });

  // Tap the board a few times to drop coins manually.
  const box = await page.locator('canvas').boundingBox();
  for (let i = 0; i < 6; i++) await page.touchscreen.tap(box.x + box.width * (0.2 + i * 0.12), box.y + box.height * 0.3);
  await sleep(300);
  await page.screenshot({ path: `${out}/02-taps.png` });

  // Buy the first value upgrade with real money.
  await page.waitForFunction(() => window.__MM__.state.money.gte(window.__MM__.dropUpgradeCost('value')), null, { timeout: 30000 });
  const v0 = await S(() => window.__MM__.dropStats.coinValue.toNumber());
  await page.getByTestId('up-value').click();
  report.valueLevel = await S(() => window.__MM__.state.drop.upgrades.value);
  report.coinValueBeforeAfter = [v0, await S(() => window.__MM__.dropStats.coinValue.toNumber())];

  // Fast-forward progression with real credits so the factory unlocks.
  await S(() => window.__MM__.earn(new window.__MM__.state.money.constructor(5e5), 'reward'));
  await sleep(4000);
  await page.screenshot({ path: `${out}/03-levelup.png` });
  await page.mouse.click(box.x + 10, box.y + 10); // dismiss celebration
  await sleep(300);
  for (let i = 0; i < 4; i++) await page.getByTestId('up-gates').click().catch(() => {});
  for (let i = 0; i < 3; i++) await page.getByTestId('up-bins').click().catch(() => {});
  await page.getByTestId('up-dropper').click().catch(() => {});
  await page.getByTestId('up-obstacles').click().catch(() => {});
  await sleep(5000);
  await page.screenshot({ path: `${out}/04-drop-upgraded.png` });

  await page.getByTestId('to-factory').click();
  await sleep(1200);
  report.mode = await S(() => window.__MM__.mode);
  await page.getByTestId('fac-wheel').click();
  await sleep(600);
  await page.getByTestId('fac-wheel').click();
  await sleep(2500);
  report.wheels = await S(() => window.__MM__.state.factory.wheels.length);
  report.itemsProcessed0 = await S(() => window.__MM__.state.stats.itemsProcessed);
  await sleep(6000);
  report.itemsProcessed1 = await S(() => window.__MM__.state.stats.itemsProcessed);
  await page.screenshot({ path: `${out}/05-factory.png` });

  // Cards
  await page.getByTestId('fac-return').click();
  await sleep(500);
  await page.getByTestId('tab-cards').click();
  await page.getByTestId('buy-pack').click();
  await sleep(800);
  await page.screenshot({ path: `${out}/06-cards.png` });
  await sleep(2600);

  // Persistence
  const before = await S(() => ({ money: window.__MM__.state.money.toString(), wheels: window.__MM__.state.factory.wheels.length, value: window.__MM__.state.drop.upgrades.value }));
  await S(() => window.__MM__.save());
  await page.reload();
  await page.waitForFunction(() => window.__MM__ && document.querySelector('canvas'), null, { timeout: 15000 });
  const after = await S(() => ({ money: window.__MM__.state.money.toString(), wheels: window.__MM__.state.factory.wheels.length, value: window.__MM__.state.drop.upgrades.value }));
  report.persist = { before, after };
  await sleep(1500);
  await page.screenshot({ path: `${out}/07-reloaded.png` });
  // Offline gains: pretend the player left one hour ago.
  await S(() => {
    window.__MM__.stopAutosave();
    window.__MM__.save();
    const key = 'money-machine.save.v1';
    const o = JSON.parse(localStorage.getItem(key));
    o.lastSeen -= 3600_000;
    o.incomeRate = '100';
    localStorage.setItem(key, JSON.stringify(o));
    window.__MM__.save = () => {}; // keep the edited save through the pagehide handler
  });
  await page.reload();
  await page.getByTestId('collect-offline').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${out}/08-offline.png` });
  const mOff0 = await money();
  await page.getByTestId('collect-offline').click();
  report.offlineGain = (await money()) - mOff0;
  report.fps = await S(() => (window.__PHASER_GAME__ ? window.__PHASER_GAME__.loop.actualFps : null));
  report.errors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
