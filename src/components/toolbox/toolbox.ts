// Skill map in the browser: live contours over the terrain, legs from a tool to
// everything that used it (and back), a pinned card, region filters, keyboard
// travel between controls, and the lamp's night map with a headlamp.
import { LiveContours, makeNoise, fbm, reduceMotion } from '../shells/map-shell.terrain';

interface Use { kind: 'project' | 'job'; id: string; title: string; href: string; why?: string }
interface ToolD { id: string; name: string; cat: string; x: number; y: number; hex?: string; uses: Use[] }
interface SpotD { id: string; kind: 'project' | 'job'; title: string; href: string; x: number; y: number; tools: string[] }
interface Data { w: number; h: number; regions: Record<string, { name: string; terrain: string; cx: number; cy: number; rx: number; ry: number }>; tools: ToolD[]; spots: SpotD[] }

const root = document.querySelector<HTMLElement>('[data-toolbox]');
const dataEl = document.getElementById('tb-data');
if (root && dataEl) init(root, JSON.parse(dataEl.textContent || '{}') as Data);

function init(root: HTMLElement, D: Data) {
  const frame = root.querySelector<HTMLElement>('[data-frame]')!;
  const legs = root.querySelector<SVGGElement>('[data-legs]')!;
  const card = root.querySelector<HTMLElement>('[data-card]')!;
  const NS = 'http://www.w3.org/2000/svg';
  const tools = new Map(D.tools.map((t) => [t.id, t]));
  const spots = new Map(D.spots.map((s) => [s.id, s]));
  const toolEl = new Map([...frame.querySelectorAll<SVGAElement>('[data-tool]')].map((a) => [a.dataset.tool!, a]));
  const spotEl = new Map([...frame.querySelectorAll<SVGAElement>('[data-spot]')].map((a) => [a.dataset.spot!, a]));
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- terrain: a hill under infrastructure, a hollow under the lake ---------- */
  const n = makeNoise(23);
  const R = D.regions;
  const g = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
  const live = new LiveContours({
    frame,
    canvas: frame.querySelector<HTMLCanvasElement>('.tb-lines')!,
    floor: -0.35,
    step: 9,
    stepZ: 0.12,
    ignore: '.tl, .sp, .tb-card, button',
    resetBtn: frame.querySelector<HTMLButtonElement>('.tb-reset'),
    heightAt: (px, py, W) => {
      const k = D.w / W, x = px * k, y = py * k;
      return (fbm(n, x / 230, y / 230) - 0.5) * 0.9
        + 1.5 * g(x, y, R.infra.cx, R.infra.cy - 40, R.infra.rx * 0.9, R.infra.ry * 0.7)
        + 0.5 * g(x, y, R.ml.cx - 60, R.ml.cy + 20, 160, 110)
        + 0.35 * g(x, y, R.web.cx + 80, R.web.cy, 140, 90)
        - 1.2 * g(x, y, R.lang.cx, R.lang.cy, R.lang.rx, R.lang.ry);
    },
    onPointer: (x, y, inside) => {
      if (inside) { frame.style.setProperty('--hx', x + 'px'); frame.style.setProperty('--hy', y + 'px'); }
    },
  });
  const retheme = () => { live.readColor(); live.draw(); };
  addEventListener('themechange', () => requestAnimationFrame(retheme));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);

  /* ---------- legs and highlight ---------- */
  let pinned: { kind: 'tool' | 'spot'; id: string } | null = null;
  let hovering: { kind: 'tool' | 'spot'; id: string } | null = null;

  function related(sel: { kind: 'tool' | 'spot'; id: string }) {
    if (sel.kind === 'tool') {
      const t = tools.get(sel.id)!;
      return { from: [t.x, t.y], to: t.uses.map((u) => spots.get(u.id)!).filter(Boolean).map((s) => ({ kind: 'spot' as const, id: s.id, x: s.x, y: s.y })) };
    }
    const s = spots.get(sel.id)!;
    return { from: [s.x, s.y], to: s.tools.map((id) => tools.get(id)!).map((t) => ({ kind: 'tool' as const, id: t.id, x: t.x, y: t.y })) };
  }

  function show(sel: { kind: 'tool' | 'spot'; id: string } | null) {
    legs.textContent = '';
    frame.querySelectorAll('.rel, .on').forEach((e) => e.classList.remove('rel', 'on'));
    frame.classList.toggle('active', !!sel);
    if (!sel) return;
    const r = related(sel);
    // the headlamp follows whatever you're looking at
    const k = frame.clientWidth / D.w;
    frame.style.setProperty('--hx', r.from[0] * k + 'px'); frame.style.setProperty('--hy', r.from[1] * k + 'px');
    (sel.kind === 'tool' ? toolEl : spotEl).get(sel.id)?.classList.add('on');
    r.to.forEach((o, k) => {
      (o.kind === 'tool' ? toolEl : spotEl).get(o.id)?.classList.add('rel');
      const [x1, y1] = r.from, d = Math.hypot(o.x - x1, o.y - y1);
      if (d < 40) return;
      const ux = (o.x - x1) / d, uy = (o.y - y1) / d;
      const a = 21, b = o.kind === 'tool' ? 21 : 16;
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', String(x1 + ux * a)); l.setAttribute('y1', String(y1 + uy * a));
      l.setAttribute('x2', String(o.x - ux * b)); l.setAttribute('y2', String(o.y - uy * b));
      l.setAttribute('pathLength', '1');
      l.style.setProperty('--k', String(k));
      legs.appendChild(l);
    });
  }
  const refresh = () => show(hovering ?? pinned);

  /* ---------- the pinned card ---------- */
  const flag = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1h12v12H1z" fill="#fff" stroke="currentColor"/><path d="M1 1l12 12V1z" fill="#ef7d1a"/></svg>';
  function badge(id: string, size = 26) {
    const row = document.querySelector(`[data-tool-row="${id}"] svg.badge`);
    if (!row) return '';
    const c = row.cloneNode(true) as SVGElement;
    c.setAttribute('width', String(size)); c.setAttribute('height', String(size));
    return c.outerHTML;
  }
  function openCard(sel: { kind: 'tool' | 'spot'; id: string }, focusCard = false) {
    pinned = sel;
    frame.classList.add('pinned');
    let html = '<button type="button" class="cd-x" aria-label="Close">×</button>';
    if (sel.kind === 'tool') {
      const t = tools.get(sel.id)!;
      const reg = D.regions[t.cat];
      html += `<div class="cd-h">${badge(t.id, 34)}<div><h2>${esc(t.name)}</h2><p class="cd-k">${esc(reg.name)}, ${esc(reg.terrain)}</p></div></div>`;
      html += t.uses.length
        ? `<ul>${t.uses.map((u) => `<li>${flag}<span><a href="${u.href}">${esc(u.title.replace(/ under .*/, ''))}</a>${u.why ? ` <span class="why">(${esc(u.why)})</span>` : ''}</span></li>`).join('')}</ul>`
        : '<p class="cd-none">Not attached to a project on this site yet.</p>';
    } else {
      const s = spots.get(sel.id)!;
      html += `<div class="cd-h"><div><h2>${esc(s.title)}</h2><p class="cd-k">${s.kind === 'job' ? 'Job' : 'Project'}, built with ${s.tools.length} tools</p></div></div>`;
      html += `<p class="chips">${s.tools.map((id) => `<button type="button" data-pin="${id}">${badge(id, 20)}${esc(tools.get(id)!.name)}</button>`).join('')}</p>`;
      html += `<p style="margin-top:12px"><a href="${s.href}">${s.href.startsWith('/work/') ? 'Open the project' : 'Find it in the notebook'}</a></p>`;
    }
    card.innerHTML = html;
    card.hidden = false;
    card.querySelector('.cd-x')!.addEventListener('click', () => closeCard(true));
    card.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach((b) => b.addEventListener('click', () => { openCard({ kind: 'tool', id: b.dataset.pin! }, true); }));
    if (focusCard) card.querySelector<HTMLElement>('a, button[data-pin]')?.focus({ preventScroll: true });
    refresh();
  }
  function closeCard(returnFocus = false) {
    const was = pinned;
    pinned = null;
    card.hidden = true;
    frame.classList.remove('pinned');
    refresh();
    if (returnFocus && was) ((was.kind === 'tool' ? toolEl : spotEl).get(was.id) as unknown as HTMLElement)?.focus();
  }

  /* ---------- wiring ---------- */
  const all: { kind: 'tool' | 'spot'; id: string; el: SVGAElement; x: number; y: number }[] = [
    ...[...toolEl].map(([id, el]) => ({ kind: 'tool' as const, id, el, x: tools.get(id)!.x, y: tools.get(id)!.y })),
    ...[...spotEl].map(([id, el]) => ({ kind: 'spot' as const, id, el, x: spots.get(id)!.x, y: spots.get(id)!.y })),
  ];
  for (const it of all) {
    const sel = { kind: it.kind, id: it.id };
    it.el.addEventListener('pointerenter', () => { hovering = sel; refresh(); });
    it.el.addEventListener('pointerleave', () => { hovering = null; refresh(); });
    it.el.addEventListener('focus', () => { hovering = sel; refresh(); });
    it.el.addEventListener('blur', () => { hovering = null; refresh(); });
    it.el.addEventListener('click', (e) => {
      e.preventDefault();
      if (pinned && pinned.kind === it.kind && pinned.id === it.id) closeCard();
      else openCard(sel);
    });
    it.el.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(sel, true); return; }
      if (!dir) return;
      e.preventDefault();
      // nearest control in that direction, favoring straight lines
      let best: (typeof all)[number] | null = null, bestS = Infinity;
      for (const o of all) {
        if (o === it || (o.el as unknown as HTMLElement).closest('.off')) continue;
        const dx = o.x - it.x, dy = o.y - it.y;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 4) continue;
        const across = Math.abs(dx * dir[1] - dy * dir[0]);
        const s = along + across * 2.2;
        if (s < bestS) { bestS = s; best = o; }
      }
      (best?.el as unknown as HTMLElement | undefined)?.focus();
    });
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned) closeCard(true); });
  frame.addEventListener('pointerdown', (e) => {
    if (pinned && !(e.target as Element).closest('.tl, .sp, .tb-card')) closeCard();
  });

  /* ---------- region filters ---------- */
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  chips.forEach((c) => c.addEventListener('click', () => {
    const f = c.dataset.filter!;
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    frame.classList.toggle('filtered', f !== 'all');
    toolEl.forEach((el, id) => el.classList.toggle('off', f !== 'all' && tools.get(id)!.cat !== f));
    spotEl.forEach((el, id) => el.classList.toggle('off', f !== 'all' && !spots.get(id)!.tools.some((t) => tools.get(t)!.cat === f)));
    frame.querySelectorAll<SVGElement>('[data-region]').forEach((r) => r.classList.toggle('off', f !== 'all' && r.dataset.region !== f));
    // keep the list in step
    root.querySelectorAll<HTMLElement>('.tb-cat').forEach((s) => s.classList.toggle('dim', f !== 'all' && s.dataset.cat !== f));
    toolEl.forEach((el) => el.setAttribute('tabindex', el.classList.contains('off') ? '-1' : '0'));
    spotEl.forEach((el) => el.setAttribute('tabindex', el.classList.contains('off') ? '-1' : '0'));
  }));

  // A short hello on first view: one tool lights its legs, then lets go.
  if (!reduceMotion() && !location.hash) {
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      setTimeout(() => { if (!hovering && !pinned) { show({ kind: 'tool', id: 'python' }); setTimeout(() => { if (!hovering && !pinned) show(null); }, 1600); } }, 1300);
    }, { threshold: 0.5 });
    io.observe(frame);
  }
}
