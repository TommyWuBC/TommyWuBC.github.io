/* The photo pile on the inside cover: drag a photo, tap it to read the back,
   spread them out or pile them back up. Keyboard: Enter flips, arrows move (Shift for bigger steps). */
(() => {
  const pile = document.getElementById('pile');
  if (!pile) return;
  const items = [...pile.querySelectorAll('.photo')];
  const fanBtn = pile.querySelector('[data-pile="fan"]');
  let topZ = items.length, fanned = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const st = new Map(items.map((el, i) => {
    const r0 = parseFloat(el.style.getPropertyValue('--r')) || 0;
    el.style.setProperty('--z', i + 1);
    return [el, { dx: 0, dy: 0, r: r0, r0 }];
  }));
  const apply = (el) => {
    const s = st.get(el);
    el.style.setProperty('--dx', s.dx.toFixed(1) + 'px');
    el.style.setProperty('--dy', s.dy.toFixed(1) + 'px');
    el.style.setProperty('--r', s.r.toFixed(2) + 'deg');
  };
  const raise = (el) => el.style.setProperty('--z', ++topZ);
  const scale = () => pile.getBoundingClientRect().width / pile.offsetWidth || 1;
  // keep a photo mostly on the board: it may hang a little off the pile area, never off the page
  function bounds(el) {
    const W = pile.offsetWidth, H = pile.offsetHeight, w = el.offsetWidth, h = el.offsetHeight;
    return { x0: -el.offsetLeft - 8, x1: W - el.offsetLeft - w + 8, y0: -el.offsetTop - 24, y1: H - el.offsetTop - h + 16 };
  }

  // deckled edge on the landscape print
  const deck = pile.querySelector('.print-l .ph-front');
  if (deck) {
    const pts = [], n = 34, j = () => rnd(0, 2.4).toFixed(1);
    for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${j()}px`);
    for (let i = 0; i <= n * 0.75; i++) pts.push(`calc(100% - ${j()}px) ${(i / (n * 0.75) * 100).toFixed(2)}%`);
    for (let i = n; i >= 0; i--) pts.push(`${(i / n * 100).toFixed(2)}% calc(100% - ${j()}px)`);
    for (let i = Math.floor(n * 0.75); i >= 0; i--) pts.push(`${j()}px ${(i / (n * 0.75) * 100).toFixed(2)}%`);
    deck.style.clipPath = `polygon(${pts.join(',')})`;
    deck.closest('.ph').classList.add('deckled');
  }

  items.forEach((el) => {
    const btn = el.querySelector('.ph');
    let d = null, suppress = false;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      btn.setPointerCapture(e.pointerId);
      const s = st.get(el);
      d = { x: e.clientX, y: e.clientY, dx: s.dx, dy: s.dy, moved: false, k: scale(), b: bounds(el), lx: e.clientX, vx: 0 };
      raise(el); el.classList.add('lifted');
    });
    btn.addEventListener('pointermove', (e) => {
      if (!d) return;
      const mx = (e.clientX - d.x) / d.k, my = (e.clientY - d.y) / d.k;
      if (!d.moved && Math.hypot(mx, my) < 4) return;
      if (!d.moved) { d.moved = true; el.classList.add('dragging'); }
      const s = st.get(el);
      s.dx = clamp(d.dx + mx, d.b.x0, d.b.x1);
      s.dy = clamp(d.dy + my, d.b.y0, d.b.y1);
      d.vx = 0.75 * d.vx + 0.25 * (e.clientX - d.lx); d.lx = e.clientX;
      s.r = s.r0 + clamp(d.vx * 0.9, -9, 9); // swings with the drag
      apply(el);
    });
    const end = () => {
      if (!d) return;
      const s = st.get(el);
      if (d.moved) {
        suppress = true;
        s.r0 = clamp(s.r0 + rnd(-4, 4), -12, 12); s.r = s.r0;
        el.classList.remove('dragging');
        requestAnimationFrame(() => apply(el));
        if (fanned) setFan(false, true);
      }
      setTimeout(() => el.classList.remove('lifted'), d.moved ? 120 : 260);
      d = null;
    };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('click', () => {
      if (suppress) { suppress = false; return; }
      raise(el);
      el.classList.toggle('flipped');
      btn.setAttribute('aria-pressed', String(el.classList.contains('flipped')));
    });
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 40 : 12;
      const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!m) return;
      e.preventDefault(); e.stopPropagation();
      const s = st.get(el), b = bounds(el);
      s.dx = clamp(s.dx + m[0], b.x0, b.x1); s.dy = clamp(s.dy + m[1], b.y0, b.y1);
      raise(el); apply(el);
    });
  });

  // spread out: a loose fan across the board; pile up: back to the stack
  function setFan(on, quiet) {
    fanned = on;
    if (fanBtn) { fanBtn.textContent = on ? 'Pile them up again' : 'Spread them out'; fanBtn.setAttribute('aria-pressed', String(on)); }
    if (quiet) return;
    const W = pile.offsetWidth, H = pile.offsetHeight;
    const FAN = { desk: [0, 0.05, -8], lake: [0.36, 0, 4], lavender: [0.02, 0.5, 3], 'old-profile': [0.5, 0.53, -6] };
    items.forEach((el, i) => {
      const s = st.get(el);
      if (on) {
        const [fx, fy, fr] = FAN[el.dataset.k] || [i / 4, 0.2, 0];
        s.dx = fx * W - el.offsetLeft; s.dy = fy * H - el.offsetTop; s.r0 = s.r = fr;
        el.style.transitionDelay = i * 60 + 'ms';
      } else {
        s.dx = 0; s.dy = 0; s.r0 = s.r = parseFloat(el.dataset.r0); el.style.transitionDelay = (items.length - i) * 50 + 'ms';
      }
      el.style.setProperty('--z', i + 1);
      apply(el);
      setTimeout(() => (el.style.transitionDelay = ''), 600);
    });
    topZ = items.length;
  }
  items.forEach((el) => (el.dataset.r0 = st.get(el).r0));
  if (fanBtn) fanBtn.addEventListener('click', () => setFan(!fanned));
  window.pile = { toggle: () => { setFan(!fanned); if (window.notebook) window.notebook.go(0); } };
})();
