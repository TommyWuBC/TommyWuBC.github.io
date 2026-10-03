export {};
// Scroll shell behaviour. Ported from round-2 "The Route" (s2/scroll.js).
//   1. Top roller: the paper winds onto it as you read; it names the section you're in.
//   2. Seals: each section head gets its seal pressed when you reach it.
//   3. Hand scrolls: vertical scrolling becomes sideways travel between two rollers.
//   4. End seal and "roll it back up".
// Everything scroll-linked runs in one rAF per frame. Without JS the page is static.

const shell = document.querySelector<HTMLElement>('[data-scroll-shell]');
if (shell) init(shell);

function init(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => r.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => [...r.querySelectorAll<T>(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => RM.matches;
  const STILL = /[?&]still\b/.test(location.search);
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const tasks: (() => void)[] = [];
  let queued = false;
  const tick = () => { queued = false; tasks.forEach((f) => f()); };
  const kick = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);

  /* ---------- 1. top roller ---------- */
  const roll = $('[data-sc-roll]');
  const rod = roll && $('.sc-rod', roll);
  const where = $('[data-sc-where]');
  const paper = $('.sc-paper');
  const small = matchMedia('(max-width: 600px)');
  if (roll && rod && paper) {
    tasks.push(() => {
      const r = paper.getBoundingClientRect();
      const read = clamp((-r.top + innerHeight * 0.1) / Math.max(1, r.height - innerHeight * 0.8), 0, 1);
      const base = small.matches ? 30 : 34;
      roll.style.setProperty('--sc-wound', (base + read * 16).toFixed(1) + 'px');
      rod.style.setProperty('--spin', (-scrollY * 0.35).toFixed(1) + 'px');
    });
  }

  /* ---------- 2. seals on section heads, and "where am I" on the roller ---------- */
  const heads = $$<HTMLHeadingElement>('.sc-body h2');
  if (STILL || !('IntersectionObserver' in window)) heads.forEach((h) => h.classList.add('sc-stamped'));
  else {
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('sc-stamped'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -22% 0px' });
    heads.forEach((h) => io.observe(h));
  }
  if (where && heads.length) {
    let last = '';
    tasks.push(() => {
      const line = innerHeight * 0.35;
      let cur: HTMLHeadingElement | null = null;
      for (const h of heads) { if (h.getBoundingClientRect().top < line) cur = h; else break; }
      const t = cur ? (cur.textContent || '').trim() : '';
      if (t !== last) { last = t; where.textContent = t; }
    });
  }

  /* ---------- 3. hand scrolls ---------- */
  $$('[data-sc-hs]').forEach((hs) => {
    const stage = $('.sc-hs-stage', hs)!, win = $('.sc-hs-window', hs)!, strip = $('.sc-hs-strip', hs)!;
    const rl = $('.sc-hs-roller.l', hs)!, rr = $('.sc-hs-roller.r', hs)!;
    const wide = matchMedia('(min-width: 760px) and (min-height: 620px)');
    let pinned = false, dist = 0;
    const stickTop = () => parseFloat(getComputedStyle(stage).top) || 0;
    function layout() {
      pinned = wide.matches && !reduce() && !STILL;
      hs.classList.toggle('pinned', pinned);
      hs.style.height = '';
      if (!pinned) { strip.style.removeProperty('--tx'); update(); return; }
      win.scrollLeft = 0;
      dist = Math.max(0, strip.scrollWidth - win.clientWidth);
      hs.style.height = stage.offsetHeight + dist + 'px';
      update();
    }
    function update() {
      let p: number;
      if (pinned) {
        const r = hs.getBoundingClientRect();
        p = dist ? clamp((stickTop() - r.top) / dist, 0, 1) : 0;
        strip.style.setProperty('--tx', (-p * dist).toFixed(1));
      } else {
        const m = win.scrollWidth - win.clientWidth;
        p = m > 0 ? clamp(win.scrollLeft / m, 0, 1) : 0;
      }
      hs.style.setProperty('--hp', p.toFixed(4));
      const travel = pinned ? p * dist : win.scrollLeft;
      rl.style.setProperty('--wt', (14 + p * 18).toFixed(1) + 'px');
      rr.style.setProperty('--wt', (32 - p * 18).toFixed(1) + 'px');
      rl.style.setProperty('--spin', (-travel * 0.3).toFixed(1) + 'px');
      rr.style.setProperty('--spin', (-travel * 0.3).toFixed(1) + 'px');
    }
    win.addEventListener('scroll', update, { passive: true });
    // keyboard: when focus lands in a panel, scroll the page so that panel is in the window
    hs.addEventListener('focusin', (e) => {
      if (!pinned) return;
      const panel = (e.target as HTMLElement).closest<HTMLElement>('.sc-hs-panel');
      if (!panel) return;
      win.scrollLeft = 0;
      const want = clamp(panel.offsetLeft - (win.clientWidth - panel.offsetWidth) / 2, 0, dist);
      const absTop = hs.getBoundingClientRect().top + scrollY;
      scrollTo({ top: absTop - stickTop() + want, behavior: 'instant' as ScrollBehavior });
    });
    // arrow keys on the focused window move one panel at a time
    win.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const panels = $$<HTMLElement>('.sc-hs-panel', hs);
      if (!panels.length) return;
      e.preventDefault();
      const step = (panels[0].offsetWidth || 340) * (e.key === 'ArrowRight' ? 1 : -1);
      if (pinned) scrollBy({ top: step, behavior: reduce() ? 'instant' as ScrollBehavior : 'smooth' });
      else win.scrollBy({ left: step, behavior: reduce() ? 'instant' as ScrollBehavior : 'smooth' });
    });
    tasks.push(() => pinned && update());
    layout();
    wide.addEventListener('change', layout);
    RM.addEventListener('change', layout);
    let w0 = innerWidth, h0 = innerHeight;
    addEventListener('resize', () => {
      if (Math.abs(innerWidth - w0) > 2 || Math.abs(innerHeight - h0) > 60) { w0 = innerWidth; h0 = innerHeight; layout(); }
    });
    document.fonts?.ready.then(layout);
    new ResizeObserver(() => pinned && layout()).observe(strip);
  });

  /* ---------- 4. end seal, roll back up ---------- */
  const seal = $('[data-sc-seal]');
  if (seal) {
    if (STILL || !('IntersectionObserver' in window)) seal.classList.add('sc-stamped');
    else {
      const so = new IntersectionObserver((ents) => ents.forEach((en) => {
        if (en.isIntersecting) { seal.classList.add('sc-stamped'); so.disconnect(); }
      }), { threshold: 0.6 });
      so.observe(seal);
    }
  }
  $$('[data-sc-rollup]').forEach((b) => b.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduce() ? 'instant' as ScrollBehavior : 'smooth' });
    setTimeout(() => $<HTMLElement>('.sc-back')?.focus({ preventScroll: true }), reduce() ? 0 : 900);
  }));

  kick();
}
