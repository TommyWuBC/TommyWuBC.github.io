/* The notebook. One ordered list of .page sections becomes either
   - a bound book (wide screens): leaves you turn by clicking near an edge, dragging a page, clicking a tab, or arrow keys
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // A tab rides the leaf its page is on. The inside covers aren't on a leaf, so
  // their tabs (Home, Résumé) ride the first and last leaves instead.
  const tabs = pages.map((p, pi) => p.dataset.tab ? { label: p.dataset.tab, c: p.dataset.tabc, pi, spread: spreadOf(pi), leaf: clamp(pi % 2 ? (pi - 1) / 2 : pi / 2 - 1, 0, L - 1) } : null).filter(Boolean);
  const mk = (tag, cls, attrs = {}) => { const n = document.createElement(tag); n.className = cls + ' gen'; for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  let mode = null, cur = 0, stage = null, leaves = [], edges = {}, sheets = [], ptabs = [], raf = 0, drag = null, pending = null, pendingFocus = null, hintEl = null, flip = 0;
  // things a press should reach instead of turning the page
  const INTERACTIVE = 'a, button, input, select, textarea, label, summary, iframe, video, canvas, [contenteditable], [tabindex]:not([tabindex="-1"]), .photo, .front-cover';
  // a drag may start on a link (the index is mostly links); only real controls are off limits
  const NO_DRAG = 'button, input, select, textarea, label, summary, iframe, video, canvas, [contenteditable], .photo, .front-cover';
  const ZONE = 0.24; // outer share of each page where a click turns it
  let swallowClick = false;

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
      // shading lives on its own element: animating an inherited custom property would restyle the whole page every frame
      const fs = mk('div', 'shade'), bs = mk('div', 'shade');
      front.append(pages[2 * i + 1], fs); back.append(pages[2 * i + 2], bs);
      el.append(front, back); book.append(el);
      leaves.push({ el, front, back, fs, bs, a: 0, anim: null, tabs: [] });
    }
    tabs.forEach((t, j) => {
      const lf = leaves[t.leaf];
      for (const face of ['front', 'back']) {
        const b = mk('button', `tab c${t.c}`, { type: 'button', 'data-spread': t.spread });
        b.style.setProperty('--ty', 22 + j * Math.min(118, (H - 44 - 86) / Math.max(1, tabs.length - 1)) + 'px');
        b.textContent = t.label;
        b.addEventListener('click', () => go(t.spread, { focus: pages[t.pi] }));
        lf[face].append(b); lf.tabs.push({ b, face, spread: t.spread });
      }
    });
    for (const side of ['l', 'r']) book.append(mk('div', `fold fold-${side}`, { 'aria-hidden': 'true' }));
    book.append(mk('div', 'ribbon', { 'aria-hidden': 'true' }));
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onHover);
    stage.addEventListener('pointerleave', () => setPeek(null));
    stage.addEventListener('dragstart', (e) => { if (pending || drag) e.preventDefault(); });
    stage.addEventListener('click', (e) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); } }, true);
    // iPad Safari: claim a sideways drag at its first touchmove. Otherwise Safari starts panning and
    // rubber-banding the whole page, cancels the pointer, and the page turn never happens (or shakes).
    stage.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      if (drag) return e.preventDefault();
      if (!pending) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - pending.x0) >= Math.abs(t.clientY - pending.y0)) e.preventDefault();
    }, { passive: false });
    if (hint) hint.textContent = 'Click near a page edge or drag a page to turn it. Tabs and arrow keys work too.';
    fit();
  }

  // the one orchestrated moment: on a first visit the closed notebook swings open
  function openCover() {
    let seen = false;
    try { seen = sessionStorage.getItem('opened') === '1'; sessionStorage.setItem('opened', '1'); } catch (e) {}
    if (seen || reduce() || location.hash || cur !== 0) return false;
    const lf = mk('div', 'leaf front-cover', { 'aria-hidden': 'true' });
    const front = mk('div', 'face front'), back = mk('div', 'face back');
    front.innerHTML = '<div class="fc-out"><div class="fc-label"><b>Tommy Wu</b><span>notes and work, 2025 to now</span></div></div>';
    back.innerHTML = '<div class="fc-in"></div>';
    // the inside cover (page 0) rides on the back of the turning cover, like in a real notebook:
    // its contents are there the whole way and it simply lands in place, nothing pops in afterwards
    const inside = pages[0], home = inside.nextSibling;
    back.append(inside);
    lf.append(front, back); book.append(lf);
    // 'opening' keeps the left half of the board (and ribbon) hidden until the cover lands there
    book.classList.add('no-tr', 'closed', 'opening');
    book.getBoundingClientRect();
    book.classList.remove('no-tr');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      book.insertBefore(inside, home);
      lf.remove();
      book.classList.remove('closed', 'opening');
    };
    const t0 = performance.now() + 380, dur = 1050;
    const step = (now) => {
      if (done) return;
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      if (p > 0 && book.classList.contains('closed')) book.classList.remove('closed');
      const a = -180 * ease(p);
      lf.style.transform = `rotateY(${a}deg)`;
      // switch faces explicitly at the edge: Safari can leak a face through its back mid-turn
      front.style.visibility = a <= -90 ? 'hidden' : 'visible';
      back.style.visibility = a <= -90 ? 'visible' : 'hidden';
      front.style.setProperty('--sh', Math.sin(p * Math.PI) * 0.6);
      if (p < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
    lf.addEventListener('pointerdown', finish);
    return true;
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
    // Safari can leak transformed/filter-layer children (notably stickers)
    // through a face's back side. Switch faces explicitly at the page edge.
    lf.front.style.visibility = a <= -90 ? 'hidden' : 'visible';
    lf.back.style.visibility = a <= -90 ? 'visible' : 'hidden';
    lf.fs.style.opacity = (t * 0.95).toFixed(3);
    lf.bs.style.opacity = (t * 0.7).toFixed(3);
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

  /* turning by hand. A click near a page's outer edge turns it; a sideways drag
     anywhere on a page (not on a link or photo) picks the page up and follows the pointer. */
  const free = (e) => !e.target.closest(INTERACTIVE) && !book.classList.contains('closed');
  function zoneAt(x) {
    const r = book.getBoundingClientRect(), z = (r.width / 2) * ZONE;
    if (x > r.right - z && cur < L) return 'r';
    if (x < r.left + z && cur > 0) return 'l';
    return null;
  }
  function setPeek(side) {
    book.classList.toggle('peek-r', side === 'r');
    book.classList.toggle('peek-l', side === 'l');
    if (stage) stage.classList.toggle('turnable', !!side);
  }
  function onHover(e) {
    if (drag || pending || e.pointerType !== 'mouse') return;
    setPeek(free(e) ? zoneAt(e.clientX) : null);
  }
  function onDown(e) {
    if (hintShown()) dismissHint();
    if (e.button > 0 || drag || book.classList.contains('closed') || e.target.closest(NO_DRAG)) return;
    const r = book.getBoundingClientRect();
    // a plain click on a link follows the link; only a click on bare page near the edge turns it
    pending = { id: e.pointerId, x0: e.clientX, y0: e.clientY, zone: free(e) ? zoneAt(e.clientX) : null, right: e.clientX > r.left + r.width / 2 };
    const move = (ev) => {
      if (!pending || ev.pointerId !== pending.id) return;
      const dx = ev.clientX - pending.x0, dy = ev.clientY - pending.y0;
      if (Math.hypot(dx, dy) < 8) return;
      const p = pending; end();
      // only a mostly-sideways pull toward the spine picks the page up
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const side = p.right && dx < 0 ? 'r' : !p.right && dx > 0 ? 'l' : null;
      if (side) startDrag(side, ev.pointerId, p.x0);
    };
    const up = (ev) => {
      if (!pending || ev.pointerId !== pending.id) return;
      const p = pending; end();
      if (ev.type === 'pointerup' && p.zone) go(p.zone === 'r' ? cur + 1 : cur - 1);
    };
    const end = () => {
      pending = null;
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  function startDrag(side, pointerId, x0) {
    const i = side === 'r' ? cur : cur - 1;
    if (i < 0 || i >= L) return;
    try { stage.setPointerCapture(pointerId); } catch (e) {}
    getSelection()?.removeAllRanges();
    stage.classList.add('turning'); setPeek(null);
    const lf = leaves[i]; lf.anim = null;
    // relative: the page keeps its current angle and moves with the pointer, no jump
    const c0 = Math.cos((lf.a * Math.PI) / 180);
    const half = book.getBoundingClientRect().width / 2; // measured once: reading layout per move would force a reflow each time
    drag = { i, side, lx: x0, lt: performance.now(), vx: 0 };
    let fx = x0, frame = 0;
    const paint = () => {
      frame = 0;
      lf.a = -Math.acos(clamp(c0 + (fx - x0) / half, -1, 1)) * 180 / Math.PI;
      render(lf, i, true);
    };
    const move = (ev) => {
      if (!drag || ev.pointerId !== pointerId) return;
      const t = performance.now();
      drag.vx = 0.7 * drag.vx + 0.3 * ((ev.clientX - drag.lx) / Math.max(1, t - drag.lt));
      drag.lx = fx = ev.clientX; drag.lt = t;
      if (!frame) frame = requestAnimationFrame(paint); // at most one render per frame
    };
    const up = (ev) => {
      if (ev.pointerId !== pointerId) return;
      if (frame) { cancelAnimationFrame(frame); paint(); }
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      stage.classList.remove('turning');
      // the drag may have started on a link: don't let the click that follows open it
      swallowClick = true; setTimeout(() => (swallowClick = false), 0);
      const d = drag; drag = null;
      const a = lf.a;
      const commit = side === 'r' ? (a < -90 || d.vx < -0.4) : (a > -90 || d.vx > 0.4);
      go(commit ? (side === 'r' ? cur + 1 : cur - 1) : cur);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  /* first visit: a sticky note and a nudge of the page show how turning works */
  function showHint(delay) {
    let seen = false;
    try { seen = localStorage.getItem('nb-turn-hint') === '1'; } catch (e) {}
    if (seen) return;
    const desk = mode === 'desk';
    hintEl = mk('div', 'turn-hint ' + (desk ? 'th-desk' : 'th-pocket'), { 'aria-hidden': 'true' });
    hintEl.innerHTML = desk
      ? '<span class="th-ring"></span><p class="th-note hand">psst: click near the edge of a page, or grab it and drag, to turn it <b>→</b></p>'
      : '<p class="th-note hand">swipe a page sideways to turn it, or tap a tab up top</p>';
    book.append(hintEl);
    const el = hintEl;
    setTimeout(() => {
      if (hintEl !== el) return;
      // only counts as seen once it has actually been on screen
      try { localStorage.setItem('nb-turn-hint', '1'); } catch (e) {}
      el.classList.add('on');
      if (desk && !reduce()) { setTimeout(() => nudge(cur), 500); setTimeout(() => nudge(cur), 2300); }
      setTimeout(dismissHint, 6500);
    }, delay);
  }
  // a click before the note appears (say, during the cover opening) shouldn't cancel it; turning a page does
  const hintShown = () => !!hintEl && hintEl.classList.contains('on');
  function dismissHint() {
    if (!hintEl) return;
    const el = hintEl; hintEl = null;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 500);
  }
  function nudge(i) {
    const lf = leaves[i];
    if (!hintEl || !lf || lf.anim || drag || pending) return;
    const t0 = performance.now(), dur = 1000;
    const step = (now) => {
      if (drag || lf.anim || cur !== i) return; // the reader took over
      const p = Math.min(1, (now - t0) / dur);
      lf.a = -26 * Math.sin(Math.PI * p);
      render(lf, i, p < 1);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- pocket ---------------- */
  function buildPocket() {
    book.classList.add('pocket');
    const nav = mk('nav', 'ptabs', { 'aria-label': 'Sections' });
    ptabs = (tabs[0] && tabs[0].spread === 0 ? tabs : [{ label: 'Index', c: 0, spread: 0, pi: 1 }, ...tabs]).map((t) => {
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
    // swipe a sheet sideways to turn it (touch and pen; vertical scrolling stays native)
    let sw = null;
    wrap.addEventListener('pointerdown', (e) => {
      if (hintShown()) dismissHint();
      sw = e.pointerType === 'mouse' || e.target.closest(INTERACTIVE) ? null : { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    wrap.addEventListener('pointerup', (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1), { focus: dx < 0 ? pages[2 * cur + 2] : null });
    });
    wrap.addEventListener('pointercancel', () => (sw = null));
    if (hint) hint.textContent = '';
  }

  function pocketGo(k, prev, instant) {
    const out = sheets[prev], inn = sheets[k];
    // a newer turn supersedes a running one: cancel it (no onfinish) so its late cleanup can't hide the new sheet
    const id = ++flip;
    sheets.forEach((s, j) => { s.getAnimations().forEach((a) => a.cancel()); s.classList.remove('flying'); s.hidden = j !== prev && j !== k; });
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
      a.onfinish = () => { if (id !== flip) return; out.hidden = true; out.classList.remove('flying'); settled(); };
    } else {
      inn.classList.add('flying');
      const a = inn.animate([
        { transform: 'rotateX(-96deg)', opacity: 0 },
        { transform: 'rotateX(-80deg)', opacity: 1, offset: 0.2 },
        { transform: 'rotateX(0deg)', opacity: 1 },
      ], opts);
      a.onfinish = () => { if (id !== flip) return; inn.classList.remove('flying'); out.hidden = true; settled(); };
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
    if (prev !== k) dismissHint();
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
    leaves = []; sheets = []; ptabs = []; edges = {}; hintEl = null;
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
  if (mode === 'desk') { const animated = openCover(); requestAnimationFrame(() => scrollTo(0, 0)); showHint(animated ? 1700 : 700); }
  else showHint(900);
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
