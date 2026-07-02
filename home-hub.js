// home-hub.js
// UI-only enhancement for the redesigned home hub. Owns exactly one thing: the
// mouse-reactive dot-grid background canvas. Touches no app.js state, no
// Firebase, no /api/* call. The 3 AI tool cards keep their existing
// data-landing-tab wiring in app.js; PDF Hub tiles are plain external links.
//
// The dot grid runs a continuous requestAnimationFrame loop (exact Stitch
// logic: 24px spacing, 1->2.5px radius, colour lerp #ccc3d8 -> #7c3aed within
// 120px of the pointer). The canvas is a child of #uploadLanding, so it is not
// painted while the editor view is open (parent is display:none).

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

  // Reset to the launcher whenever we RETURN to the landing from the editor
  // (Home / back button in app.js re-adds .active) so users never land
  // mid-upload after finishing an edit.
  let wasActive = landing.classList.contains('active');
  new MutationObserver(() => {
    const nowActive = landing.classList.contains('active');
    if (nowActive && !wasActive) showLauncher();
    wasActive = nowActive;
  }).observe(landing, { attributes: true, attributeFilter: ['class'] });

  // ---- Mouse-reactive dot grid (exact Stitch logic) ----------------------
  let width, height;
  let mouse = { x: -1000, y: -1000 };

  const spacing = 24;
  const baseRadius = 1;
  const maxRadius = 2.5;
  const hoverDistance = 120;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const cols = Math.ceil(width / spacing);
    const rows = Math.ceil(height / spacing);

    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const x = i * spacing;
        const y = j * spacing;

        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let radius = baseRadius;
        let r = 204, g = 195, b = 216;

        if (distance < hoverDistance) {
          const factor = 1 - (distance / hoverDistance);
          radius = baseRadius + (maxRadius - baseRadius) * factor;
          r = Math.round(204 - (204 - 124) * factor);
          g = Math.round(195 - (195 - 58) * factor);
          b = Math.round(216 + (237 - 216) * factor);
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
