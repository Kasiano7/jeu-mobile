// Renders public/favicon.svg to the PNG sizes required by the PWA manifest / iOS.
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');
(async () => {
  const pub = path.join(__dirname, '..', 'public');
  const svg = readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-512-maskable.png', 512, 0.1], ['apple-touch-icon.png', 180, 0]]) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await page.setContent(`<body style="margin:0;background:#1b0f3b;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body>`);
    await page.screenshot({ path: path.join(pub, name) });
  }
  await browser.close();
})();
