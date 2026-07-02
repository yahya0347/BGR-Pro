// home-hub.js
// UI-only enhancement for the redesigned home hub. Owns exactly one thing: the
// mouse-reactive dot-grid background canvas. Touches no app.js state, no
// Firebase, no /api/* call. The 3 AI tool cards keep their existing
// data-landing-tab wiring in app.js; PDF Hub tiles are plain external links.
//
// Performance: the canvas settles to a static grid when the mouse stops (zero
// idle CPU) and pauses entirely when the editor view is open (its parent
// #uploadLanding becomes display:none, so the canvas isn't painted either).

(function () {
  const canvas = document.getElementById('homeHubCanvas');
  const landing = document.getElementById('uploadLanding');
  if (!canvas || !landing) return;

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

  const ctx = canvas.getContext('2d');
  const SPACING = 24;
  const BASE_R = 1;
  const MAX_R = 2.5;
  const HOVER = 120;
  // Rest colour #ccc3d8 (outline-variant) -> hover colour #7c3aed (primary).
  const REST = { r: 204, g: 195, b: 216 };
  const HOT = { r: 124, g: 58, b: 237 };

  let width = 0;
  let height = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let mouse = { x: -9999, y: -9999 };
  let rafId = null;
  let settleFrames = 0; // frames left to animate after the last mouse move

  const isActive = () =>
    landing.classList.contains('active') && document.visibilityState === 'visible';

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    const cols = Math.ceil(width / SPACING);
    const rows = Math.ceil(height / SPACING);
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const x = i * SPACING;
        const y = j * SPACING;
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let radius = BASE_R;
        let r = REST.r, g = REST.g, b = REST.b;
        if (dist < HOVER) {
          const f = 1 - dist / HOVER;
          radius = BASE_R + (MAX_R - BASE_R) * f;
          r = Math.round(REST.r + (HOT.r - REST.r) * f);
          g = Math.round(REST.g + (HOT.g - REST.g) * f);
          b = Math.round(REST.b + (HOT.b - REST.b) * f);
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.fill();
      }
    }
  }

  function loop() {
    if (!isActive()) { rafId = null; return; }
    drawFrame();
    if (settleFrames > 0) {
      settleFrames--;
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null; // idle: leave the static grid rendered, stop burning CPU
    }
  }

  // Restart the animation for a short window (so dots relax back after the
  // pointer passes), but only while the hub is actually visible.
  function kick() {
    if (!isActive()) return;
    settleFrames = 80;
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { resize(); kick(); });
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    kick();
  }, { passive: true });
  window.addEventListener('mouseleave', () => {
    mouse.x = -9999; mouse.y = -9999;
    kick();
  });
  document.addEventListener('visibilitychange', kick);

  // Re-render when the workspace switches back to the landing, and reset to
  // the launcher whenever we RETURN to the landing from the editor (Home /
  // back button in app.js re-adds .active) so users never land mid-upload.
  let wasActive = landing.classList.contains('active');
  new MutationObserver(() => {
    const nowActive = landing.classList.contains('active');
    if (nowActive && !wasActive) showLauncher();
    wasActive = nowActive;
    kick();
  }).observe(landing, { attributes: true, attributeFilter: ['class'] });

  resize();
  drawFrame(); // initial static grid
  kick();
})();
