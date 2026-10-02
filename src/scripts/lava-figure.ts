// Browser controller for Fig. 1. The server already rendered a static SVG of
// the training layout; this takes over and animates new layouts.
import { TRAINING, randomLayout, render, describe, type Layout } from '../lib/lava';

function init(fig: HTMLElement) {
  const svg = fig.querySelector<SVGSVGElement>('[data-lava-svg]')!;
  const desc = fig.querySelector('[data-lava-desc]')!;
  const status = fig.querySelector('[data-lava-status]')!;
  const segs = [...fig.querySelectorAll<HTMLButtonElement>('[data-variant]')];
  const shuffle = fig.querySelector<HTMLButtonElement>('[data-lava-shuffle]')!;
  const cols = [...fig.querySelectorAll<HTMLElement>('[data-col]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current: Layout = TRAINING;
  let tried = 0;
  let survived = 0;

  function show(L: Layout, counted = false) {
    current = L;
    const res = render(L, !reduce);
    // Keep <title> and <desc>, replace the drawing.
    [...svg.childNodes].forEach((n) => {
      if (n.nodeName !== 'title' && n.nodeName !== 'desc') svg.removeChild(n);
    });
    svg.insertAdjacentHTML('beforeend', res.svg);
    const t = describe(L, res);
    desc.textContent = t.desc;
    if (counted) {
      tried++;
      if (res.spec.fellAt <= 0) survived++;
    }
    status.replaceChildren();
    const line = document.createElement('span');
    line.textContent = t.status;
    status.append(line);
    if (tried) {
      const tally = document.createElement('span');
      tally.className = 'status__tally';
      tally.textContent = `New layouts so far: ${tried}. Dotted survived ${survived}, solid ${tried}.`;
      status.append(tally);
    }
    const v = L.variant || 1;
    segs.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.variant) === L.variant)));
    cols.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.col) === v));
    svg.classList.remove('is-drawn');
    if (!reduce) requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('is-drawn')));
  }

  segs.forEach((b) =>
    b.addEventListener('click', () => {
      const v = Number(b.dataset.variant);
      show(v === 0 ? TRAINING : randomLayout(v), v !== 0);
    }),
  );
  shuffle.addEventListener('click', () => show(randomLayout(current.variant || 1), true));

  // Draw the first layout when the plate scrolls into view.
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          show(TRAINING);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(svg);
  } else show(TRAINING);
}

document.querySelectorAll<HTMLElement>('[data-lava]').forEach(init);
