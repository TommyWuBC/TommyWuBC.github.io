/* Desk chrome shared by both pages: lamp (theme), copy email, toast, ⌘K index card.
   Adapted from round-1 entry C's command menu, restyled as an index card. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const data = JSON.parse(($('#site-data') || { textContent: '{}' }).textContent);
  $$('[data-mod]').forEach((k) => (k.textContent = isMac ? '⌘' : 'Ctrl'));

  /* toast: a sticky note that slaps onto the desk */
  const toastEl = $('.toast');
  let toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }
  window.toast = toast;

  /* lamp */
  const current = () => document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const lampBtn = $('.lamp');
  const label = () => lampBtn && lampBtn.setAttribute('aria-label', current() === 'dark' ? 'Turn the lamp on (light theme)' : 'Turn the lamp off (dark theme)');
  function setTheme(next, origin) {
    const apply = () => { document.documentElement.dataset.theme = next; store.set('theme', next); label(); window.dispatchEvent(new Event('themechange')); };
    if (!document.startViewTransition || reduce()) return apply();
    const r = (origin || lampBtn || document.body).getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }
  const toggleTheme = (o) => setTheme(current() === 'dark' ? 'light' : 'dark', o);
  if (lampBtn) { label(); lampBtn.addEventListener('click', () => toggleTheme(lampBtn)); }

  /* copy email */
  async function copyEmail() {
    try { await navigator.clipboard.writeText(data.email); }
    catch {
      const t = document.createElement('textarea'); t.value = data.email; document.body.append(t);
      t.select(); try { document.execCommand('copy'); } catch {} t.remove();
    }
    toast('Email copied: ' + data.email);
  }
  $$('[data-copy]').forEach((b) => b.addEventListener('click', copyEmail));

  /* ⌘K */
  const dlg = $('#cmdk');
  if (!dlg) return;
  const input = $('input', dlg), list = $('.cmdk-list', dlg), hl = $('.cmdk-hl', dlg);
  const P = (d) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const icons = {
    go: P('<path d="M2.5 8.3c3.5-.5 7-.3 10.5-.2M9.5 4.6l3.7 3.6-3.8 3.4"/>'),
    page: P('<path d="M4 2.5h6l2.5 2.5v8.5H4z"/><path d="M6 7h4.5M6 9.5h4"/>'),
    ext: P('<path d="M6 3.5H3.5v9h9V10"/><path d="M9 3h4v4M13 3 7.5 8.5"/>'),
    copy: P('<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 3.5v-1h-8v8h1"/>'),
    theme: P('<path d="M5 2.5h6l2 5H3z"/><path d="M8 7.5v5M5.5 13.5h5"/>'),
    grid: P('<rect x="2.5" y="2.5" width="11" height="11"/><path d="M6.2 2.5v11M9.8 2.5v11M2.5 6.2h11M2.5 9.8h11"/>'),
    file: P('<path d="M4 2.5h5l3 3v8H4z"/><path d="M6 9h4M6 11h3"/>'),
  };
  const actions = {
    copy: copyEmail,
    theme: () => toggleTheme(lampBtn),
    fan: () => window.pile && window.pile.toggle(),
    shuffle: () => window.lava && window.lava.newLayout(true),
    move: () => window.lava && window.lava.moveGaps(true),
  };
  const items = (data.commands || []).filter((c) => !c.when || document.querySelector(c.when));
  let filtered = items, sel = 0;
  const score = (q, s) => {
    if (!q) return { s: 1, idx: [] };
    const t = s.toLowerCase(); q = q.toLowerCase();
    const at = t.indexOf(q);
    if (at > -1) return { s: 100 - at - (at > 0 && t[at - 1] !== ' ' ? 20 : 0), idx: [...Array(q.length)].map((_, i) => at + i) };
    let j = 0; const idx = [];
    for (let i = 0; i < t.length && j < q.length; i++) if (t[i] === q[j]) { idx.push(i); j++; }
    if (j < q.length) return null;
    const span = idx[idx.length - 1] - idx[0] + 1;
    return span <= q.length * 2 + 2 ? { s: 30 - span, idx } : null;
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mark = (s, idx) => [...s].map((ch, i) => (idx.includes(i) ? `<mark>${esc(ch)}</mark>` : esc(ch))).join('');
  function draw() {
    const q = input.value.trim();
    const scored = items.map((c) => {
      const r = score(q, c.label);
      if (r) return { c, r };
      const kw = (c.keywords || '').toLowerCase();
      return q && kw.split(' ').some((w) => w.startsWith(q.toLowerCase())) ? { c, r: { s: 5, idx: [] } } : null;
    }).filter(Boolean);
    if (q) scored.sort((a, b) => b.r.s - a.r.s);
    filtered = scored.map((x) => x.c);
    sel = Math.min(sel, Math.max(0, filtered.length - 1));
    let html = '', group = null;
    scored.forEach(({ c, r }, i) => {
      if (!q && c.group !== group) { group = c.group; html += `<div class="cmdk-group" role="presentation">${esc(group)}</div>`; }
      html += `<div class="cmdk-item" role="option" id="cmdk-${i}" data-i="${i}" aria-selected="${i === sel}">${icons[c.icon] || icons.go}<span>${mark(c.label, r.idx)}</span>${c.hint ? `<span class="hint">${esc(c.hint)}</span>` : ''}</div>`;
    });
    if (!filtered.length) html = `<div class="cmdk-empty">Nothing matches “${esc(q)}”. Try “email”, “résumé” or a project name.</div>`;
    list.innerHTML = html; list.prepend(hl);
    moveHl(true);
  }
  function moveHl(instant) {
    const el = $(`[data-i="${sel}"]`, list);
    $$('.cmdk-item', list).forEach((n) => n.setAttribute('aria-selected', String(n === el)));
    if (!el) { hl.style.opacity = 0; input.removeAttribute('aria-activedescendant'); return; }
    input.setAttribute('aria-activedescendant', el.id);
    hl.style.opacity = 1;
    if (instant) hl.style.transition = 'none';
    hl.style.transform = `translateY(${el.offsetTop}px)`;
    if (instant) { hl.getBoundingClientRect(); hl.style.transition = ''; }
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < list.scrollTop + 8) list.scrollTop = top - 36;
    else if (bottom > list.scrollTop + list.clientHeight - 8) list.scrollTop = bottom - list.clientHeight + 8;
  }
  function run(c) {
    if (!c) return;
    close();
    if (c.action) return setTimeout(() => actions[c.action] && actions[c.action](), 80);
    if (c.href.startsWith('#')) {
      const id = c.href.slice(1);
      if (window.notebook) return setTimeout(() => window.notebook.goToId(id, true), 80);
      const t = document.getElementById(id);
      if (t) { t.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }); history.replaceState(null, '', c.href); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); return; }
    }
    if (c.external) window.open(c.href, '_blank', 'noopener'); else location.href = c.href;
  }
  let lastFocus;
  function open() {
    if (dlg.open) { dlg.classList.remove('bump'); void dlg.offsetWidth; dlg.classList.add('bump'); return; }
    lastFocus = document.activeElement;
    input.value = ''; sel = 0; draw();
    dlg.showModal(); input.focus();
    requestAnimationFrame(() => moveHl(true));
  }
  function close() { if (dlg.open) dlg.close(); }
  window.cmdk = { open, close };
  dlg.addEventListener('close', () => lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    const n = Math.max(1, filtered.length);
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); sel = (sel + 1) % n; moveHl(); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); sel = (sel - 1 + n) % n; moveHl(); }
    else if (e.key === 'Home') { e.preventDefault(); sel = 0; moveHl(); }
    else if (e.key === 'End') { e.preventDefault(); sel = filtered.length - 1; moveHl(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[sel]); }
  });
  list.addEventListener('pointermove', (e) => {
    const it = e.target.closest('.cmdk-item'); if (!it) return;
    const i = +it.dataset.i; if (i !== sel) { sel = i; moveHl(); }
  });
  list.addEventListener('click', (e) => { const it = e.target.closest('.cmdk-item'); if (it) run(filtered[+it.dataset.i]); });
  $$('[data-cmdk-open]').forEach((b) => b.addEventListener('click', open));
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? close() : open(); }
    else if (e.key === '/' && !dlg.open && !e.target.closest('input, textarea, [contenteditable]')) { e.preventDefault(); open(); }
  });
})();
