// home-hub.js
// Home hub interactions ONLY: the two-screen launcher/upload flow, the FAQ
// accordion, and reset-to-launcher when returning from the editor. Touches no
// app.js state, no Firebase, no /api/* call.
//
// The background dot-grid animation is NOT here anymore — it lives in the
// shared /dot-grid.js (used by every page, including all PDF tool pages), so
// the effect is identical app-wide. The #homeHubCanvas opts in via its
// data-dot-grid attribute.

(function () {
  const landing = document.getElementById('uploadLanding');
  if (!landing) return;

  /* ---- Two-screen flow: launcher <-> per-tool upload -------------------
     The home screen is a pure tool launcher (hero + AI cards + PDF Hub).
     Choosing an AI tool reveals the upload area on a secondary view. We ride
     on the SAME .landing-tab-btn click app.js already handles (which sets the
     scoped title/desc), and only toggle which sub-view is visible. PDF Hub
     tiles are external links and intentionally do not enter this flow. */
  const launcher = document.getElementById('hubLauncher');
  const uploadView = document.getElementById('hubUploadView');
  const backBtn = document.getElementById('hubBackToTools');

  function showUpload() {
    if (!launcher || !uploadView) return;
    launcher.hidden = true;
    uploadView.hidden = false;
    landing.scrollTop = 0;
  }
  function showLauncher() {
    if (!launcher || !uploadView) return;
    uploadView.hidden = true;
    launcher.hidden = false;
    landing.scrollTop = 0;
  }

  document.querySelectorAll('#hubLauncher .landing-tab-btn').forEach((btn) => {
    // Runs alongside app.js's own handler on the same click.
    btn.addEventListener('click', showUpload);
  });
  if (backBtn) backBtn.addEventListener('click', showLauncher);

  /* ---- FAQ accordion (single item open at a time) ----------------------
     Proper addEventListener handlers (no inline onclick). Toggling .open lets
     CSS animate the height/opacity + chevron rotation. */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const willOpen = !item.classList.contains('open');
      faqItems.forEach((other) => {
        other.classList.remove('open');
        const oq = other.querySelector('.faq-q');
        if (oq) oq.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('open');
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Reset to the launcher whenever we RETURN to the landing from the editor
  // (Home / back button in app.js re-adds .active) so users never land
  // mid-upload after finishing an edit.
  let wasActive = landing.classList.contains('active');
  new MutationObserver(() => {
    const nowActive = landing.classList.contains('active');
    if (nowActive && !wasActive) showLauncher();
    wasActive = nowActive;
  }).observe(landing, { attributes: true, attributeFilter: ['class'] });
})();
