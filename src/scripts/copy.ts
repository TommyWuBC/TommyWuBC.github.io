// Copy-to-clipboard buttons: <button data-copy="text">. The button's label
// briefly reads "Copied"; give the button aria-live="polite" so it is announced.
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
  const label = btn.textContent;
  let timer: number | undefined;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Couldn’t copy';
    }
    btn.dataset.state = 'done';
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      btn.textContent = label;
      delete btn.dataset.state;
    }, 1800);
  });
});
