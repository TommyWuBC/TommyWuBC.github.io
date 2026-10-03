/* Fig. 1: two agents on one MiniGrid LavaCrossing field.
   Merges round-1 entry B (MiniGrid-faithful S9Nk layouts, rivers 1-3, tally next to the paper)
   with entry C (a hollow agent that replays memorized moves and dies where the gap used to be, R to shuffle).
   - New layout (N, or click the field): fresh layout. Blue plans on the true map. Hollow knows how to cross
     one river, the only kind it trained on, and walks the rest of the room as if it were clear.
   - Move the gaps (R): same rivers, new openings. Hollow replays the exact route that solved the last layout.
   A sketch of behavior, not the trained networks. */
(() => {
  const root = document.querySelector('[data-lava]');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const S = 9, C = 40, STEP = 210;
  const $ = (s) => root.querySelector(s);
  const svg = $('svg.field'), statusEl = $('[data-status]');
  const said = { one: $('[data-said="one"]'), many: $('[data-said="many"]') };
  const tallyEl = { one: $('[data-tally="one"]'), many: $('[data-tally="many"]') };
  const paperEl = { one: $('[data-paper="one"]'), many: $('[data-paper="many"]') };
  const PAPER = { one: { 1: '95.2%', 2: '20.0%', 3: '10.0%' }, many: { 1: '100%', 2: '98.4%', 3: '97.8%' }, layouts: { 1: 42, 2: 249, 3: 276 } };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* ---------- layouts (MiniGrid CrossingEnv: rivers on even rows/cols, one opening each, staircase order) ---------- */
  function pickRivers(n, r) {
    const c = [[2, 'v'], [4, 'v'], [6, 'v'], [2, 'h'], [4, 'h'], [6, 'h']];
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    const rivers = c.slice(0, n);
    return {
      rv: rivers.filter((q) => q[1] === 'v').map((q) => q[0]).sort((a, b) => a - b),
      rh: rivers.filter((q) => q[1] === 'h').map((q) => q[0]).sort((a, b) => a - b),
    };
  }
  function build(n, rv, rh, r) {
    const randint = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    const g = [];
    for (let y = 0; y < S; y++) { g.push([]); for (let x = 0; x < S; x++) g[y].push(x === 0 || y === 0 || x === S - 1 || y === S - 1 ? 'W' : '.'); }
    rv.forEach((x) => { for (let y = 1; y < S - 1; y++) g[y][x] = 'L'; });
    rh.forEach((y) => { for (let x = 1; x < S - 1; x++) g[y][x] = 'L'; });
    const order = [...rv.map(() => 'h'), ...rh.map(() => 'v')];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const lv = [0, ...rv, S - 1], lh = [0, ...rh, S - 1];
    let ri = 0, rj = 0;
    const openings = [];
    for (const d of order) {
      let x, y;
      if (d === 'h') { x = lv[ri + 1]; y = randint(lh[rj] + 1, lh[rj + 1] - 1); ri++; }
      else { x = randint(lv[ri] + 1, lv[ri + 1] - 1); y = lh[rj + 1]; rj++; }
      g[y][x] = '.'; openings.push({ x, y, d });
    }
    return { g, openings, n, rv, rh };
  }
  function bfs(passable) {
    const start = [1, 1], goal = [S - 2, S - 2], key = (x, y) => x + ',' + y;
    const prev = new Map([[key(...start), null]]), q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === goal[0] && y === goal[1]) break;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (!prev.has(k) && passable(nx, ny)) { prev.set(k, [x, y]); q.push([nx, ny]); }
      }
    }
    if (!prev.has(key(...goal))) return [start];
    const out = []; let cur = goal;
    while (cur) { out.unshift(cur); cur = prev.get(key(...cur)); }
    return out;
  }
  const truePath = (L) => bfs((x, y) => L.g[y][x] === '.');
  // hollow, fresh layout: knows the first river it meets in training terms, treats the rest as floor
  function believed(L) {
    const f = L.openings[0];
    const isFirst = (x, y) => (f.d === 'h' ? x === f.x : y === f.y);
    return bfs((x, y) => L.g[y][x] !== 'W' && !(L.g[y][x] === 'L' && isFirst(x, y)));
  }
  const cut = (L, plan) => { const i = plan.findIndex(([x, y]) => L.g[y][x] === 'L'); return i === -1 ? plan : plan.slice(0, i + 1); };

  /* ---------- drawing ---------- */
  function drawField(L) {
    svg.textContent = '';
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'hatch', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-40)' }, defs);
    el('rect', { width: 10, height: 10, class: 'g-lava-bg' }, pat);
    el('line', { x1: 0, y1: 5, x2: 10, y2: 5, class: 'g-hatch' }, pat);
    const field = el('g', {}, svg);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const t = L.g[y][x];
      if (t === 'W') el('rect', { x: x * C, y: y * C, width: C, height: C, class: 'g-wall' }, field);
      else if (t === 'L') el('rect', { x: x * C, y: y * C, width: C, height: C, fill: 'url(#hatch)' }, field);
    }
    el('rect', { x: (S - 2) * C + 4, y: (S - 2) * C + 4, width: C - 8, height: C - 8, rx: 3, class: 'g-goal' }, field);
    const lines = el('g', { class: 'g-lines' }, svg);
    for (let i = 1; i < S; i++) {
      el('line', { x1: i * C, y1: C, x2: i * C, y2: (S - 1) * C }, lines);
      el('line', { x1: C, y1: i * C, x2: (S - 1) * C, y2: i * C }, lines);
    }
    return { under: el('g', {}, svg), trails: el('g', {}, svg), agents: el('g', {}, svg), fx: el('g', {}, svg) };
  }
  const OFF = { one: -5, many: 5 };
  const centre = ([x, y], who) => [x * C + C / 2 + OFF[who], y * C + C / 2 + OFF[who]];
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
    return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  };
  function scribble(layers, [x, y]) {
    const cx = x * C + C / 2, cy = y * C + C / 2;
    el('circle', { cx, cy, r: 15, class: 'g-ring pop' }, layers.fx);
    el('path', { d: `M${cx - 8} ${cy - 9} L${cx + 9} ${cy + 8}`, pathLength: 1, class: 'g-x draw' }, layers.fx);
    el('path', { d: `M${cx + 8} ${cy - 8} L${cx - 9} ${cy + 9}`, pathLength: 1, class: 'g-x draw', style: 'animation-delay:.15s' }, layers.fx);
  }
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
    } catch (e) {}
  }
  function check(layers) {
    const p = (S - 2) * C + C / 2;
    el('path', { d: `M${p - 10} ${p} l7 8 l14 -17`, pathLength: 1, class: 'g-check draw' }, layers.fx);
  }

  /* ---------- tally ---------- */
  const tally = { one: { 1: [0, 0], 2: [0, 0], 3: [0, 0] }, many: { 1: [0, 0], 2: [0, 0], 3: [0, 0] } };
  function marks(k) {
    if (!k) return '';
    let out = '<span class="marks" aria-hidden="true">';
    for (let g = 0; g < Math.ceil(Math.min(k, 20) / 5); g++) {
      const c = Math.min(5, Math.min(k, 20) - g * 5);
      let d = '';
      for (let i = 0; i < Math.min(c, 4); i++) d += `M${i * 5 + (i % 2 ? .6 : 0)} ${i % 2 ? 1 : 0} l${i % 2 ? -.6 : .5} 17 `;
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
    root.querySelectorAll('[data-layouts]').forEach((v) => (v.textContent = PAPER.layouts[n]));
  }

  /* ---------- episodes ---------- */
  let n = 2, L = null, lastMany = null, running = !reduce, inView = false, started = false, pending = false, timer = 0, raf = 0, seed = 0;
  const rng = mulberry32(Date.now() & 0xffff);
  const hex = (s) => (s >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  function firstLayout(k) {
    for (let s = 7; s < 500; s++) {
      const r = mulberry32(s), { rv, rh } = pickRivers(k, r), Lx = build(k, rv, rh, r);
      const one = cut(Lx, believed(Lx)), many = truePath(Lx);
      const fell = Lx.g[one[one.length - 1][1]][one[one.length - 1][0]] === 'L';
      if ((k === 1 || (fell && one.length > 4)) && many.length > 13) { seed = s; return Lx; }
    }
    const r = mulberry32(7), { rv, rh } = pickRivers(k, r); seed = 7; return build(k, rv, rh, r);
  }
  function freshLayout() { seed = (rng() * 1e9) | 0; const r = mulberry32(seed), { rv, rh } = pickRivers(n, r); return build(n, rv, rh, r); }
  const sameGaps = (a, b) => a.openings.every((o, i) => b.openings.some((p) => p.x === o.x && p.y === o.y)) && a.openings.length === b.openings.length;

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
    const plan = kind === 'move' && lastMany ? lastMany : believed(L);
    const one = cut(L, plan);
    const end = one[one.length - 1];
    const fell = L.g[end[1]][end[0]] === 'L';
    const oldGaps = kind === 'move' && old ? old.openings.filter((o) => L.g[o.y][o.x] === 'L') : [];
    const atOldGap = fell && oldGaps.some((o) => o.x === end[0] && o.y === end[1]);
    // the old gaps, drawn as dashed boxes, and hollow's intended route as a faint dotted line
    oldGaps.forEach((o) => el('rect', { x: o.x * C + 4, y: o.y * C + 4, width: C - 8, height: C - 8, rx: 2, class: 'g-ghost' }, layers.under));
    el('polyline', { class: 'g-plan', points: plan.map((c) => centre(c, 'one').join(',')).join(' ') }, layers.under);
    const A = { one: agent(layers, 'one'), many: agent(layers, 'many') };
    const P = { one, many };
    let scribbled = false;
    setSaid('one', ''); setSaid('many', '');
    const label = `Layout ${hex(seed)}, ${n} river${n > 1 ? 's' : ''}`;
    const oneLine = () => {
      const k = one.length - 1;
      if (kind === 'move') {
        if (!fell) return 'Replayed the last route and made it. The gaps it used stayed put.';
        return atOldGap ? `Replayed the last route and walked into lava on move ${k}, right where the gap used to be.` : `Replayed the last route and hit lava on move ${k}.`;
      }
      if (fell) return `Found the first gap, then walked into lava on move ${k}. It never trained with more than one river.`;
      return n === 1 ? `Reached the goal in ${k} moves. One river is what it knows.` : `Made it in ${k} moves. The other rivers happened to be out of its way.`;
    };
    const manyLine = `Found ${n > 1 ? 'all ' + n + ' gaps' : 'the gap'}. Goal in ${many.length - 1} moves.`;
    const finish = () => {
      if (fell) { if (!scribbled) scribble(layers, end); A.one.g.classList.add('dead'); note(layers, end, kind === 'move' && atOldGap ? 'the gap used to be here' : kind === 'move' ? 'remembered floor here' : 'it only knows one river'); }
      check(layers);
      setSaid('one', oneLine(), fell); setSaid('many', manyLine);
      if (kind === 'layout') { tally.many[n][0]++; tally.many[n][1]++; tally.one[n][1]++; if (!fell) tally.one[n][0]++; drawTally(); }
      statusEl.textContent = `${label}: blue reached the goal in ${many.length - 1} moves; hollow ${fell ? 'stepped into lava after ' + (one.length - 1) + ' moves' : 'reached the goal in ' + (one.length - 1) + ' moves'}.`;
      lastMany = many;
      if (running) timer = setTimeout(() => { if (inView) next(); else pending = true; }, kind === 'move' ? 3600 : 2600);
    };
    if (reduce) {
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
    let t0 = null, done = { one: false, many: false };
    const frame = (ts) => {
      if (t0 === null) t0 = ts;
      const f = (ts - t0) / STEP;
      for (const who of ['one', 'many']) {
        const p = P[who], last = p.length - 1, Ag = A[who];
        const i = Math.min(Math.floor(f), last);
        const k = i >= last ? 1 : Math.min(1, (f - i) * 1.3);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
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
  function bringIntoView() { const r = root.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }

  root.querySelectorAll('[data-rivers]').forEach((b) => b.addEventListener('click', () => {
    n = +b.dataset.rivers;
    root.querySelectorAll('[data-rivers]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    L = firstLayout(n); lastMany = null; drawTally(); started = true; run('layout');
  }));
  $('[data-next]').addEventListener('click', () => newLayout());
  $('[data-move]').addEventListener('click', () => moveGaps());
  $('[data-stage]').addEventListener('click', () => newLayout());
  const playBtn = $('[data-play]');
  if (reduce) playBtn.hidden = true;
  playBtn.addEventListener('click', () => {
    running = !running;
    playBtn.textContent = running ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(!running));
    if (running) next(); else clearTimeout(timer);
  });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable], dialog[open]')) return;
    if (e.key === 'r' || e.key === 'R') moveGaps(true);
    else if (e.key === 'n' || e.key === 'N') newLayout(true);
  });

  L = firstLayout(n);
  drawTally();
  // draw the field still until it's on screen, then start
  drawField(L);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView && !started) { started = true; setTimeout(() => run('layout'), reduce ? 0 : 350); }
      else if (inView && pending && running) { pending = false; next(); }
    }, { threshold: 0.35 }).observe(root);
  } else { inView = true; started = true; run('layout'); }
  window.lava = { newLayout, moveGaps };
})();
