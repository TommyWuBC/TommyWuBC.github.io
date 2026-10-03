/* The notebook. One ordered list of .page sections becomes either
   - a bound book (wide screens): leaves you turn by dragging a corner, clicking a tab, or arrow keys
   - a pocket notebook (narrow screens): one sheet at a time, flipped up over a top spiral.
   Page 0 is the inside front cover, the last page is the inside back cover;
   every pair in between is one leaf (front = right page, back = next left page). */
(() => {
  const book = document.getElementById('book');
  if (!book) return;
  const main = book.parentElement;
  const statusEl = document.getElementById('book-status');
  const hint = document.getElementById('book-hint');
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pages = [...book.querySelectorAll(':scope > .page')];
  const N = pages.length, L = (N - 2) / 2, SPREADS = L + 1;
  const W = 1120, H = 760, PAD_X = 56, PAD_TOP = 18, PAD_BOT = 70;
  pages.forEach((p, i) => p.classList.add(i % 2 ? 'r' : 'l'));
  const spreadOf = (pi) => Math.floor(pi / 2);
  const tabs = pages.map((p, pi) => p.dataset.tab ? { label: p.dataset.tab, c: p.dataset.tabc, pi, spread: spreadOf(pi), leaf: pi % 2 ? (pi - 1) / 2 : pi / 2 - 1 } : null).filter(Boolean);
  const mk = (tag, cls, attrs = {}) => { const n = document.createElement(tag); n.className = cls + ' gen'; for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let mode = null, cur = 0, stage = null, leaves = [], grabs = {}, edges = {}, sheets = [], ptabs = [], raf = 0, drag = null, pendingFocus = null;

  /* ---------------- desk ---------------- */
  function buildDesk() {
    stage = mk('div', 'stage');
    book.before(stage); stage.append(book);
    book.classList.add('desk');
    book.prepend(mk('div', 'cover', { 'aria-hidden': 'true' }));
    edges.l = mk('div', 'edge edge-l', { 'aria-hidden': 'true' });
    edges.r = mk('div', 'edge edge-r', { 'aria-hidden': 'true' });
    book.append(edges.l, edges.r);
    leaves = [];
    for (let i = 0; i < L; i++) {
      const el = mk('div', 'leaf'), front = mk('div', 'face front'), back = mk('div', 'face back');
      front.append(pages[2 * i + 1]); back.append(pages[2 * i + 2]);
      el.append(front, back); book.append(el);
      leaves.push({ el, front, back, a: 0, anim: null, tabs: [] });
    }
    tabs.forEach((t, j) => {
      const lf = leaves[t.leaf];
      for (const face of ['front', 'back']) {
        const b = mk('button', `tab c${t.c}`, { type: 'button', 'data-spread': t.spread });
        b.style.setProperty('--ty', 70 + j * 118 + 'px');
        b.textContent = t.label;
        b.addEventListener('click', () => go(t.spread, { focus: pages[t.pi] }));
        lf[face].append(b); lf.tabs.push({ b, face, spread: t.spread });
      }
    });
    for (const side of ['l', 'r']) {
      const g = mk('div', `grab grab-${side}`, { 'aria-hidden': 'true', title: side === 'r' ? 'Drag to turn the page' : 'Drag to turn back' });
      g.addEventListener('pointerdown', (e) => startDrag(e, side));
      g.addEventListener('pointerenter', () => book.classList.add('peek-' + side));
      g.addEventListener('pointerleave', () => book.classList.remove('peek-' + side));
      book.append(g, mk('div', `fold fold-${side}`, { 'aria-hidden': 'true' }));
      grabs[side] = g;
    }
    book.append(mk('div', 'ribbon', { 'aria-hidden': 'true' }));
    if (hint) hint.textContent = 'Drag a page corner, click a tab, or use the arrow keys.';
    fit();
  }

  // the one orchestrated moment: on a first visit the closed notebook swings open
  function openCover() {
    let seen = false;
    try { seen = sessionStorage.getItem('opened') === '1'; sessionStorage.setItem('opened', '1'); } catch (e) {}
    if (seen || reduce() || location.hash || cur !== 0) return;
    const lf = mk('div', 'leaf front-cover', { 'aria-hidden': 'true' });
    const front = mk('div', 'face front'), back = mk('div', 'face back');
    front.innerHTML = '<div class="fc-out"><div class="fc-label"><b>Tommy Wu</b><span>notes and work, 2025 to now</span></div></div>';
    back.innerHTML = '<div class="fc-in"></div>';
    lf.append(front, back); book.append(lf);
    book.classList.add('no-tr', 'closed');
    book.getBoundingClientRect();
    book.classList.remove('no-tr');
    const t0 = performance.now() + 380, dur = 1050;
    const step = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      if (p > 0 && book.classList.contains('closed')) book.classList.remove('closed');
      const a = -180 * ease(p);
      lf.style.transform = `rotateY(${a}deg)`;
      front.style.setProperty('--sh', Math.sin(p * Math.PI) * 0.6);
      back.style.opacity = p > 0.82 ? String(1 - (p - 0.82) / 0.18) : '1';
      if (p < 1) requestAnimationFrame(step); else lf.remove();
    };
    requestAnimationFrame(step);
    lf.addEventListener('pointerdown', () => { lf.remove(); book.classList.remove('closed'); });
  }

  function fit() {
    if (mode !== 'desk') return;
    const bw = W + PAD_X * 2, bh = H + PAD_TOP + PAD_BOT;
    const head = 56, foot = 46;
    const s = Math.min((innerWidth - 32) / bw, (innerHeight - head - foot - 10) / bh, 1.12);
    stage.style.width = bw * s + 'px'; stage.style.height = bh * s + 'px';
    book.style.setProperty('--s', s);
    book.style.setProperty('--ox', PAD_X * s + 'px');
    book.style.setProperty('--oy', PAD_TOP * s + 'px');
  }

  const target = (i, k) => (i < k ? -180 : 0);
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  function render(lf, i, moving) {
    const a = lf.a, t = Math.sin((-a / 180) * Math.PI);
    lf.el.style.transform = `rotateY(${a.toFixed(2)}deg)`;
    lf.front.style.setProperty('--sh', (t * 0.95).toFixed(3));
    lf.back.style.setProperty('--sh', (t * 0.7).toFixed(3));
    lf.el.style.setProperty('--lift', t.toFixed(3));
    lf.el.classList.toggle('moving', !!moving);
    lf.el.style.zIndex = moving ? (a > -90 ? 100 + (L - i) : 200 + i) : (a > -90 ? 20 + (L - i) : 20 + i);
  }

  function tick(now) {
    raf = 0;
    let active = false;
    leaves.forEach((lf, i) => {
      if (!lf.anim) return;
      const { from, to, t0, dur } = lf.anim;
      const p = (now - t0) / dur;
      if (p < 0) { active = true; return; }
      if (p >= 1) { lf.a = to; lf.anim = null; render(lf, i, false); return; }
      lf.a = from + (to - from) * ease(p);
      render(lf, i, true); active = true;
    });
    if (active) raf = requestAnimationFrame(tick); else settled();
  }

  function deskGo(k, instant) {
    let order = leaves.map((_, i) => i).filter((i) => leaves[i].a !== target(i, k) || leaves[i].anim);
    const back = order.some((i) => target(i, k) === 0);
    if (back) order.reverse();
    const many = order.length > 2;
    if (instant || reduce() || !order.length) {
      leaves.forEach((lf, i) => { lf.anim = null; lf.a = target(i, k); render(lf, i, false); });
      settled();
      return;
    }
    const now = performance.now();
    order.forEach((i, j) => {
      const lf = leaves[i], to = target(i, k), dist = Math.abs(to - lf.a) / 180;
      lf.anim = { from: lf.a, to, t0: now + j * (many ? 70 : 110), dur: (many ? 520 : 760) * Math.max(0.35, dist) };
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /* drag a corner: the page edge follows the pointer around the spine */
  function startDrag(e, side) {
    const i = side === 'r' ? cur : cur - 1;
    if (i < 0 || i >= L || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const lf = leaves[i]; lf.anim = null;
    drag = { i, side, x0: e.clientX, moved: false, lx: e.clientX, lt: performance.now(), vx: 0, el: e.currentTarget };
    const move = (ev) => {
      if (!drag) return;
      if (Math.abs(ev.clientX - drag.x0) > 5) drag.moved = true;
      if (!drag.moved) return;
      const r = book.getBoundingClientRect();
      const xr = clamp((ev.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      lf.a = -Math.acos(xr) * 180 / Math.PI;
      const t = performance.now();
      drag.vx = 0.7 * drag.vx + 0.3 * ((ev.clientX - drag.lx) / Math.max(1, t - drag.lt));
      drag.lx = ev.clientX; drag.lt = t;
      render(lf, i, true);
    };
    const up = () => {
      drag.el.removeEventListener('pointermove', move);
      drag.el.removeEventListener('pointerup', up);
      drag.el.removeEventListener('pointercancel', up);
      const d = drag; drag = null;
      if (!d.moved) return go(side === 'r' ? cur + 1 : cur - 1);
      const a = lf.a;
      const commit = side === 'r' ? (a < -90 || d.vx < -0.5) : (a > -90 || d.vx > 0.5);
      go(commit ? (side === 'r' ? cur + 1 : cur - 1) : cur);
    };
    drag.el.addEventListener('pointermove', move);
    drag.el.addEventListener('pointerup', up);
    drag.el.addEventListener('pointercancel', up);
  }

  /* ---------------- pocket ---------------- */
  function buildPocket() {
    book.classList.add('pocket');
    const nav = mk('nav', 'ptabs', { 'aria-label': 'Sections' });
    ptabs = [{ label: 'Index', c: 0, spread: 0, pi: 1 }, ...tabs].map((t) => {
      const b = mk('button', `ptab c${t.c}`, { type: 'button' });
      b.textContent = t.label;
      b.addEventListener('click', () => go(t.spread, { focus: pages[t.pi] }));
      nav.append(b);
      return { b, spread: t.spread };
    });
    const wrap = mk('div', 'sheets');
    sheets = [];
    for (let k = 0; k < SPREADS; k++) {
      const s = mk('div', 'sheet');
      s.append(pages[2 * k], pages[2 * k + 1]);
      const sn = mk('div', 'sheet-nav');
      if (k > 0) { const b = mk('button', 'prev', { type: 'button' }); b.textContent = 'Back a page'; b.addEventListener('click', () => go(k - 1)); sn.append(b); }
      if (k < SPREADS - 1) {
        const b = mk('button', 'next', { type: 'button' });
        b.innerHTML = 'Turn to <span></span>';
        b.querySelector('span').textContent = pages[2 * k + 2].dataset.title.toLowerCase();
        b.addEventListener('click', () => go(k + 1, { focus: pages[2 * k + 2] }));
        sn.append(b);
      }
      s.append(sn); wrap.append(s); sheets.push(s);
    }
    book.append(nav, mk('div', 'spiral', { 'aria-hidden': 'true' }), wrap);
    if (hint) hint.textContent = '';
  }

  function pocketGo(k, prev, instant) {
    const out = sheets[prev], inn = sheets[k];
    sheets.forEach((s) => s.getAnimations().forEach((a) => a.finish()));
    if (instant || reduce() || prev === k || !out.animate) {
      sheets.forEach((s, j) => { s.hidden = j !== k; s.classList.remove('flying'); });
      return settled();
    }
    const top = book.getBoundingClientRect().top + scrollY - 4;
    if (scrollY > top) scrollTo({ top, behavior: 'instant' });
    inn.hidden = false;
    const opts = { duration: 640, easing: 'cubic-bezier(.45,.05,.25,1)' };
    if (k > prev) {
      out.classList.add('flying');
      const a = out.animate([
        { transform: 'rotateX(0deg)', opacity: 1 },
        { transform: 'rotateX(-80deg)', opacity: 1, offset: 0.8 },
        { transform: 'rotateX(-96deg)', opacity: 0 },
      ], opts);
      a.onfinish = () => { out.hidden = true; out.classList.remove('flying'); settled(); };
    } else {
      inn.classList.add('flying');
      const a = inn.animate([
        { transform: 'rotateX(-96deg)', opacity: 0 },
        { transform: 'rotateX(-80deg)', opacity: 1, offset: 0.2 },
        { transform: 'rotateX(0deg)', opacity: 1 },
      ], opts);
      a.onfinish = () => { inn.classList.remove('flying'); out.hidden = true; settled(); };
    }
  }

  /* ---------------- shared ---------------- */
  function go(k, { instant = false, focus = null, hash = true } = {}) {
    k = clamp(k, 0, SPREADS - 1);
    const prev = cur; cur = k;
    pendingFocus = focus;
    pages.forEach((p) => p.classList.remove('shown'));
    if (mode === 'desk') deskGo(k, instant); else pocketGo(k, prev, instant);
    // state that should change immediately
    const shownPages = [pages[2 * k], pages[2 * k + 1]];
    pages.forEach((p) => { if (mode === 'desk') p.inert = !shownPages.includes(p); else p.inert = false; });
    const active = [...tabs].reverse().find((t) => t.spread <= k);
    leaves.forEach((lf, i) => lf.tabs.forEach(({ b, face, spread }) => {
      const visible = face === 'front' ? i >= k : i < k;
      b.tabIndex = visible ? 0 : -1;
      b.setAttribute('aria-hidden', String(!visible));
      b.setAttribute('aria-current', String(!!active && spread === active.spread));
    }));
    ptabs.forEach(({ b, spread }) => b.setAttribute('aria-current', String(spread === (active && k >= active.spread ? active.spread : 0))));
    if (edges.l) { edges.l.style.setProperty('--n', k); edges.r.style.setProperty('--n', L - k); }
    if (grabs.r) { grabs.r.hidden = k >= L; grabs.l.hidden = k <= 0; }
    if (hash && prev !== k) history.replaceState(null, '', k === 0 ? location.pathname : '#' + (focus && focus.id ? focus.id : pages[2 * k].id));
    if (statusEl && prev !== k) statusEl.textContent = k === 0 ? 'Cover and index' : `Pages ${2 * k} and ${Math.min(2 * k + 1, N - 2)}: ${pages[2 * k].dataset.title}`;
  }

  function settled() {
    pages[2 * cur].classList.add('shown'); pages[2 * cur + 1].classList.add('shown');
    if (pendingFocus) {
      const f = pendingFocus; pendingFocus = null;
      if (!f.matches('a, button, input, [tabindex]')) f.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: mode === 'desk' });
      if (mode === 'pocket' && f !== pages[2 * cur]) f.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
    }
  }

  function goToId(id, focus) {
    const el = document.getElementById(id);
    if (!el || !book.contains(el)) return false;
    const page = el.closest('.page');
    const k = spreadOf(pages.indexOf(page));
    go(k, { focus: focus ? el : null });
    if (k === cur) history.replaceState(null, '', '#' + id);
    return true;
  }

  function teardown() {
    pages.forEach((p) => { p.inert = false; book.append(p); });
    book.querySelectorAll('.gen').forEach((n) => n.remove());
    book.classList.remove('desk', 'pocket', 'peek-l', 'peek-r');
    book.removeAttribute('style');
    if (stage) { stage.before(book); stage.remove(); stage = null; }
    leaves = []; sheets = []; ptabs = []; grabs = {}; edges = {};
  }

  const mq = matchMedia('(min-width: 900px) and (min-height: 600px)');
  function setup() {
    const m = mq.matches ? 'desk' : 'pocket';
    if (m === mode) return fit();
    const keep = cur;
    teardown();
    mode = m;
    if (m === 'desk') buildDesk(); else buildPocket();
    cur = keep;
    go(keep, { instant: true, hash: false });
  }

  // first spread from the hash
  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    const page = el && el.closest('.page');
    return page ? { k: spreadOf(pages.indexOf(page)), el } : { k: 0, el: null };
  };
  const h = fromHash();
  cur = h.k;
  setup();
  if (mode === 'desk') { openCover(); requestAnimationFrame(() => scrollTo(0, 0)); }
  if (h.el && h.el !== pages[2 * cur]) { pendingFocus = h.el; settled(); }

  addEventListener('resize', setup);
  addEventListener('hashchange', () => { const x = fromHash(); go(x.k, { focus: x.el, hash: false }); });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (goToId(id, true)) e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, [contenteditable], dialog[open], .photo')) return;
    if (mode === 'desk' && (e.key === 'ArrowRight' || e.key === 'PageDown')) { e.preventDefault(); go(cur + 1); }
    else if (mode === 'desk' && (e.key === 'ArrowLeft' || e.key === 'PageUp')) { e.preventDefault(); go(cur - 1); }
  });

  window.notebook = { go, goToId, get spread() { return cur; }, get mode() { return mode; } };
})();
