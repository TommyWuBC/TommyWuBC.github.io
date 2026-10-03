/* Fig. 1, live. Two agents on one LavaCrossing field (see model.js).
   New layout (N, or click the field): a fresh room. The solid agent plans on the true map;
     the hollow one crosses the first river, then walks the rest as if it were floor.
   Move the gaps (R): same rivers, new openings. The hollow agent replays the route that
     solved the last room and walks into lava where the gap used to be.
   Show what the hollow agent expects (E): the lava it believes is floor.
   1 / 2 / 3: number of rivers. P: pause the automatic rounds.
   Off screen or in a background tab, nothing runs. */
import {
  S, C, PAPER, layoutFromSeed, build, mulberry32, truePath, believedPath, cut, fellIn,
  beliefCells, demoSeed, riverOf, centre,
} from './model.js';

const root = document.querySelector('[data-lava]');
if (root) init(root);

function init(root) {
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => reduceMQ.matches;
  const NS = 'http://www.w3.org/2000/svg';
  const STEP = 210;
  const $ = (s) => root.querySelector(s);
  const svg = $('svg.vn-field'), statusEl = $('[data-status]');
  const said = { one: $('[data-said="one"]'), many: $('[data-said="many"]') };
  const tallyEl = { one: $('[data-tally="one"]'), many: $('[data-tally="many"]') };
  const paperEl = { one: $('[data-paper="one"]'), many: $('[data-paper="many"]') };
  const playBtn = $('[data-play]'), believeBtn = $('[data-believe]');
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* ---------- drawing ---------- */
  function drawField(L) {
    svg.textContent = '';
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'vn-hatch', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-40)' }, defs);
    el('rect', { width: 10, height: 10, class: 'g-lava-bg' }, pat);
    el('line', { x1: 0, y1: 5, x2: 10, y2: 5, class: 'g-hatch' }, pat);
    const field = el('g', {}, svg);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const t = L.g[y][x];
      if (t === 'W') el('rect', { x: x * C, y: y * C, width: C, height: C, class: 'g-wall' }, field);
      else if (t === 'L') el('rect', { x: x * C, y: y * C, width: C, height: C, fill: 'url(#vn-hatch)' }, field);
    }
    el('rect', { x: (S - 2) * C + 4, y: (S - 2) * C + 4, width: C - 8, height: C - 8, rx: 3, class: 'g-goal' }, field);
    const lines = el('g', { class: 'g-lines' }, svg);
    for (let i = 1; i < S; i++) {
      el('line', { x1: i * C, y1: C, x2: i * C, y2: (S - 1) * C }, lines);
      el('line', { x1: C, y1: i * C, x2: (S - 1) * C, y2: i * C }, lines);
    }
    return {
      belief: el('g', { class: 'g-belief' }, svg),
      under: el('g', {}, svg), trails: el('g', {}, svg), agents: el('g', {}, svg), fx: el('g', {}, svg),
    };
  }
  const TRI = 'M11 0 L-8 -8.5 L-8 8.5 Z';
  function agent(layers, who) {
    const trail = el('polyline', { class: `g-trail ${who}`, points: '' }, layers.trails);
    const g = el('g', { class: `g-agent ${who}` }, layers.agents);
    el('path', { d: TRI }, g);
    return { trail, g };
  }
  const place = (A, x, y, a) => A.g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.toFixed(1)})`);
  const heading = (p, i) => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, Math.max(i, 1))];
    if (!a || !b || (a[0] === b[0] && a[1] === b[1])) return 0;
    return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  };
  function scribble(layers, [x, y]) {
    const cx = x * C + C / 2, cy = y * C + C / 2;
    el('circle', { cx, cy, r: 15, class: 'g-ring pop' }, layers.fx);
    el('path', { d: `M${cx - 8} ${cy - 9} L${cx + 9} ${cy + 8}`, pathLength: 1, class: 'g-x draw' }, layers.fx);
    el('path', { d: `M${cx + 8} ${cy - 8} L${cx - 9} ${cy + 9}`, pathLength: 1, class: 'g-x draw', style: 'animation-delay:.15s' }, layers.fx);
  }
  // a pen note with an arrow, kept inside the field
  function note(layers, [x, y], text) {
    const cx = x * C + C / 2, cy = y * C + C / 2, w = text.length * 7.4;
    let anchor = cx > 180 ? 'end' : 'start';
    let tx = anchor === 'end' ? cx - 22 : cx + 22;
    if (anchor === 'end' && tx - w < 24) { anchor = 'start'; tx = cx + 22; }
    if (anchor === 'start' && tx + w > 336) { anchor = 'end'; tx = Math.max(cx - 22, 24 + w); }
    const ty = cy > 90 ? cy - 30 : cy + 44;
    const ax = anchor === 'end' ? tx + 4 : tx - 4, ay = ty + (cy > 90 ? 6 : -18);
    const ex = cx + (anchor === 'end' ? -10 : 10), ey = cy + (cy > 90 ? -12 : 12);
    el('path', { d: `M${ax} ${ay} Q${(ax + ex) / 2 + (anchor === 'end' ? 8 : -8)} ${(ay + ey) / 2} ${ex} ${ey}`, pathLength: 1, class: 'g-arrow draw', style: 'animation-delay:.3s' }, layers.fx);
    const t = el('text', { x: tx, y: ty, 'text-anchor': anchor, class: 'g-note pop', style: 'animation-delay:.35s' }, layers.fx);
    t.textContent = text;
    try {
      const bb = t.getBBox();
      layers.fx.insertBefore(el('rect', { x: bb.x - 5, y: bb.y - 1, width: bb.width + 10, height: bb.height + 3, rx: 3, class: 'g-note-bg pop', style: 'animation-delay:.35s' }), t);
    } catch (e) { /* not rendered yet */ }
  }
  function check(layers) {
    const p = (S - 2) * C + C / 2;
    el('path', { d: `M${p - 10} ${p} l7 8 l14 -17`, pathLength: 1, class: 'g-check draw' }, layers.fx);
  }

  /* ---------- tally: pencil marks against the paper ---------- */
  const tally = { one: { 1: [0, 0], 2: [0, 0], 3: [0, 0] }, many: { 1: [0, 0], 2: [0, 0], 3: [0, 0] } };
  function marks(k) {
    if (!k) return '';
    const shown = Math.min(k, 20);
    let out = '<span class="marks" aria-hidden="true">';
    for (let g = 0; g < Math.ceil(shown / 5); g++) {
      const c = Math.min(5, shown - g * 5);
      let d = '';
      for (let i = 0; i < Math.min(c, 4); i++) d += `M${i * 5 + (i % 2 ? 0.6 : 0)} ${i % 2 ? 1 : 0} l${i % 2 ? -0.6 : 0.5} 17 `;
      if (c === 5) d += 'M-3 14 L19 3';
      out += `<svg viewBox="-4 -1 25 20" width="25" height="20"><path d="${d}"/></svg>`;
    }
    return out + '</span>';
  }
  function drawTally() {
    for (const who of ['one', 'many']) {
      const [ok, all] = tally[who][n];
      tallyEl[who].innerHTML = all ? `${marks(ok)}<span class="t-txt">${ok} of ${all}</span>` : '<span class="t-none">no runs yet</span>';
      paperEl[who].textContent = PAPER[who][n];
    }
    root.querySelectorAll('[data-variant]').forEach((v) => (v.textContent = 'S9N' + n));
  }

  /* ---------- state ---------- */
  let n = 2, L = null, lastMany = null, running = !reduce(), inView = false, started = false, pending = false;
  let timer = 0, raf = 0, seed = +root.dataset.seed || 0, believing = false;
  const rng = mulberry32((Date.now() & 0xffff) + 1);
  const hex = (s) => (s >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  const firstLayout = (k) => { seed = demoSeed(k); return layoutFromSeed(k, seed); };
  const freshLayout = () => { seed = (rng() * 1e9) | 0; return layoutFromSeed(n, seed); };
  const sameGaps = (a, b) => a.openings.length === b.openings.length && a.openings.every((o) => b.openings.some((p) => p.x === o.x && p.y === o.y));

  function setSaid(who, text, bad) {
    const s = said[who];
    s.classList.remove('shown'); s.textContent = text;
    s.classList.toggle('bad', !!bad);
    if (text) requestAnimationFrame(() => s.classList.add('shown'));
  }

  function run(kind, old) {
    clearTimeout(timer); cancelAnimationFrame(raf);
    const layers = drawField(L);
    const many = truePath(L);
    const plan = kind === 'move' && lastMany ? lastMany : believedPath(L);
    const one = cut(L, plan);
    const end = one[one.length - 1];
    const fell = fellIn(L, one);
    const oldGaps = kind === 'move' && old ? old.openings.filter((o) => L.g[o.y][o.x] === 'L') : [];
    const atOldGap = fell && oldGaps.some((o) => o.x === end[0] && o.y === end[1]);
    // what it expects: lava it believes is floor
    const believed = kind === 'move' ? oldGaps.map((o) => [o.x, o.y]) : beliefCells(L);
    believed.forEach(([x, y]) => el('rect', { x: x * C + 3, y: y * C + 3, width: C - 6, height: C - 6, rx: 2 }, layers.belief));
    // old gaps as dashed boxes, and the route it means to take as a faint dotted line
    oldGaps.forEach((o) => el('rect', { x: o.x * C + 4, y: o.y * C + 4, width: C - 8, height: C - 8, rx: 2, class: 'g-ghost' }, layers.under));
    el('polyline', { class: 'g-plan', points: plan.map((c) => centre(c, 'one').join(',')).join(' ') }, layers.under);
    const A = { one: agent(layers, 'one'), many: agent(layers, 'many') };
    const P = { one, many };
    let scribbled = false;
    setSaid('one', ''); setSaid('many', '');
    const label = `Layout ${hex(seed)}, ${n} river${n > 1 ? 's' : ''}`;
    const k = one.length - 1;
    const oneLine = () => {
      if (kind === 'move') {
        if (!fell) return 'Replayed the last route and made it. The gaps it used stayed put.';
        return atOldGap
          ? `Replayed the last route and walked into lava on move ${k}, right where the gap used to be.`
          : `Replayed the last route and hit lava on move ${k}.`;
      }
      if (fell) return `Crossed the first river, then walked into the ${riverOf(L, end)} on move ${k}, right where its training room had open floor.`;
      return n === 1 ? `Found the gap. Goal in ${k} moves. One river is the room it knows.` : `Made it in ${k} moves. The later gaps happened to sit on its path.`;
    };
    const manyLine = `Found ${n === 1 ? 'the gap' : n === 2 ? 'both gaps' : 'all three gaps'}. Goal in ${many.length - 1} moves.`;
    const finish = () => {
      if (fell) {
        if (!scribbled) scribble(layers, end);
        A.one.g.classList.add('dead');
        note(layers, end, kind === 'move' && atOldGap ? 'the gap used to be here' : kind === 'move' ? 'remembered floor here' : 'it expected floor');
      }
      check(layers);
      setSaid('one', oneLine(), fell); setSaid('many', manyLine);
      if (kind === 'layout') {
        tally.many[n][0]++; tally.many[n][1]++; tally.one[n][1]++; if (!fell) tally.one[n][0]++;
        drawTally();
      }
      statusEl.textContent = `${label}: the solid agent reached the goal in ${many.length - 1} moves; the hollow one ${fell ? 'stepped into lava after ' + k : 'reached it in ' + k}.`;
      lastMany = many;
      if (running) timer = setTimeout(() => { if (inView && !document.hidden) next(); else pending = true; }, kind === 'move' ? 3800 : 2800);
    };
    if (reduce()) {
      for (const who of ['one', 'many']) {
        const p = P[who], e = centre(p[p.length - 1], who);
        A[who].trail.setAttribute('points', p.map((c) => centre(c, who).join(',')).join(' '));
        place(A[who], e[0], e[1], heading(p, p.length - 1));
      }
      return finish();
    }
    statusEl.textContent = `${label}: running.`;
    for (const who of ['one', 'many']) { const [x, y] = centre(P[who][0], who); place(A[who], x, y, 0); }
    const total = Math.max(one.length, many.length) - 1;
    let t0 = null;
    const done = { one: false, many: false };
    const frame = (ts) => {
      if (t0 === null) t0 = ts;
      const f = (ts - t0) / STEP;
      for (const who of ['one', 'many']) {
        const p = P[who], last = p.length - 1, Ag = A[who];
        const i = Math.min(Math.floor(f), last);
        const kk = i >= last ? 1 : Math.min(1, (f - i) * 1.3);
        const e = kk < 0.5 ? 2 * kk * kk : 1 - Math.pow(-2 * kk + 2, 2) / 2;
        const a = centre(p[i], who), b = centre(p[Math.min(i + 1, last)], who);
        const x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e;
        place(Ag, x, y, heading(p, Math.min(i + 1, last)));
        const pts = p.slice(0, i + 1).map((c) => centre(c, who)); pts.push([x, y]);
        Ag.trail.setAttribute('points', pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' '));
        if (i >= last && !done[who]) {
          done[who] = true;
          if (who === 'one' && fell) { scribble(layers, end); scribbled = true; Ag.g.classList.add('dead'); }
        }
      }
      if (f < total + 0.7) raf = requestAnimationFrame(frame);
      else finish();
    };
    raf = requestAnimationFrame(frame);
  }

  function next() { L = freshLayout(); run('layout'); }
  function bringIntoView() {
    const r = root.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) root.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
  }
  function newLayout(fromMenu) { if (fromMenu) bringIntoView(); started = true; next(); }
  function moveGaps(fromMenu) {
    if (fromMenu) bringIntoView();
    if (!L || !lastMany) return newLayout();
    started = true;
    const old = L;
    let tries = 0, L2;
    do { seed = (rng() * 1e9) | 0; L2 = build(n, old.rv, old.rh, mulberry32(seed)); } while (sameGaps(L2, old) && ++tries < 30);
    L = L2; run('move', old);
  }
  function setRivers(k) {
    n = k;
    root.querySelectorAll('[data-rivers]').forEach((o) => o.setAttribute('aria-pressed', String(+o.dataset.rivers === k)));
    L = firstLayout(n); lastMany = null; drawTally(); started = true; run('layout');
  }
  function togglePlay() {
    running = !running;
    playBtn.firstChild.textContent = running ? 'Pause ' : 'Play ';
    playBtn.setAttribute('aria-pressed', String(!running));
    if (running) next(); else clearTimeout(timer);
  }
  function toggleBelief() {
    believing = !believing;
    believeBtn.setAttribute('aria-pressed', String(believing));
    root.classList.toggle('believing', believing);
    believeBtn.querySelector('[data-believe-label]').textContent = believing ? 'Hide what the hollow agent expects' : 'Show what the hollow agent expects';
  }

  root.querySelectorAll('[data-rivers]').forEach((b) => b.addEventListener('click', () => setRivers(+b.dataset.rivers)));
  $('[data-next]').addEventListener('click', () => newLayout());
  $('[data-move]').addEventListener('click', () => moveGaps());
  $('[data-stage]').addEventListener('click', () => newLayout());
  playBtn.addEventListener('click', togglePlay);
  believeBtn.addEventListener('click', toggleBelief);
  if (reduce()) { running = false; playBtn.firstChild.textContent = 'Play '; playBtn.setAttribute('aria-pressed', 'true'); }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable], dialog[open], [data-keys-own]')) return;
    const key = e.key.toLowerCase();
    if (key === 'r') moveGaps(true);
    else if (key === 'n') newLayout(true);
    else if (key === 'p') { bringIntoView(); togglePlay(); }
    else if (key === 'e') { bringIntoView(); toggleBelief(); }
    else if (key === '1' || key === '2' || key === '3') { bringIntoView(); setRivers(+key); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pending && running && inView) { pending = false; next(); }
  });

  // the server drew a finished round; keep it until the figure is on screen, then start
  L = layoutFromSeed(n, seed);
  lastMany = truePath(L);
  drawTally();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView && !started) { started = true; setTimeout(() => run('layout'), reduce() ? 0 : 450); }
      else if (inView && pending && running) { pending = false; next(); }
    }, { threshold: 0.35 }).observe(root);
  } else { inView = true; started = true; run('layout'); }
  window.lava = { newLayout, moveGaps };
}
