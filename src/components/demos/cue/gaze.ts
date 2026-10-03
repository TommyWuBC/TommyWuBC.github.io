// The gaze pad: simulated webcam gaze -> One Euro filter -> dwell focus.
// Printed in two inks: raw samples in pink, the filtered gaze in blue, and the
// cursor ring a hair out of register.
import { PRODUCTS } from './session-logic';

class LowPass {
  y: number | null = null;
  f(x: number, a: number) { this.y = this.y === null ? x : a * x + (1 - a) * this.y; return this.y; }
  reset() { this.y = null; }
}

/** Casiez et al., "1€ Filter" (CHI 2012): low lag when moving, low jitter when still. */
export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private last: number | null = null;
  private prev: number | null = null;
  constructor(private minCutoff = 1, private beta = 0.02, private dCutoff = 1) {}
  private alpha(cutoff: number, dt: number) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v: number, t: number) {
    const dt = this.last === null ? 1 / 30 : Math.max(1e-3, t - this.last);
    this.last = t;
    const d = this.prev === null ? 0 : (v - this.prev) / dt;
    this.prev = v;
    const ed = this.dx.f(d, this.alpha(this.dCutoff, dt));
    return this.x.f(v, this.alpha(this.minCutoff + this.beta * Math.abs(ed), dt));
  }
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type Sample = { x: number; y: number; settled: boolean };
type Card = { x: number; y: number; w: number; h: number; dwell: number; flash: number };
const DWELL = 0.8; // seconds of steady gaze before focus moves, in this sketch

export function initGaze(root: HTMLElement) {
  const cv = root.querySelector('canvas')!;
  const ctx = cv.getContext('2d')!;
  const outRaw = root.querySelector('[data-raw]')!;
  const outF = root.querySelector('[data-filtered]')!;
  const outFocus = root.querySelector('[data-focus]')!;
  const filterBtn = root.querySelector<HTMLButtonElement>('[data-filter]')!;
  const sigmaIn = root.querySelector<HTMLInputElement>('[data-sigma]')!;
  const sigmaOut = root.querySelector('[data-sigma-out]')!;
  const page = root.closest<HTMLElement>('.zpage');
  const scene = root.closest<HTMLElement>('.zine-scene') || document.documentElement;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r = mulberry32(42);

  let col = { blue: '#3255a4', pink: '#ff48b0', sheet: '#f8f8f3', plate: 'multiply' as GlobalCompositeOperation, font: 'sans-serif' };
  const readColors = () => {
    const cs = getComputedStyle(scene);
    const v = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
    col = {
      blue: v('--z-blue', col.blue), pink: v('--z-pink', col.pink), sheet: v('--z-sheet', col.sheet),
      plate: (v('--z-plate', 'multiply') as GlobalCompositeOperation), font: v('--f-display', 'sans-serif'),
    };
  };
  readColors();
  const recolor = () => { readColors(); size(); kick(); };
  window.addEventListener('themechange', recolor);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);

  let W = 0, H = 0, k = 1;
  let cards: Card[] = [];
  const raw: Sample[] = [];
  const filt: Sample[] = [];
  let filterOn = true;
  let sigma = 13;
  let focus = 1;

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    // client sizes ignore the page's 3D turn transform
    W = cv.clientWidth; H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = W / 540;
    const pad = 18 * k, gap = 18 * k;
    const cw = (W - pad * 2 - gap * 2) / 3, ch = H - 62 * k - 20 * k;
    const prev = cards;
    cards = [0, 1, 2].map((i) => ({ x: pad + i * (cw + gap), y: 62 * k, w: cw, h: ch, dwell: prev[i]?.dwell ?? 0, flash: prev[i]?.flash ?? 0 }));
    swatches = cards.map((c, i) => halftone(c.w - 24 * k, c.h - 104 * k, i));
    draw(0);
  }

  // each product's "photo": a halftone patch, the way a riso prints an image
  let swatches: HTMLCanvasElement[] = [];
  function halftone(w: number, h: number, seed: number) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.fillStyle = col.blue;
    const step = 6.5 * k;
    const cx = w * (0.35 + seed * 0.15), cy = h * 0.55;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2 + ((y / step) % 2 ? step / 2 : 0); x < w; x += step) {
        const d = Math.hypot((x - cx) / w, (y - cy) / h);
        const rad = step * 0.42 * Math.max(0, 1 - d * 1.7);
        if (rad < 0.4) continue;
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
    }
    return c;
  }

  const fx = new OneEuro(0.9, 0.035, 1);
  const fy = new OneEuro(0.9, 0.035, 1);
  let target = { x: 0, y: 0 };
  let mode: 'idle' | 'pointer' = 'idle';
  let lastPointer = -1e9, idleIdx = 0, idleAt = 0, changeAt = 0;
  let cur: Sample = { x: 0, y: 0, settled: false };

  const centerOf = (i: number) => { const c = cards[i]; return { x: c.x + c.w * (0.35 + r() * 0.3), y: c.y + c.h * (0.4 + r() * 0.25) }; };
  function setIdleTarget(t: number) {
    idleIdx = (idleIdx + 1 + Math.floor(r() * 2)) % 3;
    target = centerOf(idleIdx);
    idleAt = t; changeAt = t;
  }
  const now = () => performance.now() / 1000;
  function steer(e: PointerEvent, jump: boolean) {
    const b = cv.getBoundingClientRect();
    // map from the (possibly transformed) on-screen box back to canvas pixels
    target = { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H };
    mode = 'pointer'; lastPointer = now();
    if (jump) changeAt = lastPointer;
    kick();
  }
  cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') steer(e, false); });
  cv.addEventListener('pointerdown', (e) => steer(e, true));
  cv.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const near = cards.reduce((best, c, i) => (Math.abs(c.x + c.w / 2 - target.x) < Math.abs(cards[best].x + cards[best].w / 2 - target.x) ? i : best), 0);
    idleIdx = (near + d + 3) % 3;
    target = centerOf(idleIdx);
    mode = 'pointer'; lastPointer = changeAt = now();
    kick();
  });
  filterBtn.addEventListener('click', () => {
    filterOn = !filterOn;
    filterBtn.setAttribute('aria-pressed', String(filterOn));
    filterBtn.textContent = `One Euro filter: ${filterOn ? 'on' : 'off'}`;
    kick();
  });
  sigmaIn.addEventListener('input', () => { sigma = Number(sigmaIn.value); sigmaOut.textContent = `${sigma} px`; kick(); });

  function step(t: number) {
    if (mode === 'pointer' && t - lastPointer > 2.5) { mode = 'idle'; setIdleTarget(t); }
    if (mode === 'idle' && t - idleAt > 1.8) setIdleTarget(t);
    // webcam gaze arrives at about 30 Hz, noisy
    const s = { x: target.x + gauss(r) * sigma * k, y: target.y + gauss(r) * sigma * k, settled: t - changeAt > 0.45 };
    raw.push(s); if (raw.length > 26) raw.shift();
    const f = { x: fx.filter(s.x, t), y: fy.filter(s.y, t), settled: s.settled };
    filt.push(f); if (filt.length > 22) filt.shift();
    cur = filterOn ? f : s;
  }
  function jitter(arr: Sample[]) {
    let sum = 0, n = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i].settled && arr[i - 1].settled) { sum += Math.hypot(arr[i].x - arr[i - 1].x, arr[i].y - arr[i - 1].y); n++; }
    return n ? sum / n / k : null;
  }

  function draw(dt: number) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.textBaseline = 'alphabetic';
    cards.forEach((c, i) => {
      const inside = cur.x > c.x && cur.x < c.x + c.w && cur.y > c.y && cur.y < c.y + c.h;
      c.dwell = inside ? Math.min(DWELL, c.dwell + dt) : Math.max(0, c.dwell - dt * 2);
      if (c.dwell >= DWELL && focus !== i) {
        focus = i; c.flash = 1;
        outFocus.textContent = PRODUCTS[i].title;
      }
      c.flash = Math.max(0, c.flash - dt * 1.6);
      const on = focus === i;
      if (on) { // the focused product prints as a solid block, pink plate slightly off
        ctx.globalCompositeOperation = col.plate;
        ctx.fillStyle = col.pink; ctx.globalAlpha = 0.35 + c.flash * 0.4;
        ctx.fillRect(c.x + 3 * k, c.y + 2 * k, c.w, c.h);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (swatches[i]) { ctx.globalAlpha = 0.28; ctx.drawImage(swatches[i], c.x + 12 * k, c.y + 60 * k, c.w - 24 * k, c.h - 104 * k); ctx.globalAlpha = 1; }
      ctx.lineWidth = on ? 3 : 2; ctx.strokeStyle = col.blue;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.fillStyle = col.blue;
      ctx.font = `700 ${Math.round(15 * k)}px ${col.font}`;
      ctx.fillText(PRODUCTS[i].title, c.x + 12 * k, c.y + 26 * k, c.w - 20 * k);
      ctx.font = `600 ${Math.round(13 * k)}px ${col.font}`;
      ctx.fillText(on ? 'focused' : `$${PRODUCTS[i].price}`, c.x + 12 * k, c.y + 46 * k);
      // dwell meter: fills while the gaze rests here
      const mx = c.x + 12 * k, my = c.y + c.h - 20 * k, mw = c.w - 24 * k;
      ctx.globalAlpha = 0.2; ctx.fillRect(mx, my, mw, 5 * k); ctx.globalAlpha = 1;
      ctx.fillStyle = col.pink; ctx.fillRect(mx, my, mw * (c.dwell / DWELL), 5 * k);
    });
    // header strip
    ctx.fillStyle = col.blue;
    ctx.font = `650 ${Math.round(13 * k)}px ${col.font}`;
    ctx.fillText(mode === 'pointer' ? 'Steering: your pointer' : 'Wandering: point at the pad to steer', 18 * k, 30 * k);
    // raw samples: pink dots, newest strongest
    ctx.globalCompositeOperation = col.plate;
    raw.forEach((s, i) => {
      ctx.globalAlpha = 0.15 + 0.7 * (i / raw.length);
      ctx.fillStyle = col.pink;
      ctx.beginPath(); ctx.arc(s.x, s.y, 3 * k, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the path the cursor actually took
    const path = filterOn ? filt : raw.slice(-22);
    ctx.globalAlpha = 0.55; ctx.strokeStyle = col.blue; ctx.lineWidth = 2 * k;
    ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.globalAlpha = 1;
    // cursor ring: blue plate, pink plate a hair out of register
    ctx.lineWidth = 2.5 * k;
    ctx.globalCompositeOperation = col.plate;
    ctx.strokeStyle = col.pink; ctx.beginPath(); ctx.arc(cur.x + 1.6 * k, cur.y + 1 * k, 11 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = col.blue; ctx.beginPath(); ctx.arc(cur.x, cur.y, 11 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col.blue; ctx.beginPath(); ctx.arc(cur.x, cur.y, 2.6 * k, 0, Math.PI * 2); ctx.fill();
  }

  const readouts = () => {
    const jr = jitter(raw), jf = jitter(filterOn ? filt : raw);
    if (jr !== null && jf !== null) { outRaw.textContent = `${jr.toFixed(0)} px`; outF.textContent = `${jf.toFixed(1)} px`; }
  };

  // run only while on screen and on a visible page; under reduced motion only while being steered
  let onScreen = false, running = false, last: number | null = null, acc = 0, readAt = 0, until = 0;
  const allowed = () => onScreen && !(page && page.inert) && document.visibilityState === 'visible';
  function loop(ts: number) {
    const t = ts / 1000;
    if (!allowed() || (reduce() && t > until)) { running = false; last = null; return; }
    if (last === null) last = t;
    const dt = Math.min(0.1, t - last); last = t;
    acc += dt;
    while (acc >= 1 / 30) { step(t); acc -= 1 / 30; }
    draw(dt);
    if (t - readAt > 0.5) { readAt = t; readouts(); }
    requestAnimationFrame(loop);
  }
  function kick() {
    if (reduce()) until = now() + 4;
    if (!running && allowed() && (!reduce() || now() < until)) { running = true; requestAnimationFrame(loop); }
    else if (!running) draw(0);
  }

  new ResizeObserver(size).observe(cv);
  size();
  idleIdx = 0; target = centerOf(1); cur = { ...target, settled: true };
  // a still frame to start from: a fixation on the middle product, filtered
  { let t = 0; for (let i = 0; i < 40; i++) { t += 1 / 30; step(t); } cards[1].dwell = DWELL; changeAt = -1; idleAt = now(); draw(0); readouts(); }

  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; kick(); }).observe(root);
  window.addEventListener('zine:spread', () => kick());
  document.addEventListener('visibilitychange', () => kick());
}
