import Phaser from 'phaser';

export const FONT_FAMILY = '"Lilita One", "Arial Black", sans-serif';

const CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~×éèàçÉÈÀÇÎîêâôûùÂÊÔÛ•›';

/**
 * Builds a bitmap font from a web font at runtime (stroke + fill baked in), so
 * dozens of changing numeric labels render as cheap batched quads instead of
 * one canvas texture per Text object.
 */
export function createBitmapFont(
  scene: Phaser.Scene,
  key: string,
  opts: { size: number; stroke: number; fill: string; strokeColor: string; shadow?: boolean },
) {
  if (scene.cache.bitmapFont.exists(key)) return;
  const { size, stroke } = opts;
  const pad = Math.ceil(stroke + 2);
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;
  mctx.font = `${size}px ${FONT_FAMILY}`;

  const cellH = Math.ceil(size * 1.25 + pad * 2 + (opts.shadow ? 4 : 0));
  const maxW = 2048;
  const glyphs: { ch: string; w: number; adv: number; x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  for (const ch of CHARS) {
    const adv = mctx.measureText(ch).width;
    const w = Math.ceil(adv + pad * 2);
    if (x + w > maxW) {
      x = 0;
      y += cellH;
    }
    glyphs.push({ ch, w, adv, x, y });
    x += w + 2;
  }
  const texH = Phaser.Math.Pow2.GetNext(y + cellH);
  const tex = scene.textures.createCanvas(key, maxW, texH)!;
  const ctx = tex.getContext();
  ctx.font = `${size}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const baseline = pad + size * 0.98;
  for (const g of glyphs) {
    if (g.ch === ' ') continue;
    const gx = g.x + pad;
    const gy = g.y + baseline;
    if (opts.shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = stroke * 2;
      ctx.strokeText(g.ch, gx, gy + 4);
    }
    if (stroke > 0) {
      ctx.strokeStyle = opts.strokeColor;
      ctx.lineWidth = stroke * 2;
      ctx.strokeText(g.ch, gx, gy);
    }
    ctx.fillStyle = opts.fill;
    ctx.fillText(g.ch, gx, gy);
  }
  tex.refresh();

  const data: any = { font: key, size, lineHeight: cellH - pad, chars: {} };
  for (const g of glyphs) {
    const code = g.ch.charCodeAt(0);
    data.chars[code] = {
      x: g.x,
      y: g.y,
      width: g.w,
      height: cellH,
      centerX: Math.floor(g.w / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: -pad,
      yOffset: -pad,
      xAdvance: Math.ceil(g.adv + stroke * 0.5),
      data: {},
      kerning: {},
      u0: g.x / maxW,
      v0: g.y / texH,
      u1: (g.x + g.w) / maxW,
      v1: (g.y + cellH) / texH,
    };
  }
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
}

export const FONTS = {
  /** White numbers with dark outline: coin values, labels. */
  main: 'font-main',
  /** Gold outlined, for big gains. */
  gold: 'font-gold',
};

export function createFonts(scene: Phaser.Scene) {
  createBitmapFont(scene, FONTS.main, { size: 64, stroke: 7, fill: '#ffffff', strokeColor: '#2a1446', shadow: true });
  createBitmapFont(scene, FONTS.gold, { size: 72, stroke: 8, fill: '#ffe066', strokeColor: '#6b2a00', shadow: true });
}
