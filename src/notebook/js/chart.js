/* Finding 1 chart (from round-1 entry B), redrawn in pen on the card.
   Rendered at the card's real pixel width so the text never scales. Hover, tap, or focus
   and use the arrow keys: the whole layout family is read out on a sticky note. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  document.querySelectorAll('[data-chart]').forEach((box) => {
    const spec = JSON.parse(box.querySelector('script[type="application/json"]').textContent);
    const host = box.querySelector('.chart-svg');
    const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1)) + '%';
    let active = -1, parts = null;
    function render() {
      const W = Math.round(host.getBoundingClientRect().width) || 480;
      const wide = W >= 440;
      const H = wide ? 300 : 260;
      const m = { t: 18, r: wide ? 96 : 16, b: 54, l: 42 };
      const pw = W - m.l - m.r, ph = H - m.t - m.b, n = spec.categories.length;
      const xs = (i) => m.l + 26 + (i * (pw - 52)) / (n - 1);
      const ys = (v) => m.t + ph - (v / 100) * ph;
      const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.label + ' Use the arrow keys to read each family.', tabindex: 0 });
      const step = (pw - 52) / (n - 1);
      const bands = spec.categories.map((_, i) => el('rect', { x: xs(i) - step / 2, y: m.t - 6, width: step, height: ph + 12, rx: 4, class: 'c-band' }, svg));
      const grid = el('g', { class: 'c-grid' }, svg);
      [0, 25, 50, 75, 100].forEach((t) => {
        el('line', { x1: m.l, x2: W - m.r, y1: ys(t), y2: ys(t), class: t === 0 ? 'base' : '' }, grid);
        el('text', { x: m.l - 8, y: ys(t) + 4, 'text-anchor': 'end', class: 'c-axis' }, svg).textContent = t + '%';
      });
      spec.categories.forEach((c, i) => {
        el('text', { x: xs(i), y: H - m.b + 22, 'text-anchor': 'middle', class: 'c-cat' }, svg).textContent = c[0];
        el('text', { x: xs(i), y: H - m.b + 40, 'text-anchor': 'middle', class: 'c-axis' }, svg).textContent = c[1];
      });
      const guide = el('line', { x1: 0, x2: 0, y1: m.t - 4, y2: m.t + ph, class: 'c-guide' }, svg);
      const one = spec.series.find((s) => s.key === 'one');
      // a pen note on the drop
      const mx = (xs(0) + xs(1)) / 2, my = (ys(one.values[0]) + ys(one.values[1])) / 2;
      el('path', { d: `M${mx + 30} ${my - 4} q-10 2 -22 4`, class: 'c-arrow' }, svg);
      el('text', { x: mx + 34, y: my, class: 'c-note' }, svg).textContent = 'the map moved';
      const dots = {};
      spec.series.forEach((s) => {
        el('polyline', { class: 'c-line ' + s.key, points: s.values.map((v, i) => `${xs(i)},${ys(v)}`).join(' ') }, svg);
      });
      spec.series.forEach((s) => {
        dots[s.key] = s.values.map((v, i) => el('circle', { cx: xs(i), cy: ys(v), r: 5.5, class: 'c-dot ' + s.key }, svg));
        const lv = s.values[n - 1];
        const lbl = s.key === 'many' ? 'randomized' : 'single-env';
        if (wide) el('text', { x: xs(n - 1) + 14, y: ys(lv) + 6, class: 'c-lbl ' + s.key }, svg).textContent = lbl;
        else el('text', { x: xs(n - 1), y: ys(lv) + (s.key === 'many' ? 26 : -14), 'text-anchor': 'end', class: 'c-lbl ' + s.key }, svg).textContent = lbl;
      });
      const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true');
      host.replaceChildren(svg, tip);
      const live = box.querySelector('.sr-live') || Object.assign(document.createElement('p'), { className: 'sr-only sr-live' });
      live.setAttribute('aria-live', 'polite'); box.append(live);
      parts = { svg, bands, guide, dots, tip, live, xs, ys, m, W };
      const pick = (clientX) => {
        const r = svg.getBoundingClientRect(), x = clientX - r.left;
        let best = 0; for (let i = 1; i < n; i++) if (Math.abs(xs(i) - x) < Math.abs(xs(best) - x)) best = i;
        return best;
      };
      svg.addEventListener('pointermove', (e) => set(pick(e.clientX)));
      svg.addEventListener('pointerdown', (e) => set(pick(e.clientX)));
      svg.addEventListener('pointerleave', () => set(-1));
      svg.addEventListener('focus', () => set(active < 0 ? 0 : active));
      svg.addEventListener('blur', () => set(-1));
      svg.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); set(Math.min(n - 1, active + 1)); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); set(Math.max(0, active - 1)); }
        else if (e.key === 'Escape') set(-1);
      });
      if (active >= 0) set(active, true);
    }
    function set(i, force) {
      if (!parts || (i === active && !force)) return;
      active = i;
      const { bands, guide, dots, tip, live, xs, ys } = parts;
      bands.forEach((b, j) => b.classList.toggle('on', j === i));
      Object.values(dots).forEach((arr) => arr.forEach((d, j) => d.classList.toggle('on', j === i)));
      if (i < 0) { tip.classList.remove('on'); guide.classList.remove('on'); return; }
      const c = spec.categories[i];
      guide.setAttribute('x1', xs(i)); guide.setAttribute('x2', xs(i)); guide.classList.add('on');
      const top = Math.min(...spec.series.map((s) => ys(s.values[i])));
      const rows = spec.series.map((s) => `<span><em>${s.name}</em><b>${fmt(s.values[i])}</b></span>`).join('');
      tip.innerHTML = `<strong>${c[0]}, ${c[1]}</strong>${rows}<span><em>Layouts tested</em><b>${c[2].split(' ')[0]}</b></span>`;
      const x = Math.max(92, Math.min(parts.W - 92, xs(i)));
      tip.style.left = x + 'px'; tip.style.top = Math.max(top, 96) + 'px';
      tip.classList.add('on');
      live.textContent = `${c[0]}: ` + spec.series.map((s) => `${s.name} ${fmt(s.values[i])}`).join(', ') + '.';
    }
    render();
    let w0 = host.getBoundingClientRect().width;
    new ResizeObserver(() => { const w = host.getBoundingClientRect().width; if (Math.abs(w - w0) > 2) { w0 = w; render(); } }).observe(host);
  });
})();
