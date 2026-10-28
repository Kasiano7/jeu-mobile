import Phaser from 'phaser';
import { FONT_FAMILY } from './font';

/**
 * All art is generated procedurally on canvas at boot: no external image assets,
 * instant start, crisp at the 1080-unit world resolution.
 */

type Ctx = CanvasRenderingContext2D;

export const COIN_RADIUS = 44;
export const PEG_RADIUS = 13;
export const BUMPER_RADIUS = 40;

export interface Tier {
  base: string;
  light: string;
  dark: string;
  rim: string;
}

export const COIN_TIERS: Tier[] = [
  { base: '#e08a4f', light: '#ffd0a0', dark: '#9a4a1a', rim: '#6b2f0c' }, // copper
  { base: '#cfd8e6', light: '#ffffff', dark: '#8390a3', rim: '#545d6c' }, // silver
  { base: '#ffc93c', light: '#fff4b8', dark: '#d68600', rim: '#8f5400' }, // gold
  { base: '#2fd27a', light: '#c4ffdf', dark: '#0f8a48', rim: '#08552c' }, // emerald
  { base: '#3d8bff', light: '#c7e0ff', dark: '#1a4fb8', rim: '#0f2f73' }, // sapphire
  { base: '#ff4f6d', light: '#ffc8d1', dark: '#b81d3a', rim: '#6e0b1e' }, // ruby
  { base: '#b06bff', light: '#ead8ff', dark: '#6b2bc0', rim: '#3f1678' }, // amethyst
  { base: '#86f6ff', light: '#ffffff', dark: '#28a5d4', rim: '#155f80' }, // diamond
];

export const ITEM_TIERS: Tier[] = [
  { base: '#5ccf6a', light: '#c8f7c0', dark: '#2f8a3b', rim: '#1d5a26' },
  { base: '#3fd0c0', light: '#c6fff6', dark: '#1a8f84', rim: '#0f5a53' },
  { base: '#4b9bff', light: '#cfe4ff', dark: '#2259c4', rim: '#163a80' },
  { base: '#a06bff', light: '#e6d6ff', dark: '#6330c4', rim: '#3c1a7d' },
  { base: '#ffc93c', light: '#fff4b8', dark: '#d68600', rim: '#8f5400' },
  { base: '#ff7a3d', light: '#ffd6bd', dark: '#c2470f', rim: '#7a2a05' },
  { base: '#ff4f9a', light: '#ffd0e6', dark: '#c21a66', rim: '#7a0b3e' },
  { base: '#e8f6ff', light: '#ffffff', dark: '#8fc7e6', rim: '#4d7d99' },
];

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h))!;
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
  return tex;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export function shade(color: string, amt: number): string {
  const n = parseInt(color.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* --------------------------------- Coins ---------------------------------- */

function drawCoin(ctx: Ctx, cx: number, cy: number, r: number, t: Tier, star = false) {
  // soft drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(10,0,30,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 6, r, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // rim
  ctx.fillStyle = t.rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // body gradient
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, t.light);
  g.addColorStop(0.45, t.base);
  g.addColorStop(1, t.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.fill();
  // reeded edge
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    ctx.stroke();
  }
  // embossed inner ring
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1.5, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(cx - 1, cy - 1, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  // inner face
  const g2 = ctx.createLinearGradient(cx, cy - r * 0.7, cx, cy + r * 0.7);
  g2.addColorStop(0, shade(t.base, 0.15));
  g2.addColorStop(1, shade(t.base, -0.15));
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.69, 0, Math.PI * 2);
  ctx.fill();
  if (star) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    drawStar(ctx, cx, cy, 5, r * 0.6, r * 0.28);
    ctx.fill();
  }
  // specular highlight
  ctx.save();
  ctx.globalAlpha = 0.55;
  const hg = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 1, cx - r * 0.38, cy - r * 0.45, r * 0.55);
  hg.addColorStop(0, 'rgba(255,255,255,0.95)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStar(ctx: Ctx, cx: number, cy: number, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* ------------------------------ Factory items ------------------------------ */

function drawBill(ctx: Ctx, w: number, h: number, t: Tier) {
  const bw = w - 10;
  const bh = h - 16;
  // stack layers
  for (let i = 3; i >= 0; i--) {
    const ox = 5 + i * 1.5;
    const oy = 4 + i * 3;
    ctx.fillStyle = i === 0 ? t.base : shade(t.base, -0.25 - i * 0.05);
    roundRect(ctx, ox, oy, bw, bh, 7);
    ctx.fill();
    ctx.strokeStyle = t.rim;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const ox = 5;
  const oy = 4;
  const g = ctx.createLinearGradient(0, oy, 0, oy + bh);
  g.addColorStop(0, t.light);
  g.addColorStop(0.5, t.base);
  g.addColorStop(1, t.dark);
  ctx.fillStyle = g;
  roundRect(ctx, ox, oy, bw, bh, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, ox + 5, oy + 5, bw - 10, bh - 10, 4);
  ctx.stroke();
  // central medallion
  ctx.fillStyle = shade(t.base, -0.2);
  ctx.beginPath();
  ctx.ellipse(ox + bw / 2, oy + bh / 2, bh * 0.36, bh * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // paper band
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(ox + bw * 0.18, oy, bw * 0.12, bh);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(ox + bw * 0.18, oy, bw * 0.03, bh);
}

/* ----------------------------------- Misc ---------------------------------- */

function radialBlob(ctx: Ctx, cx: number, cy: number, r: number, inner: string, outer: string) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

export function generateBaseTextures(scene: Phaser.Scene) {
  const cs = COIN_RADIUS * 2 + 14;
  COIN_TIERS.forEach((t, i) => {
    canvasTex(scene, `coin${i}`, cs, cs, (ctx) => drawCoin(ctx, cs / 2 - 2, cs / 2 - 3, COIN_RADIUS, t, i === 7));
  });
  canvasTex(scene, 'coinLucky', cs, cs, (ctx) => drawCoin(ctx, cs / 2 - 2, cs / 2 - 3, COIN_RADIUS, COIN_TIERS[2], true));

  ITEM_TIERS.forEach((t, i) => canvasTex(scene, `item${i}`, 104, 72, (ctx, w, h) => drawBill(ctx, w, h, t)));

  // Peg: shiny metal stud (white so it can be tinted per board palette)
  canvasTex(scene, 'peg', 40, 40, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(21, 23, PEG_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    radialBlob(ctx, 20, 20, PEG_RADIUS, '#ffffff', '#9aa3b8');
    ctx.strokeStyle = 'rgba(40,30,70,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(20, 20, PEG_RADIUS - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(16, 15, 4, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Wall bump: metal half-dome bolted to the left wall (flipped for the right wall)
  canvasTex(scene, 'wallBump', 40, 76, (ctx) => {
    const r = 30;
    const cy = 38;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 40, 76);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(2, cy + 4, r, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    const g = ctx.createRadialGradient(8, cy - 10, 2, 0, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#8a93ab');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, cy, r, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,70,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });

  // Bumper: pink mushroom bumper with a star
  const bs = BUMPER_RADIUS * 2 + 16;
  canvasTex(scene, 'bumper', bs, bs, (ctx) => {
    const c = bs / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(c + 2, c + 6, BUMPER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    radialBlob(ctx, c, c, BUMPER_RADIUS, '#ffffff', '#c0124f');
    ctx.fillStyle = '#ff3d7f';
    ctx.beginPath();
    ctx.arc(c, c, BUMPER_RADIUS - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffd1e3';
    ctx.beginPath();
    ctx.arc(c, c, BUMPER_RADIUS - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff36b';
    drawStar(ctx, c, c, 5, 20, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(c - 14, c - 18, 10, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Spinner bar
  canvasTex(scene, 'spinner', 240, 40, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 4, 0, h - 4);
    g.addColorStop(0, '#fff2a8');
    g.addColorStop(0.5, '#ffb400');
    g.addColorStop(1, '#b86b00');
    ctx.fillStyle = g;
    roundRect(ctx, 4, 6, w - 8, h - 12, 14);
    ctx.fill();
    ctx.strokeStyle = '#6b3d00';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, 4, 6, w - 8, h - 12, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(80,40,0,0.35)';
    for (let x = -20; x < w; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 12, h);
      ctx.lineTo(x + 30, 0);
      ctx.lineTo(x + 18, 0);
      ctx.fill();
    }
    ctx.restore();
    radialBlob(ctx, w / 2, h / 2, 15, '#ffffff', '#8a8fa3');
  });

  // Golden orb + glow
  canvasTex(scene, 'orb', 110, 110, (ctx) => {
    radialBlob(ctx, 55, 55, 44, '#fffbe0', '#ff9d00');
    ctx.strokeStyle = '#fff6b0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(55, 55, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(60, 22);
    ctx.lineTo(38, 60);
    ctx.lineTo(54, 60);
    ctx.lineTo(48, 88);
    ctx.lineTo(72, 48);
    ctx.lineTo(56, 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c46a00';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  canvasTex(scene, 'glow', 128, 128, (ctx) => radialBlob(ctx, 64, 64, 64, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'));

  // Particles
  canvasTex(scene, 'spark', 32, 32, (ctx) => {
    ctx.fillStyle = '#ffffff';
    drawStar(ctx, 16, 16, 4, 15, 4);
    ctx.fill();
  });
  canvasTex(scene, 'dot', 20, 20, (ctx) => radialBlob(ctx, 10, 10, 10, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  canvasTex(scene, 'confetti', 14, 22, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 0, 0, w, h, 3);
    ctx.fill();
  });
  canvasTex(scene, 'miniCoin', 40, 40, (ctx) => drawCoin(ctx, 19, 18, 16, COIN_TIERS[2]));

  generateMachineTextures(scene);
  generateFactoryTextures(scene);
}

/* ------------------------------- Drop machine ------------------------------ */

function generateMachineTextures(scene: Phaser.Scene) {
  // Dropper machine (generator) - neutral so it can be tinted? No: drawn in full colour.
  canvasTex(scene, 'dropper', 190, 170, (ctx, w) => {
    // funnel
    const fg = ctx.createLinearGradient(0, 110, 0, 165);
    fg.addColorStop(0, '#4b4f66');
    fg.addColorStop(1, '#1f2133');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 50, 112);
    ctx.lineTo(w / 2 + 50, 112);
    ctx.lineTo(w / 2 + 30, 160);
    ctx.lineTo(w / 2 - 30, 160);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#12131f';
    roundRect(ctx, w / 2 - 34, 152, 68, 14, 6);
    ctx.fill();
    // body
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, 12, 18, w - 20, 100, 26);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 10, 0, 112);
    g.addColorStop(0, '#ffcf5a');
    g.addColorStop(0.5, '#ff9f1c');
    g.addColorStop(1, '#d4570b');
    ctx.fillStyle = g;
    roundRect(ctx, 8, 10, w - 16, 102, 26);
    ctx.fill();
    ctx.strokeStyle = '#7a2a00';
    ctx.lineWidth = 4;
    ctx.stroke();
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, 22, 16, w - 44, 22, 11);
    ctx.fill();
    // front plate
    ctx.fillStyle = '#2a1446';
    roundRect(ctx, w / 2 - 42, 40, 84, 58, 14);
    ctx.fill();
    ctx.fillStyle = '#38e8c6';
    ctx.font = `52px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', w / 2, 72);
    // bolts
    ctx.fillStyle = '#7a2a00';
    for (const [bx, by] of [
      [24, 60],
      [w - 24, 60],
      [24, 92],
      [w - 24, 92],
    ]) {
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  canvasTex(scene, 'dropperLight', 26, 26, (ctx) => radialBlob(ctx, 13, 13, 13, '#ffffff', 'rgba(56,232,198,0)'));
}

/* -------------------------------- Factory art ------------------------------ */

export const WHEEL_RADIUS = 86;

function generateFactoryTextures(scene: Phaser.Scene) {
  const ws = WHEEL_RADIUS * 2 + 12;
  // Locomotive-style spoked wheel (rotates as a whole)
  const wheelColors = ['#e8463c', '#2f9bff', '#2fd27a', '#b06bff', '#ffb400'];
  wheelColors.forEach((col, idx) => {
    canvasTex(scene, `wheel${idx}`, ws, ws, (ctx) => {
      const c = ws / 2;
      const R = WHEEL_RADIUS;
      // tire
      radialBlob(ctx, c, c, R, '#5a5f73', '#23263a');
      ctx.strokeStyle = '#9aa3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c, c, R - 3, 0, Math.PI * 2);
      ctx.stroke();
      // rim
      ctx.strokeStyle = col;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(c, c, R - 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c, c, R - 20, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      // spokes
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.strokeStyle = shade(col, -0.25);
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 20, c + Math.sin(a) * 20);
        ctx.lineTo(c + Math.cos(a) * (R - 20), c + Math.sin(a) * (R - 20));
        ctx.stroke();
        ctx.strokeStyle = shade(col, 0.2);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 20, c + Math.sin(a) * 20 - 2);
        ctx.lineTo(c + Math.cos(a) * (R - 22), c + Math.sin(a) * (R - 22) - 2);
        ctx.stroke();
      }
      // counterweight crescent (opposite the crank pin at angle 0)
      ctx.fillStyle = shade(col, -0.35);
      ctx.beginPath();
      ctx.arc(c, c, R - 22, Math.PI * 0.7, Math.PI * 1.3);
      ctx.arc(c - (R - 22) * 0.45, c, (R - 22) * 0.62, Math.PI * 1.32, Math.PI * 0.68, true);
      ctx.closePath();
      ctx.fill();
      // hub
      radialBlob(ctx, c, c, 28, '#ffffff', '#8a8fa3');
      ctx.strokeStyle = '#3a3f55';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c, c, 27, 0, Math.PI * 2);
      ctx.stroke();
      // crank boss at angle 0
      radialBlob(ctx, c + R * 0.55, c, 13, '#f2f4ff', '#6a7088');
    });
  });

  // Small gear
  const gearTex = (key: string, r: number, teeth: number, col: string) =>
    canvasTex(scene, key, r * 2 + 16, r * 2 + 16, (ctx) => {
      const c = r + 8;
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * Math.PI * 2;
        const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r + 7 : r - 2;
        ctx.arc(c, c, rr, a0, a1);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(col, -0.45);
      ctx.lineWidth = 3;
      ctx.stroke();
      radialBlob(ctx, c, c, r * 0.72, shade(col, 0.35), shade(col, -0.2));
      ctx.fillStyle = shade(col, -0.5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * r * 0.45, c + Math.sin(a) * r * 0.45, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
      radialBlob(ctx, c, c, r * 0.22, '#ffffff', '#7d8299');
    });
  gearTex('gearBig', 56, 14, '#c7cede');
  gearTex('gearSmall', 34, 9, '#ffb400');

  // Pulley (belt drum)
  canvasTex(scene, 'pulley', 100, 100, (ctx) => {
    radialBlob(ctx, 50, 50, 46, '#d7dcea', '#4b5066');
    ctx.strokeStyle = '#2a2d40';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(50, 50, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2a2d40';
    ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36);
      ctx.stroke();
    }
    radialBlob(ctx, 50, 50, 12, '#ffffff', '#7d8299');
  });

  // Belt cleat
  canvasTex(scene, 'cleat', 16, 40, (ctx, w, h) => {
    ctx.fillStyle = '#5b6078';
    roundRect(ctx, 2, 2, w - 4, h - 4, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(4, 4, 3, h - 8);
  });

  // Press head (slider)
  canvasTex(scene, 'press', 92, 44, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f2f4ff');
    g.addColorStop(0.5, '#9aa3b8');
    g.addColorStop(1, '#4b5066');
    ctx.fillStyle = g;
    roundRect(ctx, 2, 2, w - 4, h - 4, 10);
    ctx.fill();
    ctx.strokeStyle = '#2a2d40';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffb400';
    for (let x = 10; x < w - 10; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, h - 8);
      ctx.lineTo(x + 9, 8);
      ctx.lineTo(x + 15, 8);
      ctx.lineTo(x + 6, h - 8);
      ctx.fill();
    }
  });

  // Hopper (production entrance)
  canvasTex(scene, 'hopper', 220, 190, (ctx, w) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(14, 18);
    ctx.lineTo(w - 6, 18);
    ctx.lineTo(w / 2 + 44, 150);
    ctx.lineTo(w / 2 - 36, 150);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#2f9bff');
    g.addColorStop(0.5, '#7cc4ff');
    g.addColorStop(1, '#1a5fc4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 10);
    ctx.lineTo(w - 8, 10);
    ctx.lineTo(w / 2 + 40, 142);
    ctx.lineTo(w / 2 - 40, 142);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0d2f66';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#0d2f66';
    roundRect(ctx, w / 2 - 46, 138, 92, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    roundRect(ctx, 0, 0, w, 24, 10);
    ctx.fill();
    ctx.strokeStyle = '#8f5400';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `30px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('INPUT', w / 2, 72);
  });

  // Vault (collection zone)
  canvasTex(scene, 'vault', 230, 200, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, 12, 18, w - 16, h - 20, 24);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9aa3b8');
    g.addColorStop(1, '#3a3f55');
    ctx.fillStyle = g;
    roundRect(ctx, 6, 8, w - 16, h - 22, 24);
    ctx.fill();
    ctx.strokeStyle = '#1e2133';
    ctx.lineWidth = 5;
    ctx.stroke();
    // opening on top
    ctx.fillStyle = '#12131f';
    roundRect(ctx, 30, 14, w - 76, 20, 8);
    ctx.fill();
    // door
    radialBlob(ctx, w / 2 - 5, h / 2 + 12, 58, '#e3e7f2', '#5b6078');
    ctx.strokeStyle = '#1e2133';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2 - 5, h / 2 + 12, 56, 0, Math.PI * 2);
    ctx.stroke();
    // dial spokes
    ctx.strokeStyle = '#ffb400';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 5, h / 2 + 12);
      ctx.lineTo(w / 2 - 5 + Math.cos(a) * 40, h / 2 + 12 + Math.sin(a) * 40);
      ctx.stroke();
    }
    radialBlob(ctx, w / 2 - 5, h / 2 + 12, 14, '#fff6c2', '#c48a00');
  });

  // Motor block
  canvasTex(scene, 'motor', 150, 120, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, 8, 12, w - 10, h - 14, 18);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ff6b8b');
    g.addColorStop(1, '#b81d4a');
    ctx.fillStyle = g;
    roundRect(ctx, 4, 6, w - 12, h - 14, 18);
    ctx.fill();
    ctx.strokeStyle = '#5a0a24';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 22; y < h - 20; y += 14) {
      roundRect(ctx, 16, y, w - 36, 7, 3);
      ctx.fill();
    }
    ctx.fillStyle = '#fff36b';
    ctx.beginPath();
    ctx.moveTo(w / 2 + 4, 18);
    ctx.lineTo(w / 2 - 18, 62);
    ctx.lineTo(w / 2 - 2, 62);
    ctx.lineTo(w / 2 - 8, 98);
    ctx.lineTo(w / 2 + 18, 50);
    ctx.lineTo(w / 2 + 2, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a3d00';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

/* ------------------------------ Dynamic textures --------------------------- */

export function gateTexture(scene: Phaser.Scene, kind: 'add' | 'mult' | 'split', width: number, height: number) {
  const key = `gate-${kind}-${Math.round(width)}-${Math.round(height)}`;
  if (scene.textures.exists(key)) return key;
  const col = kind === 'add' ? ['#4dff9a', '#13a85a', '#0a5c30'] : kind === 'mult' ? ['#8fd0ff', '#4b5bff', '#241a8a'] : ['#ffb3e6', '#ff3dab', '#7a0b52'];
  canvasTex(scene, key, width + 16, height + 16, (ctx) => {
    const x = 8;
    const y = 8;
    // outer glow
    ctx.shadowColor = col[0];
    ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(0, y, 0, y + height);
    g.addColorStop(0, col[0]);
    g.addColorStop(0.55, col[1]);
    g.addColorStop(1, col[2]);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    roundRect(ctx, x, y, width, height, height / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 1.5, y + 1.5, width - 3, height - 3, height / 2);
    ctx.stroke();
    // chevrons pointing down (flow direction)
    ctx.save();
    roundRect(ctx, x, y, width, height, height / 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 6;
    for (let cx = x - 10; cx < x + width + 20; cx += 30) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, y + height * 0.3);
      ctx.lineTo(cx, y + height * 0.7);
      ctx.lineTo(cx + 10, y + height * 0.3);
      ctx.stroke();
    }
    // glass highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, x + height * 0.4, y + 4, width - height * 0.8, height * 0.28, height * 0.14);
    ctx.fill();
    ctx.restore();
  });
  return key;
}

export function binWallTexture(scene: Phaser.Scene, height: number, color: string) {
  const key = `binwall-${Math.round(height)}-${color}`;
  if (scene.textures.exists(key)) return key;
  canvasTex(scene, key, 30, height + 10, (ctx, w) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, shade(color, -0.4));
    g.addColorStop(0.45, shade(color, 0.35));
    g.addColorStop(1, shade(color, -0.4));
    ctx.fillStyle = g;
    roundRect(ctx, 5, 5, w - 10, height, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  return key;
}

export interface BoardBgSpec {
  key: string;
  width: number;
  height: number;
  bg1: number;
  bg2: number;
  frame: number;
  accent: number;
  bins: { x0: number; x1: number; mult: number; jackpot?: boolean }[];
  binTop: number;
  binBottom: number;
  railY: number;
}

export function binColor(mult: number, jackpot?: boolean): string {
  if (jackpot) return '#ff3dab';
  if (mult >= 10) return '#ff4f6d';
  if (mult >= 5) return '#ff9f1c';
  if (mult >= 3) return '#ffd23f';
  if (mult >= 2) return '#2fd27a';
  if (mult >= 1.5) return '#38c6e8';
  return '#7b8cff';
}

export function boardBackground(scene: Phaser.Scene, spec: BoardBgSpec) {
  canvasTex(scene, spec.key, spec.width, spec.height, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(spec.bg1));
    g.addColorStop(1, hex(spec.bg2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // diagonal light stripes
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    for (let x = -h; x < w; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 50, h);
      ctx.lineTo(x + 50 + h * 0.6, 0);
      ctx.lineTo(x + h * 0.6, 0);
      ctx.fill();
    }
    ctx.restore();
    // dot grid
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 40; y < h; y += 60) for (let x = 30; x < w; x += 60) ctx.fillRect(x, y, 4, 4);
    // top rail
    const rg = ctx.createLinearGradient(0, spec.railY - 14, 0, spec.railY + 14);
    rg.addColorStop(0, '#d7dcea');
    rg.addColorStop(0.5, '#7d8299');
    rg.addColorStop(1, '#3a3f55');
    ctx.fillStyle = rg;
    roundRect(ctx, 20, spec.railY - 12, w - 40, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#2a2d40';
    for (let x = 60; x < w - 40; x += 120) {
      ctx.beginPath();
      ctx.arc(x, spec.railY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // bins
    for (const b of spec.bins) {
      const col = binColor(b.mult, b.jackpot);
      const bg = ctx.createLinearGradient(0, spec.binTop, 0, spec.binBottom);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.35, shade(col, -0.55));
      bg.addColorStop(1, shade(col, -0.25));
      ctx.fillStyle = bg;
      roundRect(ctx, b.x0 + 4, spec.binTop, b.x1 - b.x0 - 8, spec.binBottom - spec.binTop, 16);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // floor
    const fg = ctx.createLinearGradient(0, spec.binBottom, 0, h);
    fg.addColorStop(0, hex(spec.frame));
    fg.addColorStop(1, shade(hex(spec.frame), -0.5));
    ctx.fillStyle = fg;
    ctx.fillRect(0, spec.binBottom, w, h - spec.binBottom);
    // frame
    ctx.strokeStyle = hex(spec.frame);
    ctx.lineWidth = 14;
    roundRect(ctx, 7, 7, w - 14, h - 14, 36);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    roundRect(ctx, 14, 14, w - 28, h - 28, 30);
    ctx.stroke();
    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    // bolts
    ctx.fillStyle = shade(hex(spec.frame), -0.4);
    for (const [bx, by] of [
      [30, 30],
      [w - 30, 30],
      [30, h - 30],
      [w - 30, h - 30],
    ]) {
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function factoryBackground(scene: Phaser.Scene, key: string, w: number, h: number) {
  canvasTex(scene, key, w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#26315c');
    g.addColorStop(1, '#0f1430');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // brick / panel pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 70) {
      const off = (y / 70) % 2 === 0 ? 0 : 80;
      for (let x = -off; x < w; x += 160) ctx.strokeRect(x, y, 160, 70);
    }
    // hazard stripes at the bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, h - 36, w, 36);
    ctx.clip();
    ctx.fillStyle = '#ffb400';
    ctx.fillRect(0, h - 36, w, 36);
    ctx.fillStyle = '#1e2133';
    for (let x = -40; x < w + 40; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 30, h);
      ctx.lineTo(x + 66, h - 36);
      ctx.lineTo(x + 36, h - 36);
      ctx.fill();
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  });
}
