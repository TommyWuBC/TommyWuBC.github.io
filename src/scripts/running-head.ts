// Running head: the folio and section title change as you read, like a book's
// recto head. Sections opt in with data-head="Title" data-folio="2".
const sec = document.querySelector<HTMLElement>('[data-rh-section]');
const fol = document.querySelector<HTMLElement>('[data-rh-folio]');
const parts = [...document.querySelectorAll<HTMLElement>('[data-head]')];

if (sec && fol && parts.length && 'IntersectionObserver' in window) {
  let active: Element | null = null;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || e.target === active) continue;
        const el = e.target as HTMLElement;
        active = el;
        sec.textContent = el.dataset.head ?? '';
        fol.textContent = el.dataset.folio ?? '';
        sec.classList.remove('is-swapping');
        void sec.offsetWidth; // restart the animation
        sec.classList.add('is-swapping');
      }
    },
    { rootMargin: '-45% 0px -54% 0px' },
  );
  parts.forEach((p) => io.observe(p));
}
