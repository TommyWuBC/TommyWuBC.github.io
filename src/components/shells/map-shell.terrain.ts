// Terrain engine shared by the map shell and the toolbox skill map.
// Pure functions (noise, marching squares) work at build time too; LiveContours
// is the browser part: contour lines that bend around the pointer, plus hills
// you raise by pressing and holding. Ported from the round-2 "Course" entry.

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit seed from a string (a project id). */
export function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type Noise = (x: number, y: number) => number;

export function makeNoise(seed: number): Noise {
  const r = mulberry32(seed),
    N = 64,
    g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      fx = sm(x - xi),
      fy = sm(y - yi);
    const x0 = xi & 63,
      y0 = yi & 63,
      x1 = (x0 + 1) & 63,
      y1 = (y0 + 1) & 63;
    const a = g[y0 * N + x0], b = g[y0 * N + x1], c = g[y1 * N + x0], d = g[y1 * N + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export const fbm = (n: Noise, x: number, y: number) => n(x, y) * 0.57 + n(x * 2.03, y * 2.03) * 0.29 + n(x * 4.1, y * 4.1) * 0.14;

interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
}

/** Marching squares over a nx*ny grid with spacing `step`, at level L, into a path. */
export function contour(sink: PathSink, grid: ArrayLike<number>, nx: number, ny: number, step: number, L: number) {
  for (let j = 0; j < ny - 1; j++) {
    const y = j * step;
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const a = grid[k], b = grid[k + 1], c = grid[k + nx + 1], d = grid[k + nx];
      const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * step;
      const T = (): [number, number] => [x + (step * (L - a)) / (b - a), y];
      const R = (): [number, number] => [x + step, y + (step * (L - b)) / (c - b)];
      const B = (): [number, number] => [x + (step * (L - d)) / (c - d), y + step];
      const Lf = (): [number, number] => [x, y + (step * (L - a)) / (d - a)];
      const seg = (p: [number, number], q: [number, number]) => {
        sink.moveTo(p[0], p[1]);
        sink.lineTo(q[0], q[1]);
      };
      switch (idx) {
        case 1: case 14: seg(Lf(), B()); break;
        case 2: case 13: seg(B(), R()); break;
        case 3: case 12: seg(Lf(), R()); break;
        case 4: case 11: seg(T(), R()); break;
        case 6: case 9: seg(T(), B()); break;
        case 7: case 8: seg(T(), Lf()); break;
        case 5: seg(T(), R()); seg(Lf(), B()); break;
        case 10: seg(T(), Lf()); seg(B(), R()); break;
      }
    }
  }
}

export const hex = (h: string): [number, number, number] => {
  const s = h.trim().replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const cssVar = (el: Element, n: string) => getComputedStyle(el).getPropertyValue(n).trim();

export const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface LiveOpts {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Height at a pixel of the frame (frame size W×H is passed in). */
  heightAt: (x: number, y: number, W: number, H: number) => number;
  /** Below this level nothing is drawn (water). */
  floor: number;
  colorVar?: string;
  step?: number;
  stepZ?: number;
  /** Elements under the pointer that should not raise a hill. */
  ignore?: string;
  resetBtn?: HTMLButtonElement | null;
  /** Called after the base grid is rebuilt (on resize), e.g. to repaint fills. */
  onSize?: (W: number, H: number, sample: (x: number, y: number) => number) => void;
  onPointer?: (x: number, y: number, inside: boolean) => void;
}

/**
 * Contour lines computed in the browser. A rise follows the pointer; press and
 * hold to raise a hill (up to six), "Flatten" lowers them again. Draws only on
 * demand: the rAF loop stops as soon as nothing is moving.
 */
export class LiveContours {
  W = 0; H = 0; S = 1;
  private nx = 0; private ny = 0;
  private base = new Float32Array(0);
  private dyn = new Float32Array(0);
  private hover = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0 };
  private hills: { x: number; y: number; h: number; th: number }[] = [];
  private holding: { x: number; y: number; h: number; th: number } | null = null;
  private raf = 0;
  private color = '#c26b2c';
  private ctx: CanvasRenderingContext2D;
  private step: number;
  private stepZ: number;
  visible = true;

  constructor(private o: LiveOpts) {
    this.ctx = o.canvas.getContext('2d')!;
    this.step = o.step ?? 8;
    this.stepZ = o.stepZ ?? 0.1;
    this.readColor();
    const f = o.frame;
    const local = (e: PointerEvent) => {
      const b = f.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    f.addEventListener('pointermove', (e) => {
      const [x, y] = local(e);
      o.onPointer?.(x, y, true);
      if (e.pointerType === 'touch' || reduceMotion()) return;
      const h = this.hover;
      h.tx = x; h.ty = y;
      if (!h.a) { h.x = x; h.y = y; }
      h.ta = 0.32;
      this.kick();
    });
    f.addEventListener('pointerleave', () => {
      this.hover.ta = 0;
      this.holding = null;
      o.onPointer?.(0, 0, false);
      this.kick();
    });
    f.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (o.ignore && (e.target as Element).closest(o.ignore)) return;
      const [x, y] = local(e);
      if (this.hills.length >= 6) this.hills[0].th = 0;
      this.holding = { x, y, h: 0, th: reduceMotion() ? 0.9 : 0.12 };
      this.hills.push(this.holding);
      if (o.resetBtn) o.resetBtn.hidden = false;
      this.kick();
    });
    const stop = () => (this.holding = null);
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);
    o.resetBtn?.addEventListener('click', () => this.flatten());
    let rw = 0, rh = 0;
    new ResizeObserver(() => {
      const b = f.getBoundingClientRect();
      if (Math.abs(b.width - rw) < 1 && Math.abs(b.height - rh) < 1) return;
      rw = b.width; rh = b.height;
      this.size();
    }).observe(f);
    // Pause the loop while the map is off-screen.
    new IntersectionObserver((es) => {
      this.visible = es[0].isIntersecting;
      if (this.visible) this.kick();
    }).observe(f);
  }

  readColor() {
    this.color = cssVar(this.o.frame, this.o.colorVar ?? '--m-contour') || this.color;
  }

  flatten() {
    this.hills.forEach((h) => (h.th = 0));
    if (this.o.resetBtn) this.o.resetBtn.hidden = true;
    this.kick();
  }

  /** Raise a hill at a point, as if pressed (used by the keyboard). */
  raise(x: number, y: number) {
    if (this.hills.length >= 6) this.hills[0].th = 0;
    this.hills.push({ x, y, h: 0, th: 0.9 });
    if (this.o.resetBtn) this.o.resetBtn.hidden = false;
    this.kick();
  }

  size() {
    const b = this.o.frame.getBoundingClientRect();
    const W = Math.round(b.width), H = Math.round(b.height);
    if (!W || !H) return;
    this.W = W; this.H = H;
    this.S = Math.min(W, H) * 0.9 + Math.max(W, H) * 0.1;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const c = this.o.canvas;
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const st = this.step;
    this.nx = Math.ceil(W / st) + 1; this.ny = Math.ceil(H / st) + 1;
    this.base = new Float32Array(this.nx * this.ny);
    this.dyn = new Float32Array(this.nx * this.ny);
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) this.base[j * this.nx + i] = this.o.heightAt(i * st, j * st, W, H);
    this.o.onSize?.(W, H, (x, y) => this.sample(x, y));
    this.draw();
  }

  /** Bilinear sample of the base height grid. */
  sample(px: number, py: number) {
    const st = this.step, nx = this.nx;
    const gx = Math.max(0, Math.min(this.nx - 1.001, px / st)), gy = Math.max(0, Math.min(this.ny - 1.001, py / st));
    const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, k = j * nx + i;
    const g = this.base;
    const a = g[k], b = g[k + 1], c = g[k + nx], d = g[k + nx + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  private bump(cx: number, cy: number, amp: number, rad: number) {
    if (Math.abs(amp) < 0.003) return;
    const st = this.step, nx = this.nx, ny = this.ny;
    const R = rad * 3;
    const i0 = Math.max(0, Math.floor((cx - R) / st)), i1 = Math.min(nx - 1, Math.ceil((cx + R) / st));
    const j0 = Math.max(0, Math.floor((cy - R) / st)), j1 = Math.min(ny - 1, Math.ceil((cy + R) / st));
    const inv = 1 / (rad * rad);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = i * st - cx, dy = j * st - cy;
        this.dyn[j * nx + i] += amp * Math.exp(-(dx * dx + dy * dy) * inv);
      }
  }

  draw() {
    if (!this.W) return;
    const { ctx, W, H, S } = this;
    this.dyn.set(this.base);
    this.bump(this.hover.x, this.hover.y, this.hover.a, S * 0.075);
    for (const h of this.hills) this.bump(h.x, h.y, h.h, S * 0.085);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = this.color;
    ctx.lineCap = 'round';
    let min = Infinity, max = -Infinity;
    const d = this.dyn;
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (v < min) min = v; if (v > max) max = v; }
    const thin = new Path2D(), thick = new Path2D();
    const k0 = Math.ceil(Math.max(min, this.o.floor + 0.001) / this.stepZ), k1 = Math.floor(max / this.stepZ);
    for (let k = k0; k <= k1; k++) contour(k % 5 === 0 ? thick : thin, d, this.nx, this.ny, this.step, k * this.stepZ);
    ctx.lineWidth = 1; ctx.globalAlpha = 0.9; ctx.stroke(thin);
    ctx.lineWidth = 1.9; ctx.globalAlpha = 1; ctx.stroke(thick);
  }

  kick() {
    if (!this.raf && this.visible) this.raf = requestAnimationFrame(() => this.tick());
  }

  private tick() {
    this.raf = 0;
    const h = this.hover;
    let busy = false;
    h.x += (h.tx - h.x) * 0.28; h.y += (h.ty - h.y) * 0.28; h.a += (h.ta - h.a) * 0.12;
    if (Math.abs(h.ta - h.a) > 0.002 || Math.abs(h.tx - h.x) > 0.3 || Math.abs(h.ty - h.y) > 0.3) busy = true;
    if (this.holding) { this.holding.th = Math.min(1.5, this.holding.th + 0.022); busy = true; }
    for (let i = this.hills.length - 1; i >= 0; i--) {
      const m = this.hills[i];
      m.h += (m.th - m.h) * 0.14;
      if (Math.abs(m.th - m.h) > 0.002) busy = true;
      if (m.th === 0 && m.h < 0.01) this.hills.splice(i, 1);
    }
    this.draw();
    if (busy) this.kick();
  }
}
