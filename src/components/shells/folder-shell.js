export {};
/* Folder shell: mark the sheet you're reading, on the cover's contents list and
   on the divider tabs. On phones the tabs are a strip across the top; keep the
   current tab in view inside it. */
const folder = document.querySelector('[data-folder]');
if (folder) {
  const sheets = [...folder.querySelectorAll('[data-sheet]')];
  const links = [...folder.querySelectorAll('[data-fd-link]')];
  const strip = folder.querySelector('.fd-tabs ol');
  let current = '';
  let queued = false;

  const mark = () => {
    queued = false;
    let id = sheets[0] ? sheets[0].id : '';
    const line = innerHeight * 0.35;
    for (const s of sheets) if (s.getBoundingClientRect().top < line) id = s.id;
    if (id === current) return;
    current = id;
    for (const a of links) a.setAttribute('aria-current', String(a.dataset.fdLink === id));
    // phone strip: scroll sideways only, never move the page
    if (strip && strip.scrollWidth > strip.clientWidth + 2) {
      const tab = strip.querySelector(`[data-fd-link="${CSS.escape(id)}"]`);
      if (tab) {
        const li = tab.parentElement;
        const left = li.offsetLeft - 12, right = li.offsetLeft + li.offsetWidth + 12;
        if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
          strip.scrollTo({ left: Math.max(0, left), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      }
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(mark); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  mark();

  // the opening is decorative: once it's done, drop the 3D context
  const flap = folder.querySelector('.fd-flap-l');
  if (flap) flap.addEventListener('animationend', () => document.documentElement.classList.add('fd-opened'), { once: true });
}
