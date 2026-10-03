// Map + feed + day plan, one state. Sample data only.
import { EVENTS, CLASSES, START_PIN, DAY_START, DAY_END, rank, walkMin, span, conflicts, type Block } from './data';

const map = document.querySelector<HTMLElement>('[data-bz-map]');
const feed = document.querySelector<HTMLElement>('[data-bz-feed]');
const day = document.querySelector<HTMLElement>('[data-bz-day]');
if (map && feed && day) init(map, feed, day);

function init(map: HTMLElement, feed: HTMLElement, day: HTMLElement) {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = map.querySelector('svg')!;
  const you = map.querySelector<SVGGElement>('[data-bz-you]')!;
  const rings = map.querySelector<SVGGElement>('[data-bz-rings]')!;
  const list = feed.querySelector<HTMLElement>('[data-bz-list]')!;
  const drop = feed.querySelector<HTMLInputElement>('[data-bz-drop]')!;
  const items = new Map([...list.querySelectorAll<HTMLElement>('[data-ev]')].map((li) => [li.dataset.ev!, li]));
  const pins = new Map([...map.querySelectorAll<SVGGElement>('[data-pin]')].map((g) => [g.dataset.pin!, g]));
  const lane = day.querySelector<HTMLElement>('[data-lane="events"]')!;
  const classEls = [...day.querySelectorAll<HTMLElement>('.bz-class')];
  const clashLayer = day.querySelector<HTMLElement>('[data-bz-clash]')!;
  const confList = day.querySelector<HTMLElement>('[data-bz-conf]')!;
  const icsBtn = day.querySelector<HTMLButtonElement>('[data-bz-ics]')!;

  const pin = { ...START_PIN };
  const going = new Map<string, 'pending' | 'saved'>();
  const counts = new Map(EVENTS.map((e) => [e.id, e.going]));
  let ics = true;
  let order = rank(pin).map((e) => e.id);

  /* ---------- proximity ranking */
  function rerank() {
    const next = rank(pin).map((e) => e.id);
    EVENTS.forEach((e) => { items.get(e.id)!.querySelector('[data-walk]')!.textContent = String(walkMin(e, pin)); });
    if (next.join() === order.join()) return;
    order = next;
    const before = new Map([...items].map(([id, li]) => [id, li.getBoundingClientRect().top]));
    order.forEach((id, i) => {
      const li = items.get(id)!;
      list.appendChild(li);
      li.querySelector('[data-n]')!.textContent = String(i + 1);
      pins.get(id)!.querySelector('[data-pin-n]')!.textContent = String(i + 1);
    });
    if (reduce()) return;
    items.forEach((li, id) => {
      const dy = before.get(id)! - li.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    });
  }
  const place = () => {
    you.setAttribute('transform', `translate(${pin.x} ${pin.y})`);
    rings.setAttribute('transform', `translate(${pin.x} ${pin.y})`);
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); rerank(); }); };
  const clampPin = () => { pin.x = Math.max(12, Math.min(588, pin.x)); pin.y = Math.max(12, Math.min(408, pin.y)); };

  const toSvg = (e: PointerEvent) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  let dragId: number | null = null;
  you.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragId = e.pointerId; you.setPointerCapture(e.pointerId); you.classList.add('dragging');
    (you as unknown as HTMLElement).focus({ preventScroll: true });
  });
  you.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    const p = toSvg(e); if (!p) return;
    pin.x = p.x; pin.y = p.y; clampPin(); schedule();
  });
  const end = (e: PointerEvent) => { if (e.pointerId === dragId) { dragId = null; you.classList.remove('dragging'); } };
  you.addEventListener('pointerup', end);
  you.addEventListener('pointercancel', end);
  // a tap anywhere else on the map moves you there
  svg.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-bz-you]')) return;
    const p = toSvg(e as PointerEvent); if (!p) return;
    pin.x = p.x; pin.y = p.y; clampPin(); schedule();
  });
  you.addEventListener('keydown', (e) => {
    const s = e.shiftKey ? 40 : 12;
    const d = ({ ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] } as Record<string, number[]>)[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    pin.x += d[0]; pin.y += d[1]; clampPin(); schedule();
  });

  // hovering an event lights its pin, and the reverse
  const hot = (id: string | null) => {
    items.forEach((li, k) => li.classList.toggle('hot', k === id));
    pins.forEach((g, k) => g.classList.toggle('hot', k === id));
  };
  list.addEventListener('pointerover', (e) => hot((e.target as HTMLElement).closest<HTMLElement>('[data-ev]')?.dataset.ev ?? null));
  list.addEventListener('pointerleave', () => hot(null));
  list.addEventListener('focusin', (e) => hot((e.target as HTMLElement).closest<HTMLElement>('[data-ev]')?.dataset.ev ?? null));
  pins.forEach((g, id) => { g.addEventListener('pointerenter', () => hot(id)); g.addEventListener('pointerleave', () => hot(null)); });

  /* ---------- optimistic RSVP */
  function paintItem(id: string) {
    const li = items.get(id)!, btn = li.querySelector<HTMLButtonElement>('[data-rsvp]')!;
    const st = going.get(id);
    btn.setAttribute('aria-pressed', String(!!st));
    btn.textContent = st ? 'Going' : 'RSVP';
    btn.classList.toggle('pending', st === 'pending');
    li.querySelector('[data-count]')!.textContent = String(counts.get(id));
    pins.get(id)!.classList.toggle('going', !!st);
  }
  const status = (id: string, cls: string, text: string) => {
    const el = items.get(id)!.querySelector<HTMLElement>('[data-status]')!;
    el.className = `bz-status ${cls}`; el.textContent = text;
  };
  const timers = new Map<string, number>();
  feed.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-rsvp]');
    if (!btn) return;
    const id = btn.closest<HTMLElement>('[data-ev]')!.dataset.ev!;
    const wasGoing = going.has(id);
    // 1. change the screen now
    if (wasGoing) { going.delete(id); counts.set(id, counts.get(id)! - 1); }
    else { going.set(id, 'pending'); counts.set(id, counts.get(id)! + 1); }
    paintItem(id); paintDay();
    status(id, 'saving', 'saving…');
    const fail = drop.checked;
    if (fail) drop.checked = false;
    clearTimeout(timers.get(id));
    // 2. the server answers later
    timers.set(id, window.setTimeout(() => {
      if (fail) { // roll back to what the server has
        if (wasGoing) { going.set(id, 'saved'); counts.set(id, counts.get(id)! + 1); }
        else { going.delete(id); counts.set(id, counts.get(id)! - 1); }
        status(id, 'failed', 'Couldn’t save. Undone.');
      } else {
        if (going.has(id)) going.set(id, 'saved');
        status(id, 'saved', 'saved');
      }
      paintItem(id); paintDay();
      timers.set(id, window.setTimeout(() => status(id, '', ''), 2200));
    }, 650 + Math.random() * 450));
  });

  /* ---------- the day plan and its clashes */
  const pct = (m: number) => ((m - DAY_START) / (DAY_END - DAY_START)) * 100;
  icsBtn.addEventListener('click', () => {
    ics = !ics;
    icsBtn.setAttribute('aria-pressed', String(ics));
    icsBtn.textContent = ics ? 'Sample .ics imported' : 'Import the sample .ics';
    paintDay();
  });
  function paintDay() {
    classEls.forEach((el) => el.classList.toggle('out', !ics));
    const evBlocks: Block[] = EVENTS.filter((e) => going.has(e.id)).map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end }));
    const all = [...(ics ? CLASSES : []), ...evBlocks];
    const cs = conflicts(all);
    const clashing = new Set(cs.flatMap((c) => [c.a.id, c.b.id]));
    // events lane
    const seen = new Set<string>();
    evBlocks.forEach((b) => {
      seen.add(b.id);
      let el = lane.querySelector<HTMLElement>(`[data-b="${b.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = `bz-b bz-going${b.end - b.start < 75 ? ' short' : ''}`; el.dataset.b = b.id; el.title = `${b.title}, ${span(b.start, b.end)}`;
        el.style.top = pct(b.start) + '%'; el.style.height = pct(b.end) - pct(b.start) + '%';
        el.innerHTML = `<b></b><span>${span(b.start, b.end)}</span>`;
        el.querySelector('b')!.textContent = b.title;
        lane.appendChild(el);
      }
      el.classList.toggle('pending', going.get(b.id) === 'pending');
      el.classList.toggle('clash', clashing.has(b.id));
    });
    lane.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => { if (!seen.has(el.dataset.b!)) el.remove(); });
    // two events at once share the lane: split it
    lane.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => {
      const b = evBlocks.find((x) => x.id === el.dataset.b)!;
      const over = evBlocks.filter((x) => x.id !== b.id && x.start < b.end && b.start < x.end);
      const idx = over.filter((x) => x.start < b.start || (x.start === b.start && x.id < b.id)).length;
      el.style.left = over.length ? `${idx ? 50 : 0}%` : '0';
      el.style.right = over.length ? `${idx ? 0 : 50}%` : '0';
    });
    classEls.forEach((el, i) => el.classList.toggle('clash', ics && clashing.has(CLASSES[i].id)));
    clashLayer.innerHTML = cs.map((c) => `<i style="top:${pct(c.start)}%;height:${pct(c.end) - pct(c.start)}%"></i>`).join('');
    confList.innerHTML = cs.length
      ? cs.map((c) => `<li><b>${c.b.title}</b> overlaps <b>${c.a.title}</b>, ${span(c.start, c.end)}.</li>`).join('')
      : `<li class="bz-none">${evBlocks.length ? 'Everything you’re going to fits.' : 'Nothing clashes yet. RSVP to something on the feed.'}</li>`;
  }
  // start with one RSVP already saved, so the day shows how a clash reads
  going.set('pizza', 'saved'); counts.set('pizza', counts.get('pizza')! + 1); paintItem('pizza');
  paintDay();
}
