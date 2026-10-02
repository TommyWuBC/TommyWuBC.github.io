// Fig. 2 on the Cue case study: simulated webcam gaze, smoothed by a One Euro
// filter, selecting by dwell. Point at the pad to steer; otherwise the "eyes"
// wander between the three items on their own.

class LowPass {
  y: number | null = null;
  f(x: number, a: number) {
    this.y = this.y === null ? x : a * x + (1 - a) * this.y;
    return this.y;
  }
}

/** Casiez et al., "1€ Filter" (CHI 2012): low lag when moving, low jitter when still. */
class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private last: number | null = null;
  private prev: number | null = null;
  constructor(
    private minCutoff = 1,
    private beta = 0.02,
    private dCutoff = 1,
  ) {}
  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
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
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Sample {
  x: number;
  y: number;
  settled: boolean;
}
interface Card {
  x: number;
  y: number;
  w: number;
  h: number;
  dwell: number;
  chosen: number;
}

const DWELL = 0.8; // seconds of steady gaze to select

function init(root: HTMLElement) {
  const cv = root.querySelector('canvas')!;
  const ctx = cv.getContext('2d')!;
  const outRaw = root.querySelector('[data-raw]')!;
  const outF = root.querySelector('[data-filtered]')!;
  const outPick = root.querySelector('[data-picked]')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r = mulberry32(42);
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--ink').trim();
  const ink2 = cs.getPropertyValue('--ink-2').trim();
  const rule = cs.getPropertyValue('--rule-strong').trim();
  const paper = cs.getPropertyValue('--paper').trim();
  const sans = cs.getPropertyValue('--sans').trim();
  const names = ['Item A', 'Item B', 'Item C'];

  let W = 0;
  let H = 0;
  let cards: Card[] = [];
  const raw: Sample[] = [];
  const filt: Sample[] = [];
  let sigma = 12;

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const b = cv.getBoundingClientRect();
    W = b.width;
    H = b.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 16;
    const gap = 14;
    const cw = (W - pad * 2 - gap * 2) / 3;
    const ch = Math.min(150, H - 64);
    const prevCards = cards;
    cards = [0, 1, 2].map((i) => ({
      x: pad + i * (cw + gap),
      y: (H - ch) / 2,
      w: cw,
      h: ch,
      dwell: prevCards[i]?.dwell ?? 0,
      chosen: prevCards[i]?.chosen ?? 0,
    }));
    sigma = Math.max(9, Math.min(16, W / 40));
  }
  size();
  new ResizeObserver(size).observe(cv);

  const fx = new OneEuro(0.9, 0.035, 1);
  const fy = new OneEuro(0.9, 0.035, 1);
  let target = { x: W / 2, y: H / 2 };
  let mode: 'idle' | 'pointer' = 'idle';
  let lastPointer = -1e9;
  let idleIdx = 0;
  let idleAt = 0;
  let changeAt = 0;
  let f: Sample = { x: target.x, y: target.y, settled: false };

  function setIdleTarget(t: number) {
    const c = cards[idleIdx % 3];
    idleIdx += 1 + Math.floor(r() * 2);
    target = { x: c.x + c.w * (0.35 + r() * 0.3), y: c.y + c.h * (0.35 + r() * 0.3) };
    idleAt = t;
    changeAt = t;
  }
  function steer(e: PointerEvent, jump: boolean) {
    const b = cv.getBoundingClientRect();
    target = { x: e.clientX - b.left, y: e.clientY - b.top };
    mode = 'pointer';
    lastPointer = performance.now() / 1000;
    if (jump) changeAt = lastPointer;
  }
  cv.addEventListener('pointermove', (e) => e.pointerType !== 'touch' && steer(e, false));
  cv.addEventListener('pointerdown', (e) => steer(e, true));

  function step(t: number) {
    if (mode === 'pointer' && t - lastPointer > 2.5) {
      mode = 'idle';
      setIdleTarget(t);
    }
    if (mode === 'idle' && t - idleAt > 1.7) setIdleTarget(t);
    // webcam gaze arrives at about 30 Hz, noisy
    const s = { x: target.x + gauss(r) * sigma, y: target.y + gauss(r) * sigma, settled: t - changeAt > 0.45 };
    raw.push(s);
    if (raw.length > 26) raw.shift();
    f = { x: fx.filter(s.x, t), y: fy.filter(s.y, t), settled: s.settled };
    filt.push(f);
    if (filt.length > 22) filt.shift();
  }
  function jitter(arr: Sample[]) {
    let sum = 0;
    let k = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].settled && arr[i - 1].settled) {
        sum += Math.hypot(arr[i].x - arr[i - 1].x, arr[i].y - arr[i - 1].y);
        k++;
      }
    }
    return k ? sum / k : null;
  }

  function draw(dt: number) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = `600 12px ${sans}`;
    cards.forEach((c, i) => {
      const inside = f.x > c.x && f.x < c.x + c.w && f.y > c.y && f.y < c.y + c.h;
      c.dwell = inside ? Math.min(DWELL, c.dwell + dt) : Math.max(0, c.dwell - dt * 2);
      if (c.dwell >= DWELL && !c.chosen) {
        c.chosen = 1.1;
        outPick.textContent = `${names[i]} selected`;
      }
      c.chosen = Math.max(0, c.chosen - dt);
      ctx.fillStyle = paper;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.lineWidth = c.chosen ? 3 : 1;
      ctx.strokeStyle = c.chosen ? ink : rule;
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      ctx.fillStyle = ink;
      ctx.fillText(names[i], c.x + 12, c.y + 22);
      // dwell meter: a rule that fills as the gaze stays put
      ctx.fillStyle = rule;
      ctx.fillRect(c.x + 12, c.y + c.h - 16, c.w - 24, 1);
      ctx.fillStyle = ink;
      ctx.fillRect(c.x + 12, c.y + c.h - 17, (c.w - 24) * (c.dwell / DWELL), 3);
    });
    // raw samples: faint dots, newest darkest
    raw.forEach((s, i) => {
      ctx.globalAlpha = 0.12 + 0.55 * (i / raw.length);
      ctx.fillStyle = ink2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    // filtered trail and cursor
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    filt.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (reduce) {
    // one still frame: a fixation on the middle item, filtered
    let t = 0;
    idleIdx = 1;
    setIdleTarget(0);
    for (let i = 0; i < 60; i++) {
      t += 1 / 30;
      step(t);
    }
    cards[1].dwell = DWELL;
    draw(0);
    outRaw.textContent = `${jitter(raw)!.toFixed(0)} px`;
    outF.textContent = `${jitter(filt)!.toFixed(1)} px`;
    return;
  }

  let last: number | null = null;
  let acc = 0;
  let readAt = 0;
  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(root);
  function loop(ts: number) {
    const t = ts / 1000;
    if (last === null) {
      last = t;
      setIdleTarget(t);
    }
    const dt = Math.min(0.1, t - last);
    last = t;
    if (visible) {
      acc += dt;
      while (acc >= 1 / 30) {
        step(t);
        acc -= 1 / 30;
      }
      draw(dt);
      if (t - readAt > 0.5) {
        readAt = t;
        const jr = jitter(raw);
        const jf = jitter(filt);
        if (jr && jf) {
          outRaw.textContent = `${jr.toFixed(0)} px`;
          outF.textContent = `${jf.toFixed(1)} px`;
        }
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

document.querySelectorAll<HTMLElement>('[data-gaze]').forEach(init);
