// The map shell in the browser: live terrain, the course built from the page's
// h2 sections, a runner that follows your reading, and a control card that
// punches a control once you pause on it. Without JS the page is a complete
// reading column and the map is hidden.
import { LiveContours, makeNoise, fbm, mulberry32, seedOf, hex, cssVar, reduceMotion, contour } from './map-shell.terrain';

declare global {
  interface Window { toast?: (msg: string) => void }
}

const root = document.querySelector<HTMLElement>('[data-mapshell]');
if (root) init(root);

function init(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => r.querySelector<T>(s)!;
  const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => [...r.querySelectorAll<T>(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const seed = seedOf(root.dataset.seed || 'map');

  const frame = $('[data-map-root]');
  const base = $<HTMLCanvasElement>('.ms-base', frame);
  const linesCv = $<HTMLCanvasElement>('.ms-lines', frame);
  const legsSvg = $<SVGSVGElement>('.ms-legs', frame);
  const ctrlLayer = $('.ms-ctrls', frame);
  const resetBtn = $<HTMLButtonElement>('.ms-reset', frame);
  const body = $('.ms-body');
  const heads = $$<HTMLHeadingElement>(':scope > h2', body);
  const startEl = $('.ms-head');
  const finishEl = $('.ms-finish');
  const clueItems = $$<HTMLLIElement>('.ms-clues li');
  const n = heads.length;

  type Stop = { kind: 'start' | 'ctrl' | 'finish'; n: number; el: HTMLElement; label: string; p: [number, number]; side: 'e' | 'w' };
  const course: Stop[] = [
    { kind: 'start', n: 0, el: startEl, label: 'Start', p: [0, 0], side: 'e' },
    ...heads.map((h, i) => ({ kind: 'ctrl' as const, n: i + 1, el: h, label: shortLabel(h.textContent || ''), p: [0, 0] as [number, number], side: 'e' as const })),
    { kind: 'finish', n: n + 1, el: finishEl, label: 'Finish', p: [0, 0], side: 'e' },
  ];

  function shortLabel(t: string) {
    const s = t.trim();
    if (s.length <= 26) return s;
    const cut = s.slice(0, 26);
    return cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }

  /* ======================= terrain ======================= */
  const nA = makeNoise(seed % 997), nB = makeNoise((seed >>> 3) % 991 + 7), nC = makeNoise((seed >>> 6) % 983 + 13);
  const rnd = mulberry32(seed);
  const flip = rnd() > 0.5;
  const HILLS: [number, number, number, number][] = [
    [0.42, 0.31, 0.17, 0.95], [0.69, 0.10, 0.12, 0.55], [0.88, 0.50, 0.14, 0.85], [0.56, 0.63, 0.19, 0.55],
    [0.17, 0.54, 0.12, 0.7], [0.27, 0.93, 0.2, 0.5], [0.97, 0.86, 0.15, 0.35], [0.07, 0.10, 0.12, 0.45],
    [0.60, 0.97, 0.11, -0.95], [0.06, 0.37, 0.07, -0.85],
  ].map(([x, y, r, a]) => [flip ? 1 - x : x, y, r, a] as [number, number, number, number]);
  const LAKE = -0.2;
  const Sof = (W: number, H: number) => Math.min(W, H) * 0.9 + Math.max(W, H) * 0.1;
  function heightAt(px: number, py: number, W: number, H: number) {
    const S = Sof(W, H), u = px / S, v = py / S;
    let h = (fbm(nA, u * 3.2, v * 3.2) - 0.5) * 0.7;
    for (const [hx, hy, r, a] of HILLS) {
      const dx = (px - hx * W) / S, dy = (py - hy * H) / S;
      h += a * Math.exp(-(dx * dx + dy * dy) / (r * r));
    }
    return h;
  }

  let colors: Record<string, string> = {};
  const readColors = () => {
    const k = ['m-paper', 'm-open', 'm-rough', 'm-veg', 'm-veg-2', 'm-water', 'm-water-ink', 'm-north', 'm-path'];
    colors = Object.fromEntries(k.map((x) => [x, cssVar(frame, '--' + x)]));
  };
  readColors();

  let sampler: (x: number, y: number) => number = () => 0;
  const live = new LiveContours({
    frame,
    canvas: linesCv,
    heightAt,
    floor: LAKE,
    ignore: '.ms-ctrl, button',
    resetBtn,
    onSize: (W, H, sample) => {
      sampler = sample;
      paintBase(W, H);
      placeCourse(W, H);
      buildCourse(W, H);
    },
    onPointer: (x, y, inside) => {
      lampFollowsRunner = !inside;
      if (inside) { frame.style.setProperty('--hx', x + 'px'); frame.style.setProperty('--hy', y + 'px'); }
      else moveLamp();
    },
  });

  function paintBase(W: number, H: number) {
    base.width = W; base.height = H; // fills are soft by nature; 1x is plenty
    const ctx = base.getContext('2d')!;
    const S = Sof(W, H);
    const img = ctx.createImageData(W, H), D = img.data;
    const C = {
      paper: hex(colors['m-paper']), open: hex(colors['m-open']), rough: hex(colors['m-rough']),
      veg: hex(colors['m-veg']), veg2: hex(colors['m-veg-2']), water: hex(colors['m-water']),
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / S, v = y / S;
        let c = C.paper;
        if (sampler(x, y) < LAKE) c = C.water;
        else {
          const g = fbm(nB, u * 4.2, v * 4.2);
          if (g > 0.665) c = C.veg2;
          else if (g > 0.6) c = C.veg;
          else {
            const o = fbm(nC, u * 3.4, v * 3.4);
            if (o > 0.64) c = C.open;
            else if (o > 0.595) c = C.rough;
          }
        }
        const k = (y * W + x) * 4;
        D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2]; D[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    // magnetic north lines
    ctx.save(); ctx.strokeStyle = colors['m-north']; ctx.lineWidth = 1;
    const tilt = Math.tan((3 * Math.PI) / 180) * H;
    for (let x = -tilt; x < W + tilt; x += 104) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + tilt, H); ctx.stroke(); }
    ctx.restore();
    // shoreline
    const st = 8, nx = Math.ceil(W / st) + 1, ny = Math.ceil(H / st) + 1, g = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = sampler(i * st, j * st);
    ctx.save(); ctx.strokeStyle = colors['m-water-ink']; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); contour(ctx, g, nx, ny, st, LAKE); ctx.stroke(); ctx.restore();
    // a stream, a track and a footpath
    const P = (a: number[][]) => a.map(([x, y]) => [(flip ? 1 - x : x) * W, y * H]);
    const curve = (pts: number[][]) => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
      }
      const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.strokeStyle = colors['m-water-ink']; ctx.lineWidth = 1.6;
    curve(P([[0.6, 0.9], [0.66, 0.8], [0.7, 0.72], [0.78, 0.67], [0.85, 0.7], [1.02, 0.66]]));
    ctx.strokeStyle = colors['m-path']; ctx.lineWidth = 1.5; ctx.setLineDash([7, 4]);
    curve(P([[-0.02, 0.3], [0.2, 0.36], [0.3, 0.46], [0.36, 0.6], [0.48, 0.74], [0.7, 0.78], [0.9, 0.95], [0.98, 1.02]]));
    ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]);
    curve(P([[0.3, -0.02], [0.5, 0.12], [0.58, 0.2], [0.66, 0.34], [0.7, 0.5], [0.66, 0.58]]));
    ctx.setLineDash([]);
    // boulders
    const r = mulberry32(seed ^ 5); ctx.fillStyle = colors['m-path'];
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * H;
      if (sampler(x, y) < LAKE + 0.05) continue;
      ctx.beginPath(); ctx.arc(x, y, 1.6 + r() * 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ======================= course placement (seeded, avoids water) ======================= */
  let placedFor = '';
  function placeCourse(W: number, H: number) {
    const key = `${Math.round(W / 40)}x${Math.round(H / 40)}`;
    if (placedFor === key) return;
    placedFor = key;
    const r = mulberry32(seed ^ 0x9e3779b9);
    const total = course.length;
    const wide = W > H * 1.1;
    const cx = 0.5, cy = wide ? 0.52 : 0.5, rx = wide ? 0.34 : 0.3, ry = wide ? 0.3 : 0.33;
    const th0 = -Math.PI * (0.9 + r() * 0.2);
    const sweep = Math.PI * 2 * 0.84;
    const blocked = (x: number, y: number) =>
      x < 0.08 || x > 0.92 || y < 0.17 || y > 0.86 ||
      (x < 0.42 && y > 0.74) || // control card
      (W >= 600 && x > 0.6 && y > 0.8) || // legend
      sampler(x * W, y * H) < LAKE + 0.06;
    // Many seeded tries around a loop; keep the one whose closest pair of
    // controls is farthest apart and that stays on dry, uncovered ground.
    let bestPts: [number, number][] = [], bestScore = -Infinity;
    for (let tryN = 0; tryN < 90; tryN++) {
      const a0 = th0 + (r() - 0.5) * 0.8;
      const pts: [number, number][] = [];
      let pen = 0;
      for (let i = 0; i < total; i++) {
        const th = a0 + (sweep * i) / Math.max(1, total - 1) + (r() - 0.5) * 0.3;
        const rr = 0.62 + r() * 0.42;
        const x = cx + Math.cos(th) * rx * rr, y = cy + Math.sin(th) * ry * rr;
        if (blocked(x, y)) pen += 1;
        pts.push([x, y]);
      }
      let minD = Infinity;
      for (let i = 0; i < total; i++) for (let j = i + 1; j < total; j++) minD = Math.min(minD, Math.hypot((pts[i][0] - pts[j][0]) * W, (pts[i][1] - pts[j][1]) * H));
      const score = minD - pen * 400;
      if (score > bestScore) { bestScore = score; bestPts = pts; }
    }
    // labels go on the side away from the legs, and inside the frame
    course.forEach((c, i) => {
      c.p = bestPts[i];
      const nb = [bestPts[i - 1], bestPts[i + 1]].filter(Boolean);
      const dx = nb.reduce((s, q) => s + (q[0] - bestPts[i][0]), 0);
      let side: 'e' | 'w' = dx > 0 ? 'w' : 'e';
      if (side === 'e' && bestPts[i][0] * W > W - 190) side = 'w';
      if (side === 'w' && bestPts[i][0] * W < 190) side = 'e';
      c.side = side;
    });
  }

  /* ======================= course overlay ======================= */
  const peek = document.createElement('div');
  peek.className = 'ms-peek'; peek.setAttribute('aria-hidden', 'true'); frame.appendChild(peek);
  let px: [number, number][] = [];
  let runnerG: SVGGElement | null = null;
  let ctrlCircles: SVGCircleElement[] = [];
  let mapCtrls: HTMLAnchorElement[] = [];
  let drawn = false;
  const svg = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, parent?: Element) => {
    const el = document.createElementNS(NS, name);
    for (const k in attrs) el.setAttribute(k, String(attrs[k]));
    parent?.appendChild(el);
    return el;
  };

  function buildCourse(W: number, H: number) {
    legsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    legsSvg.textContent = ''; ctrlLayer.textContent = '';
    ctrlCircles = []; mapCtrls = [];
    const small = W < 520;
    const R = small ? 14 : 17, RF = small ? 17 : 20, RS = small ? 15 : 18;
    px = course.map((c) => [c.p[0] * W, c.p[1] * H]);
    const radius = (c: Stop) => (c.kind === 'start' ? RS * 0.75 : c.kind === 'finish' ? RF + 1 : R + 1);
    const legsG = svg('g', {}, legsSvg);
    const legEls: SVGLineElement[] = [];
    for (let i = 0; i < px.length - 1; i++) {
      const [x1, y1] = px[i], [x2, y2] = px[i + 1];
      const dd = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / dd, uy = (y2 - y1) / dd;
      const r1 = radius(course[i]) + 3, r2 = radius(course[i + 1]) + 3;
      if (dd < r1 + r2 + 4) continue;
      const l = svg('line', { class: 'leg-line', x1: x1 + ux * r1, y1: y1 + uy * r1, x2: x2 - ux * r2, y2: y2 - uy * r2 }, legsG);
      l.dataset.len = String(dd - r1 - r2); l.dataset.to = String(i + 1);
      legEls.push(l);
    }
    const [sx, sy] = px[0], [ax, ay] = px[1];
    const ang = Math.atan2(ay - sy, ax - sx);
    const tri = [0, 1, 2].map((k) => { const a = ang + k * 2.0944; return [sx + Math.cos(a) * RS, sy + Math.sin(a) * RS].join(','); }).join(' ');
    const startShape = svg('polygon', { class: 'start', points: tri }, legsSvg);
    course.forEach((c, i) => {
      if (c.kind === 'ctrl') ctrlCircles[c.n] = svg('circle', { class: 'ctl', cx: px[i][0], cy: px[i][1], r: R }, legsSvg);
      if (c.kind === 'finish') {
        ctrlCircles[c.n] = svg('circle', { class: 'ctl', cx: px[i][0], cy: px[i][1], r: RF }, legsSvg);
        svg('circle', { class: 'ctl inner', cx: px[i][0], cy: px[i][1], r: RF - 6 }, legsSvg);
      }
    });
    runnerG = svg('g', { class: 'runner-g' }, legsSvg);
    svg('circle', { class: 'runner-ring', r: 11 }, runnerG);
    svg('circle', { class: 'runner', r: 6 }, runnerG);

    course.forEach((c, i) => {
      if (c.kind === 'start') return;
      const a = document.createElement('a');
      a.className = 'ms-ctrl';
      a.href = c.kind === 'finish' ? '#ms-finish' : '#' + c.el.id;
      a.style.left = px[i][0] + 'px'; a.style.top = px[i][1] + 'px';
      a.dataset.pos = c.side;
      if (c.kind === 'finish') {
        a.innerHTML = '<span class="lab"><i>Finish</i></span>';
        a.setAttribute('aria-label', 'Finish: links and the way back');
      } else {
        a.innerHTML = `<span class="lab"><b>${c.n}</b><i></i></span>`;
        a.querySelector('i')!.textContent = small ? '' : c.label;
        a.setAttribute('aria-label', `Control ${c.n}: ${c.el.textContent}`);
        a.addEventListener('pointerenter', () => showPeek(c, i, W, H));
        a.addEventListener('focus', () => showPeek(c, i, W, H));
        a.addEventListener('pointerleave', hidePeek); a.addEventListener('blur', hidePeek);
      }
      a.addEventListener('click', (e) => {
        e.preventDefault();
        hidePeek();
        punch(c.n);
        c.el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
        if (!c.el.hasAttribute('tabindex')) c.el.setAttribute('tabindex', '-1');
        c.el.focus({ preventScroll: true });
        history.replaceState(null, '', a.getAttribute('href'));
      });
      ctrlLayer.appendChild(a);
      mapCtrls[c.n] = a;
    });
    punched.forEach((on, k) => on && ctrlCircles[k]?.classList.add('punched'));

    if (!drawn && !reduceMotion() && 'animate' in legsSvg) {
      drawn = true;
      let t = 900; // after the sheet unfolds
      startShape.style.transformOrigin = `${sx}px ${sy}px`;
      startShape.style.transformBox = 'view-box';
      startShape.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: t, fill: 'backwards', easing: 'cubic-bezier(.22,1.2,.36,1)' });
      legEls.forEach((l) => {
        const len = +l.dataset.len!, dur = 120 + len * 0.9;
        l.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }], { duration: dur, delay: t, fill: 'backwards', easing: 'cubic-bezier(.5,0,.3,1)' });
        t += dur * 0.85;
        const k = +l.dataset.to!;
        ctrlCircles[k]?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: t - 60, fill: 'backwards' });
        mapCtrls[k]?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: t, fill: 'backwards' });
      });
    } else drawn = true;
    updateRunner();
  }

  function showPeek(c: Stop, i: number, W: number, H: number) {
    if (W < 520) return;
    let next = c.el.nextElementSibling;
    while (next && next.tagName !== 'P' && next.tagName !== 'H2') next = next.nextElementSibling;
    const para = next && next.tagName === 'P' ? (next.textContent || '').trim() : '';
    peek.innerHTML = '<h4></h4><p></p>';
    peek.querySelector('h4')!.textContent = `${c.n}. ${c.el.textContent}`;
    peek.querySelector('p')!.textContent = para.length > 150 ? para.slice(0, para.lastIndexOf(' ', 150)) + '…' : para;
    const [x, y] = px[i];
    const left = x > W * 0.55 ? x - 260 - 30 : x + 30;
    peek.style.left = Math.max(8, Math.min(W - 268, left)) + 'px';
    peek.style.top = Math.max(8, Math.min(H - 150, y + 26)) + 'px';
    peek.classList.add('on');
  }
  const hidePeek = () => peek.classList.remove('on');

  /* ======================= runner + control card ======================= */
  const punched: boolean[] = new Array(n + 2).fill(false);
  const boxes = $('[data-punch-boxes]'), sum = $('[data-punch-sum]'), card = $('.ms-punch');
  const gutter = $('.ms-gutter'), gRunner = $('.ms-grunner');
  const t0 = performance.now();
  let completed = false, lampFollowsRunner = true, lastT = 0, dwellT = 0;
  for (let k = 1; k <= n + 1; k++) {
    const r = mulberry32(k * 97 + 3 + (seed % 101)), pins: number[] = [];
    while (pins.length < 7) { const p = Math.floor(r() * 16); if (!pins.includes(p)) pins.push(p); }
    const li = document.createElement('li');
    li.innerHTML = `<span class="n">${k > n ? 'F' : k}</span><svg viewBox="0 0 22 22" aria-hidden="true">${pins.map((p) => `<circle cx="${3.5 + (p % 4) * 5}" cy="${3.5 + Math.floor(p / 4) * 5}" r="1.8"/>`).join('')}</svg>`;
    boxes.appendChild(li);
  }
  const total = n + 1;
  function punch(k: number) {
    if (k < 1 || punched[k]) return;
    punched[k] = true;
    boxes.children[k - 1]?.classList.add('on');
    ctrlCircles[k]?.classList.add('punched');
    course[k].el.classList.add('punched');
    clueItems[k]?.classList.add('punched');
    const done = punched.filter(Boolean).length;
    sum.textContent = `${done} of ${total} punched`;
    if (done === total && !completed) {
      completed = true;
      const s = Math.max(1, Math.round((performance.now() - t0) / 1000));
      const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      sum.textContent = `Course complete, ${time}`;
      card.classList.add('done');
      window.toast?.(`Course complete in ${time}. Thanks for reading.`);
    }
  }

  const docY = (el: Element) => el.getBoundingClientRect().top + scrollY;
  function progress() {
    const ys = course.map((c) => docY(c.el) + (c.kind === 'start' ? 0 : 40));
    const probe = scrollY + innerHeight * 0.42;
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) return course.length - 1;
    if (probe <= ys[0]) return 0;
    for (let i = 0; i < ys.length - 1; i++) if (probe < ys[i + 1]) return i + (probe - ys[i]) / (ys[i + 1] - ys[i]);
    return course.length - 1;
  }
  function runnerXY(t: number): [number, number] {
    const i = Math.min(px.length - 2, Math.floor(t)), f = t - i;
    const a = px[i], b = px[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  function moveLamp() {
    if (!lampFollowsRunner || !px.length) return;
    const [x, y] = runnerXY(lastT);
    frame.style.setProperty('--hx', x + 'px'); frame.style.setProperty('--hy', y + 'px');
  }
  const wide = matchMedia('(min-width: 1100px)');
  let frameVisible = true;
  new IntersectionObserver((es) => { frameVisible = es[0].isIntersecting; updateRunner(); }).observe(frame);

  function updateRunner() {
    if (!px.length) return;
    const t = progress(); lastT = t;
    const [x, y] = runnerXY(t);
    runnerG?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    moveLamp();
    // the gutter runner rides the line between the section numbers
    const bb = body.getBoundingClientRect();
    const cy = [...heads.map((h) => h.getBoundingClientRect().top - bb.top + 44), finishEl.getBoundingClientRect().top - bb.top + 44];
    if (cy.length > 1) {
      const gt = Math.max(1, Math.min(n + 1, t));
      const gi = Math.min(n - 1, Math.floor(gt) - 1), gf = gt - 1 - gi;
      const gy = cy[gi] + (cy[gi + 1] - cy[gi]) * Math.min(1, gf);
      gutter.style.top = cy[0] + 'px';
      gutter.style.height = cy[cy.length - 1] - cy[0] + 'px';
      gRunner.style.top = gy - cy[0] + 'px';
    }
    const near = Math.round(t);
    const at = Math.abs(t - near) < 0.4 ? near : -1;
    heads.forEach((h, i) => h.classList.toggle('here', at === i + 1));
    mapCtrls.forEach((a, k) => a?.classList.toggle('here', k === at));
    card.classList.toggle('float', !wide.matches && !frameVisible && t > 0.6 && t < n + 1.4);
    // punch once the reader has actually stopped at a control for a moment
    clearTimeout(dwellT);
    const stopAt = Math.abs(t - near) < 0.35 && near >= 1 ? near : 0;
    if (stopAt && !punched[stopAt]) dwellT = window.setTimeout(() => { if (Math.round(lastT) === stopAt) punch(stopAt); }, 700);
  }

  // reading a section lights its control on the map
  heads.forEach((h, i) => {
    const sec: Element[] = [h];
    let e = h.nextElementSibling;
    while (e && e.tagName !== 'H2') { sec.push(e); e = e.nextElementSibling; }
    const on = () => { mapCtrls[i + 1]?.classList.add('linked'); ctrlCircles[i + 1]?.classList.add('linked'); };
    const off = () => { mapCtrls[i + 1]?.classList.remove('linked'); ctrlCircles[i + 1]?.classList.remove('linked'); };
    sec.forEach((el) => { el.addEventListener('pointerenter', on); el.addEventListener('pointerleave', off); });
  });

  let sraf = 0;
  addEventListener('scroll', () => { if (!sraf) sraf = requestAnimationFrame(() => { sraf = 0; updateRunner(); }); }, { passive: true });
  addEventListener('resize', () => updateRunner());
  // Demos change the page height as they open; keep the runner honest.
  new ResizeObserver(() => updateRunner()).observe(body);

  /* ======================= lamp: night map with a headlamp ======================= */
  const retheme = () => {
    readColors(); live.readColor();
    if (live.W) { paintBase(live.W, live.H); live.draw(); }
  };
  addEventListener('themechange', () => requestAnimationFrame(retheme));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
}
