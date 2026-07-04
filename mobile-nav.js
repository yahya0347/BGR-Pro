// mobile-nav.js — shared mobile chrome for the whole app: hamburger -> slide-in
// drawer, and the sticky bottom nav bar (Home / PDF Hub / Workspace / Account).
// Loaded on index.html AND every generated pdf/*.html page so there is exactly
// one implementation of this behaviour. Pure UI glue: no app state, no
// Firebase, no /api/* calls. Desktop (>=768px) never sees these elements —
// they're built with class="mobile-only" and hidden entirely above that
// breakpoint in CSS.
//
// Expected markup (present on every page that includes this script):
//   #mobileMenuBtn        the hamburger button in the mobile top bar
//   #mobileDrawer         the slide-in drawer panel
//   #mobileDrawerScrim    backdrop behind the drawer, closes on click
//   #mobileDrawerClose    close (X) button inside the drawer
//   .mobile-bottom-nav a[data-nav]  the 4 bottom nav links (home/pdf-hub/projects/account)
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const drawer = document.getElementById('mobileDrawer');
    const scrim = document.getElementById('mobileDrawerScrim');
    const closeBtn = document.getElementById('mobileDrawerClose');

    function openDrawer() {
      if (!drawer) return;
      drawer.classList.add('open');
      if (scrim) scrim.classList.add('open');
      document.body.classList.add('mobile-drawer-locked');
      menuBtn && menuBtn.setAttribute('aria-expanded', 'true');
    }
    function closeDrawer() {
      if (!drawer) return;
      drawer.classList.remove('open');
      if (scrim) scrim.classList.remove('open');
      document.body.classList.remove('mobile-drawer-locked');
      menuBtn && menuBtn.setAttribute('aria-expanded', 'false');
    }

    if (menuBtn && drawer) {
      menuBtn.addEventListener('click', () => {
        drawer.classList.contains('open') ? closeDrawer() : openDrawer();
      });
    }
    if (scrim) scrim.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    // Close the drawer after tapping any link inside it.
    if (drawer) drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeDrawer));

    // ---- Bottom nav: highlight the current section + wire soft actions ----
    const bottomNav = document.querySelector('.mobile-bottom-nav');
    if (bottomNav) {
      const path = window.location.pathname;
      const onEditor = !!document.getElementById('editorWorkspace') &&
        document.getElementById('editorWorkspace').classList.contains('active');
      const onProjects = !!document.getElementById('myProjectsView') &&
        document.getElementById('myProjectsView').classList.contains('active');
      const isPdfPage = path.includes('/pdf/');

      bottomNav.querySelectorAll('a[data-nav]').forEach((link) => {
        const which = link.getAttribute('data-nav');
        let active = false;
        if (which === 'home') active = !isPdfPage && !onEditor && !onProjects;
        else if (which === 'pdf-hub') active = isPdfPage;
        else if (which === 'projects') active = onProjects;
        link.classList.toggle('active', active);

        // "Account" opens whatever auth control already exists on this page
        // (the desktop header's account button) instead of duplicating logic.
        if (which === 'account') {
          link.addEventListener('click', (e) => {
            const authBtn = document.getElementById('btnHeaderAuth');
            if (authBtn) {
              e.preventDefault();
              authBtn.click();
            }
          });
        }
      });
    }

    // Re-run active-state detection when the SPA switches between the hub,
    // the editor workspace, and My Projects (index.html toggles `.active` on
    // each of these <main> sections).
    const editorEl = document.getElementById('editorWorkspace');
    const projectsEl = document.getElementById('myProjectsView');
    if (bottomNav && (editorEl || projectsEl)) {
      const sync = () => {
        const onEditorNow = !!editorEl && editorEl.classList.contains('active');
        const onProjectsNow = !!projectsEl && projectsEl.classList.contains('active');
        bottomNav.querySelectorAll('a[data-nav]').forEach((link) => {
          const which = link.getAttribute('data-nav');
          link.classList.toggle('active',
            which === 'projects' ? onProjectsNow :
            which === 'home' ? (!onEditorNow && !onProjectsNow) : false);
        });
      };
      if (editorEl) new MutationObserver(sync).observe(editorEl, { attributes: true, attributeFilter: ['class'] });
      if (projectsEl) new MutationObserver(sync).observe(projectsEl, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
