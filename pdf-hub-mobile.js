// pdf-hub-mobile.js — mobile-only behaviour for the home page's PDF Hub
// section: collapsible accordion categories (data-attribute driven, no
// inline onclick) + a search box that filters tiles and auto-expands any
// category with a match. Pure UI glue, no app state.
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    const pdfHub = document.getElementById('pdfHub');
    if (!pdfHub) return;

    const cats = Array.from(pdfHub.querySelectorAll('.pdf-cat'));

    // Accordion toggle (CSS gates the collapse visual to <768px; the class
    // toggle itself is harmless at desktop widths where tiles stay expanded).
    cats.forEach((cat) => {
      const header = cat.querySelector('[data-pdf-cat-toggle]');
      if (!header) return;
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.addEventListener('click', () => cat.classList.toggle('open'));
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cat.classList.toggle('open'); }
      });
    });
    // Open the first category by default so the section isn't a wall of
    // collapsed headers on first view.
    if (cats[0]) cats[0].classList.add('open');

    // Search: filter tiles by label text; auto-expand categories with a hit.
    const search = document.getElementById('pdfHubSearch');
    if (!search) return;
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      cats.forEach((cat) => {
        const tiles = Array.from(cat.querySelectorAll('.pdf-tile'));
        let anyMatch = false;
        tiles.forEach((tile) => {
          const label = (tile.querySelector('.pdf-tile-label')?.textContent || '').toLowerCase();
          const match = !q || label.includes(q);
          tile.classList.toggle('search-hidden', !match);
          if (match) anyMatch = true;
        });
        if (q) cat.classList.toggle('open', anyMatch);
        else cat.classList.toggle('open', cat === cats[0]); // restore default state when cleared
      });
    });
  });
})();
