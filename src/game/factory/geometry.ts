/** Rounded-rectangle conveyor loop, parametrised by arc length (clockwise from the top-left). */
export interface LoopPoint {
  x: number;
  y: number;
  angle: number;
}

export class ConveyorLoop {
  readonly a: number; // horizontal straight length
  readonly b: number; // vertical straight length
  readonly q: number; // quarter arc length
  readonly length: number;

  constructor(
    readonly left: number,
    readonly top: number,
    readonly right: number,
    readonly bottom: number,
    readonly r: number,
  ) {
    this.a = right - left - 2 * r;
    this.b = bottom - top - 2 * r;
    this.q = (Math.PI * r) / 2;
    this.length = 2 * this.a + 2 * this.b + 4 * this.q;
  }

  point(sIn: number): LoopPoint {
    const { a, b, q, r, left, top, right, bottom } = this;
    let s = ((sIn % this.length) + this.length) % this.length;
    if (s < a) return { x: left + r + s, y: top, angle: 0 };
    s -= a;
    if (s < q) {
      const t = s / r - Math.PI / 2;
      return { x: right - r + Math.cos(t) * r, y: top + r + Math.sin(t) * r, angle: t + Math.PI / 2 };
    }
    s -= q;
    if (s < b) return { x: right, y: top + r + s, angle: Math.PI / 2 };
    s -= b;
    if (s < q) {
      const t = s / r;
      return { x: right - r + Math.cos(t) * r, y: bottom - r + Math.sin(t) * r, angle: t + Math.PI / 2 };
    }
    s -= q;
    if (s < a) return { x: right - r - s, y: bottom, angle: Math.PI };
    s -= a;
    if (s < q) {
      const t = s / r + Math.PI / 2;
      return { x: left + r + Math.cos(t) * r, y: bottom - r + Math.sin(t) * r, angle: t + Math.PI / 2 };
    }
    s -= q;
    if (s < b) return { x: left, y: bottom - r - s, angle: -Math.PI / 2 };
    s -= b;
    const t = s / r + Math.PI;
    return { x: left + r + Math.cos(t) * r, y: top + r + Math.sin(t) * r, angle: t + Math.PI / 2 };
  }

  /** Arc length of a point on the top straight with the given x. */
  sTop(x: number) {
    return x - (this.left + this.r);
  }

  /** Arc length of a point on the bottom straight (travelling right to left). */
  sBottom(x: number) {
    return this.a + this.q + this.b + this.q + (this.right - this.r - x);
  }

  /** End of the bottom straight: where products leave the belt. */
  get sExit() {
    return 2 * this.a + this.b + 2 * this.q;
  }

  corners() {
    const { left, top, right, bottom, r } = this;
    return [
      { x: left + r, y: top + r },
      { x: right - r, y: top + r },
      { x: right - r, y: bottom - r },
      { x: left + r, y: bottom - r },
    ];
  }
}

/** Slider-crank: y of the slider driven by a crank pin, sliding on the vertical through cx. */
export function sliderY(cx: number, pinX: number, pinY: number, rod: number, up: boolean) {
  const dx = pinX - cx;
  const h = Math.sqrt(Math.max(0, rod * rod - dx * dx));
  return up ? pinY - h : pinY + h;
}
