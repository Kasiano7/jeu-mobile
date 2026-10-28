// Builds public/og-image.png (1200x630 social preview) from two real in-game screenshots.
// Usage: node scripts/og-image.cjs [url]   (needs `npm run dev` or `npm run preview` running)
const { chromium, devices } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const url = process.argv[2] || 'http://localhost:4173/';
const root = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(url + '?debug');
  await page.waitForFunction(() => window.__PHASER_GAME__?.scene.getScene('drop')?.time0 > 0);
  await page.evaluate(() => {
    const s = window.__MM__;
    Object.assign(s.state.drop.upgrades, { value: 40, rate: 12, dropper: 2, gates: 20, bins: 15, obstacles: 2 });
    s.state.drop.board = 2;
    s.state.level = 14;
    s.state.stats.taps = 10;
    s.state.lifetimeEarned = s.state.money.constructor.fromNumber(5e9);
    s.state.money = s.state.money.constructor.fromNumber(2.48e9);
    s.state.factory.wheels = [6, 5, 4, 3, 2, 1];
    s.state.factory.slotsUnlocked = 6;
    s.state.factory.upgrades.speed = 8;
    s.statsChanged();
    s.events.emit('slotsExpanded', 6);
    s.stopAutosave();
    const d = window.__PHASER_GAME__.scene.getScene('drop');
    for (let i = 0; i < 60 * 8; i++) d.fixedStep();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const drop = await page.locator('.stage').screenshot();
  await page.evaluate(() => window.__MM__.setMode('factory'));
  await new Promise((r) => setTimeout(r, 4000));
  const factory = await page.locator('.stage').screenshot();
  await ctx.close();

  const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2')).toString('base64');
  const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: L; src: url('${font}'); }
    body { margin:0; width:1200px; height:630px; overflow:hidden; font-family:L;
      background: radial-gradient(900px 500px at 20% 0%, #5a2fc2, transparent 60%), radial-gradient(700px 500px at 100% 100%, #0f3b5f, transparent 60%), #1b0f3b; color:#fff; }
    .t { position:absolute; left:64px; top:150px; width:560px; }
    h1 { margin:0; font-size:104px; line-height:.95; color:#fff3b0; text-shadow:0 8px 0 #6b2a00, 0 0 40px rgba(255,201,60,.45); font-weight:400 }
    p { font-size:36px; margin:28px 0 0; color:#38e8c6; text-shadow:0 4px 0 #0d4a3e }
    .tag { display:inline-block; margin-top:30px; padding:12px 26px; border-radius:22px; font-size:30px; color:#5a2a00;
      background:linear-gradient(#ffe27a,#ffaa1c); box-shadow:0 6px 0 #a35a00 }
    img { position:absolute; top:48px; height:530px; border-radius:28px; box-shadow:0 0 0 6px #0b0420, 0 30px 60px rgba(0,0,0,.6) }
  </style></head><body>
    <div class="t"><h1>MONEY<br>MACHINE</h1><p>Fais pleuvoir l'argent !</p><div class="tag">Jouer gratuitement</div></div>
    <img src="${b64(factory)}" style="left:880px; transform:rotate(5deg)">
    <img src="${b64(drop)}" style="left:630px; transform:rotate(-4deg)">
  </body></html>`);
  await og.evaluate(() => document.fonts.ready);
  await og.waitForTimeout(300);
  await og.screenshot({ path: path.join(root, 'public/og-image.png') });
  await browser.close();
  console.log('public/og-image.png written', fs.statSync(path.join(root, 'public/og-image.png')).size, 'bytes');
})();
