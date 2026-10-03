export {};
// The zine's moving parts. Everything here enhances pages that already read
// fine laid flat without it.
//   1. The masthead: set to measure on the font's width axis, printed into
//      register on load, misregistered again on click.
//   2. Stickers on the cover: drag to peel, drop to re-stick, arrow keys.
//   3. The stapled booklet: drag a page (3D leaf, spring, flick), dog-ears,
//      buttons, arrow keys, contents links, "Lay them flat".
// Demos inside pages can listen for `zine:spread` on window, and should check
// `page.inert` before animating (a turned-away page is inert).

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()) as Promise<unknown>;
const store = {
  get<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const scene = $('[data-zine-scene]');
if (scene) init(scene);

function init(scene: HTMLElement) {
  /* ------------------------------------------------------------ 1. masthead */
  const mast = $('[data-mast]', scene);
  if (mast) {
    const ink = $('.ink', mast)!;
    // Size to fill the cover's measure: first the size (at a condensed width),
    // then widen the face so short titles still run edge to edge.
    const fit = () => {
      const host = mast.parentElement!;
      const cs = getComputedStyle(host);
      const avail = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (avail <= 0) return;
      mast.classList.remove('wraps');
      mast.style.fontVariationSettings = '"wdth" 62';
      let lo = 24, hi = avail * 0.34;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        mast.style.fontSize = mid + 'px';
        if (ink.offsetWidth > avail) hi = mid; else lo = mid;
      }
      if (lo < avail * 0.12) { // too long to sit on one line: let it wrap at a readable size
        mast.classList.add('wraps');
        mast.style.fontSize = Math.max(34, avail * 0.12) + 'px';
        return;
      }
      mast.style.fontSize = lo + 'px';
      let wl = 62, wh = 130;
      for (let i = 0; i < 12; i++) {
        const mid = (wl + wh) / 2;
        mast.style.fontVariationSettings = `"wdth" ${mid}`;
        if (ink.offsetWidth > avail * 0.995) wh = mid; else wl = mid;
      }
      mast.style.fontVariationSettings = `"wdth" ${wl.toFixed(2)}`;
    };
    const print = () => { mast.classList.add('printing'); requestAnimationFrame(() => mast.classList.add('printed')); };
    fontsReady.then(() => { fit(); setTimeout(print, reduce() ? 0 : 160); });
    setTimeout(print, 1600); // in case the font never arrives
    let ft = 0;
    new ResizeObserver(() => { clearTimeout(ft); ft = window.setTimeout(fit, 80); }).observe(mast.parentElement!);
    mast.addEventListener('click', () => {
      if (reduce()) return;
      ink.style.setProperty('--mx', rand(-.16, .2).toFixed(3) + 'em');
      ink.style.setProperty('--my', rand(-.1, .1).toFixed(3) + 'em');
      setTimeout(() => {
        ink.style.setProperty('--mx', rand(.014, .045).toFixed(3) + 'em');
        ink.style.setProperty('--my', rand(-.02, .03).toFixed(3) + 'em');
      }, 140);
    });
  }

  /* ------------------------------------------------------------ 2. stickers */
  const strip = $('[data-stickers]', scene);
  if (strip) stickers(strip);

  /* ------------------------------------------------------------ 3. booklet */
  const zine = $('[data-zine]', scene);
  if (zine) booklet(scene, zine);
}

/* ================================================================ stickers */
function stickers(strip: HTMLElement) {
  const page = strip.closest<HTMLElement>('.zpage')!;
  const key = strip.dataset.key || 'zine-stickers';
  type P = { x: number; y: number; r: number; z: number };
  const saved = store.get<Record<string, P>>(key) || {};
  const pos: Record<string, P> = {};
  const els = $$('.zsticker', strip);
  let top = els.length;

  const apply = (s: HTMLElement) => {
    const p = pos[s.dataset.id!];
    s.style.setProperty('--x', (p.x * strip.clientWidth).toFixed(1) + 'px');
    s.style.setProperty('--y', p.y.toFixed(1) + 'px');
    s.style.setProperty('--r', p.r.toFixed(2) + 'deg');
    s.style.zIndex = String(4 + p.z);
  };
  const save = () => store.set(key, pos);
  const applyAll = () => els.forEach(apply);

  els.forEach((s, i) => {
    const [x, y, r] = (s.dataset.pos || '0,0,0').split(',').map(Number);
    pos[s.dataset.id!] = saved[s.dataset.id!] || { x, y, r, z: i + 1 };
    top = Math.max(top, pos[s.dataset.id!].z);
    s.tabIndex = 0;
    s.setAttribute('role', 'button');
    s.setAttribute('aria-roledescription', 'sticker');
    s.setAttribute('aria-label', `Sticker: ${s.textContent!.replace(/\s+/g, ' ').trim()}`);
    s.setAttribute('aria-describedby', 'sticker-help');
  });
  applyAll();
  new ResizeObserver(applyAll).observe(strip);

  const raise = (s: HTMLElement) => { pos[s.dataset.id!].z = ++top; s.style.zIndex = String(4 + top); };
  const restick = (s: HTMLElement) => { s.classList.remove('stuck'); void s.offsetWidth; s.classList.add('stuck'); };
  // bounds: anywhere on the cover, in strip coordinates
  const bounds = (s: HTMLElement) => {
    const W = strip.clientWidth;
    const top0 = -strip.offsetTop + 8;
    const maxY = page.clientHeight - strip.offsetTop - s.offsetHeight - 6;
    return { minX: -8 / W, maxX: (W - s.offsetWidth + 8) / W, minY: top0, maxY: Math.max(top0, maxY) };
  };

  els.forEach((s) => {
    let drag: null | { id: number; x0: number; y0: number; px: number; py: number; r0: number; moved: boolean; lastX: number; vx: number } = null;
    s.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      s.focus({ preventScroll: true });
      const p = pos[s.dataset.id!];
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, r0: p.r, moved: false, lastX: e.clientX, vx: 0 };
      raise(s);
      s.setPointerCapture(e.pointerId);
      s.classList.add('dragging');
    });
    s.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      drag.vx = drag.vx * .7 + (e.clientX - drag.lastX) * .3; drag.lastX = e.clientX;
      const b = bounds(s), p = pos[s.dataset.id!];
      p.x = clamp(drag.px + dx / strip.clientWidth, b.minX, b.maxX);
      p.y = clamp(drag.py + dy, b.minY, b.maxY);
      p.r = drag.r0 + clamp(drag.vx * .8, -9, 9); // it swings a little as it travels
      apply(s);
    });
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = pos[s.dataset.id!];
      p.r = clamp(drag.r0 + rand(-4, 4), -16, 16);
      apply(s);
      s.classList.remove('dragging');
      restick(s);
      drag = null; save();
    };
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
    s.addEventListener('keydown', (e) => {
      const p = pos[s.dataset.id!], step = e.shiftKey ? 48 : 12;
      const mv = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
      if (mv) {
        e.preventDefault(); e.stopPropagation();
        const b = bounds(s);
        p.x = clamp(p.x + mv[0] / strip.clientWidth, b.minX, b.maxX);
        p.y = clamp(p.y + mv[1], b.minY, b.maxY);
        raise(s); apply(s); save();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        raise(s); p.r = clamp(p.r + rand(-5, 5), -16, 16); apply(s); restick(s); save();
      }
    });
  });
}

/* ================================================================ booklet */
function booklet(scene: HTMLElement, zine: HTMLElement) {
  const ctl = $('[data-zine-ctl]', scene)!;
  const count = $('[data-zine-count]', scene)!;
  const flatBtn = $<HTMLButtonElement>('[data-flat]', scene)!;
  const turnBtns = $$<HTMLButtonElement>('[data-turn]', scene);
  let pages = $$<HTMLElement>(':scope > .zpage', zine);

  // The leaves have to pair up: cover glued left, back cover glued right.
  // An odd number of pages gets a blank notes page before the back cover.
  if (pages.length % 2 === 1) {
    const blank = document.createElement('section');
    blank.className = 'zpage zp-blank';
    blank.setAttribute('aria-label', 'Blank page');
    blank.innerHTML = '<p class="zp-note">notes</p><div class="lines" aria-hidden="true"></div>';
    zine.insertBefore(blank, pages[pages.length - 1]);
    pages = $$<HTMLElement>(':scope > .zpage', zine);
  }
  const N = pages.length;
  const LEAVES = (N - 2) / 2;
  const front = (j: number) => pages[2 * j + 1];
  const back = (j: number) => pages[2 * j + 2];
  const wide = matchMedia('(min-width: 960px)');
  const theta: number[] = Array(LEAVES).fill(0);
  const anim: (object | string | null)[] = Array(LEAVES).fill(null);
  let spread = 0, flat = store.get<boolean>('zine-flat') === true, booklet = false;
  let staples: HTMLElement[] = [];

  // folios for the contents list: the counter the CSS prints
  const folio = (p: HTMLElement) => {
    const i = pages.indexOf(p);
    return pages.slice(1, i + 1).filter((q) => !q.matches('.zp-cover, .zp-back, .zp-blank')).length;
  };
  $$('[data-goto]', scene).forEach((a) => {
    const t = document.getElementById(a.dataset.goto!);
    const p = t?.closest<HTMLElement>('.zpage');
    const n = p && folio(p);
    if (n) $('.ztoc-n', a)!.textContent = String(n);
  });

  ctl.hidden = false;
  pages.forEach((p, i) => {
    const shade = document.createElement('span'); shade.className = 'shade'; shade.setAttribute('aria-hidden', 'true'); p.appendChild(shade);
    const isFront = i % 2 === 1 && i < N - 1;
    const isBack = i % 2 === 0 && i > 0;
    if (isFront) p.insertAdjacentHTML('beforeend', '<button type="button" class="zdogear zdogear-next" aria-label="Turn to the next pages" data-turn-page="1"></button>');
    if (isBack) p.insertAdjacentHTML('beforeend', '<button type="button" class="zdogear zdogear-prev" aria-label="Turn back to the previous pages" data-turn-page="-1"></button>');
    if (i === 0 || isBack) p.classList.add('on-left');
  });
  pages[0].classList.add('is-base-left');

  const T = (deg: number) => `perspective(3200px) rotateY(${deg}deg)`;
  function paint(j: number) {
    const t = theta[j], f = front(j), b = back(j);
    f.style.transform = T(t);
    b.style.transform = `${T(t)} translateX(100%) rotateY(180deg)`;
    const moving = !!anim[j] || (t !== 0 && t !== -180);
    const z = moving ? 150 : t > -90 ? 50 + (LEAVES - j) : 50 + j;
    f.style.zIndex = b.style.zIndex = String(z);
    f.classList.toggle('turning', moving); b.classList.toggle('turning', moving);
    const sh = Math.sin((-t * Math.PI) / 180) * .28;
    f.style.setProperty('--shade', (t > -90 ? sh : 0).toFixed(3));
    b.style.setProperty('--shade', (t <= -90 ? sh : 0).toFixed(3));
  }
  const visible = () => (booklet ? [pages[2 * spread], pages[2 * spread + 1]] : pages);
  function settle() {
    pages.forEach((p) => {
      p.inert = booklet && !visible().includes(p);
      p.classList.toggle('grabbable', booklet && ((p === pages[2 * spread + 1] && spread < LEAVES) || (p === pages[2 * spread] && spread > 0)));
    });
    window.dispatchEvent(new CustomEvent('zine:spread', { detail: { booklet, spread } }));
  }
  function label() {
    flatBtn.textContent = flat ? 'Staple them back' : 'Lay them flat';
    flatBtn.setAttribute('aria-pressed', String(flat));
    if (!booklet) { count.textContent = flat && wide.matches ? `All ${N} pages, laid flat` : ''; return; }
    const a = spread === 0 ? 'Cover' : `Page ${folio(pages[2 * spread]) || 'notes'}`;
    const bp = pages[2 * spread + 1];
    const b = bp.matches('.zp-back') ? 'back cover' : `page ${folio(bp) || 'notes'}`;
    count.textContent = `${a} and ${b}`;
    turnBtns[0].disabled = spread === 0; turnBtns[1].disabled = spread === LEAVES;
  }
  function measure() {
    let h = 0;
    pages.forEach((p) => { const old = p.style.height; p.style.height = 'auto'; h = Math.max(h, p.offsetHeight); p.style.height = old; });
    const w = zine.clientWidth / 2;
    zine.style.setProperty('--zh', Math.ceil(Math.max(h, w * 1.28)) + 'px');
  }
  function layout() {
    booklet = wide.matches && !flat;
    zine.classList.toggle('is-booklet', booklet);
    zine.classList.toggle('is-flat', flat);
    flatBtn.hidden = !wide.matches;
    turnBtns.forEach((b) => (b.hidden = !booklet));
    staples.forEach((s) => s.remove()); staples = [];
    if (booklet) {
      measure();
      for (let j = 0; j < LEAVES; j++) { theta[j] = j < spread ? -180 : 0; paint(j); }
      [.2, .8].forEach((y) => {
        const s = document.createElement('span'); s.className = 'staple'; s.setAttribute('aria-hidden', 'true');
        s.style.top = `calc(${y * 100}% - 23px)`; zine.appendChild(s); staples.push(s);
      });
      pages[0].style.zIndex = pages[N - 1].style.zIndex = '1';
    } else {
      pages.forEach((p) => { p.style.transform = ''; p.style.zIndex = ''; p.classList.remove('turning'); });
    }
    settle(); label();
  }

  // spring toward a target angle; a page never sinks through the table
  function animateLeaf(j: number, target: number, v0 = 0, delay = 0) {
    return new Promise<void>((done) => {
      if (reduce()) { theta[j] = target; anim[j] = null; paint(j); return done(); }
      const token = {}; anim[j] = token;
      let v = v0, last: number | null = null;
      const K = 150, C = 2 * Math.sqrt(K) * .82;
      const step = (ts: number) => {
        if (anim[j] !== token) return done();
        if (last === null) last = ts;
        const dt = Math.min(.032, (ts - last) / 1000); last = ts;
        const a = -K * (theta[j] - target) - C * v;
        v += a * dt; theta[j] += v * dt;
        if (theta[j] < -180) { theta[j] = -180; v = Math.abs(v) * .18; }
        if (theta[j] > 0) { theta[j] = 0; v = -Math.abs(v) * .18; }
        if (Math.abs(theta[j] - target) < .15 && Math.abs(v) < 2) { theta[j] = target; anim[j] = null; paint(j); return done(); }
        paint(j); requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), delay);
    });
  }

  function go(to: number, focus = false) {
    to = clamp(to, 0, LEAVES);
    if (!booklet || to === spread) return;
    const dir = to > spread ? 1 : -1;
    for (let j = spread, n = 0; j !== to; j += dir, n++) {
      const leaf = dir > 0 ? j : j - 1;
      animateLeaf(leaf, dir > 0 ? -180 : 0, dir > 0 ? -60 : 60, n * 110);
    }
    spread = to;
    settle(); label();
    if (focus) { const p = pages[2 * spread + 1]; p.tabIndex = -1; p.focus({ preventScroll: true }); }
  }
  const spreadOf = (p: HTMLElement) => Math.floor(pages.indexOf(p) / 2);

  turnBtns.forEach((b) => b.addEventListener('click', () => go(spread + Number(b.dataset.turn))));
  scene.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const d = t.closest<HTMLElement>('[data-turn-page]');
    if (d) { go(spread + Number(d.dataset.turnPage)); return; }
    const g = t.closest<HTMLAnchorElement>('[data-goto]');
    if (g && booklet) {
      const target = document.getElementById(g.dataset.goto!)?.closest<HTMLElement>('.zpage');
      if (target) { e.preventDefault(); go(spreadOf(target), true); history.replaceState(null, '', '#' + g.dataset.goto); }
    }
  });
  // arrow keys turn pages unless something on the page wants them
  document.addEventListener('keydown', (e) => {
    if (!booklet || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable], [data-noturn], .zsticker, dialog')) return;
    if (t !== document.body && !scene.contains(t)) return;
    const r = zine.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    e.preventDefault();
    go(spread + (e.key === 'ArrowRight' ? 1 : -1));
  });

  // Drag a page by any quiet bit of it. The edge follows the pointer like a real sheet.
  type Drag = { id: number; side: 1 | -1; leaf: number; x0: number; span: number; started: boolean; lastX: number; lastT: number; vx: number };
  let drag: Drag | null = null;
  zine.addEventListener('pointerdown', (e) => {
    if (!booklet || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('a, button, input, select, textarea, label, summary, canvas, [data-noturn], .zsticker, [role="slider"]')) return;
    const page = t.closest<HTMLElement>('.zpage'); if (!page) return;
    const i = pages.indexOf(page);
    const right = i === 2 * spread + 1 && spread < LEAVES;
    const left = i === 2 * spread && spread > 0;
    if (!right && !left) return;
    const zr = zine.getBoundingClientRect(), spine = zr.left + zr.width / 2, w = zr.width / 2;
    drag = { id: e.pointerId, side: right ? 1 : -1, leaf: right ? spread : spread - 1, x0: e.clientX,
      span: Math.max(2 * Math.abs(e.clientX - spine), w), started: false, lastX: e.clientX, lastT: performance.now(), vx: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.started) {
      if (Math.abs(dx) < 6) return;
      if (window.getSelection()?.toString()) { drag = null; return; } // they were selecting text
      drag.started = true; zine.classList.add('is-dragging'); anim[drag.leaf] = 'drag';
      try { zine.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    }
    const now = performance.now();
    drag.vx = drag.vx * .6 + ((e.clientX - drag.lastX) / Math.max(1, now - drag.lastT)) * .4;
    drag.lastX = e.clientX; drag.lastT = now;
    const p = clamp((drag.side > 0 ? -dx : dx) / drag.span, 0, 1);
    const a = (Math.acos(1 - 2 * p) * 180) / Math.PI; // 0..180, quick at first like a real sheet
    theta[drag.leaf] = drag.side > 0 ? -a : -180 + a;
    paint(drag.leaf);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    zine.classList.remove('is-dragging');
    if (!d.started) return;
    anim[d.leaf] = null;
    const t = theta[d.leaf];
    const flick = d.side > 0 ? d.vx < -.45 : d.vx > .45;
    const past = d.side > 0 ? t < -90 : t > -90;
    const v = d.vx * 220;
    if (flick || past) { spread += d.side; animateLeaf(d.leaf, d.side > 0 ? -180 : 0, v); settle(); label(); }
    else animateLeaf(d.leaf, d.side > 0 ? 0 : -180, v);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Lay flat / staple back, FLIP-animated so the pages visibly leave the spine.
  function toggleFlat() {
    const before = pages.map((p) => p.getBoundingClientRect());
    const keep = visible()[1] || pages[0];
    flat = !flat;
    store.set('zine-flat', flat);
    if (!flat) spread = clamp(spread, 0, LEAVES);
    layout();
    if (flat) keep.scrollIntoView({ block: 'nearest' });
    if (reduce()) return;
    pages.forEach((p, i) => {
      const a = before[i], b = p.getBoundingClientRect();
      if (!a.width || !b.width) return;
      const end = p.style.transform || 'none';
      const from = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
      p.animate([{ transform: from, transformOrigin: '0 0' }, { transform: flat ? 'none' : end, transformOrigin: flat ? '0 0' : '0 50%' }],
        { duration: 560 + i * 40, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    });
  }
  flatBtn.addEventListener('click', toggleFlat);

  wide.addEventListener('change', layout);
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => booklet && measure(), 120); });
  window.addEventListener('zine:remeasure', () => booklet && measure());
  fontsReady.then(() => booklet && measure());
  window.addEventListener('load', () => booklet && measure());

  // open at the page a link points to
  const hashTarget = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  const hp = hashTarget?.closest<HTMLElement>('.zpage');
  if (hp) spread = clamp(spreadOf(hp), 0, LEAVES);
  layout();
}
