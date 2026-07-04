// dot-grid.js — the ONE mouse-reactive dot-grid background animation used
// across the whole app (home screen + every PDF tool page). Single source of
// truth so the effect is guaranteed identical everywhere.
//
// Exact behaviour (from the home screen): 24px grid, dots grow 1→2.5px and
// their colour lerps #ccc3d8 → #7c3aed within 120px of the pointer; continuous
// requestAnimationFrame loop; mouse parks at -1000 on leave.
//
// Usage: window.initDotGrid(canvasEl). Any <canvas data-dot-grid> is also
// auto-initialised on load.

(function () {
  // Touch/no-hover devices have no cursor to react to, so the continuous
  // rAF loop would just burn battery for a static-looking result. Draw the
  // grid once at rest instead. (matchMedia, not UA sniffing, so a touch
  // laptop with a real mouse still gets the interactive version.)
  const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  function initDotGrid(canvas) {
    if (!canvas || canvas.__dotGridInit) return;
    canvas.__dotGridInit = true;
    const ctx = canvas.getContext('2d');

    let width, height;
    let mouse = { x: -1000, y: -1000 };

    const spacing = 24;
    const baseRadius = 1;
    const maxRadius = 2.5;
    const hoverDistance = 120;

    function drawFrame(offsetX, offsetY) {
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      ctx.fillStyle = 'rgb(204, 195, 216)';
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          ctx.beginPath();
          ctx.arc(i * spacing + offsetX, j * spacing + offsetY, baseRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawStatic() {
      drawFrame(0, 0);
    }

    // ---- Mobile: subtle gyroscope-driven drift ----
    // Touch devices have no cursor, so instead of the mouse-reactive loop
    // below we let a *very* small parallax offset follow the phone's tilt.
    // Everything here is additive/opt-in: if there's no DeviceOrientation
    // support, permission is denied, or no real sensor data ever arrives,
    // we just keep showing the single static frame drawn above — silently,
    // no console errors, no retry loop.
    let gyroOffset = { x: 0, y: 0 }; // eased, on-screen position
    let gyroTarget = { x: 0, y: 0 }; // latest raw reading (clamped)
    let gyroActive = false;          // true once a real orientation reading has arrived
    let gyroRafId = null;
    let gyroRequested = false;
    const GYRO_MAX_OFFSET = 30; // px — clearly visible at a moderate ~20-30° tilt, still clamped so extreme tilts can't push dots off-screen
    const GYRO_EASE = 0.06;     // low = calm/smooth, no dizzying motion

    // ---- Crystal/gradient shimmer (mobile only, only while gyro is active) --
    // A soft radial "wash" sweeps behind the dots, centred on the same eased
    // tilt offset used for the drift (so it moves with the exact same calm
    // lerp, no separate easing state needed). Dots near that centre catch the
    // light: they lerp from the base lavender toward the secondary brand
    // colour and grow/opacify slightly, mirroring the existing desktop
    // hover-lerp pattern in draw() below but driven by tilt instead of mouse.
    const GLOW_SWEEP = 0.35;     // fraction of half-viewport the glow centre can travel
    const GLOW_RADIUS_FACTOR = 0.6; // wash radius as a fraction of the larger viewport dimension
    const SPARKLE_RADIUS = 160;  // px — dots this close to the glow centre catch the light

    function drawGyroFrame(offsetX, offsetY) {
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);

      const glowX = width / 2 + (offsetX / GYRO_MAX_OFFSET) * width * GLOW_SWEEP;
      const glowY = height / 2 + (offsetY / GYRO_MAX_OFFSET) * height * GLOW_SWEEP;
      const glowRadius = Math.max(width, height) * GLOW_RADIUS_FACTOR;

      // One gradient object per frame (cheap) drawn as a soft wash underneath
      // the dots — not recomputed per dot.
      const gradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
      gradient.addColorStop(0, 'rgba(180, 19, 109, 0.12)');  // secondary #b4136d, bright core
      gradient.addColorStop(0.5, 'rgba(72, 0, 160, 0.06)');  // primary #4800a0, mid fade
      gradient.addColorStop(1, 'rgba(72, 0, 160, 0)');       // fades to fully transparent
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const x = i * spacing + offsetX;
          const y = j * spacing + offsetY;

          const dx = x - glowX;
          const dy = y - glowY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          let radius = baseRadius;
          let r = 204, g = 195, b = 216, a = 0.85;

          if (distance < SPARKLE_RADIUS) {
            const factor = 1 - (distance / SPARKLE_RADIUS);
            radius = baseRadius + (maxRadius - baseRadius) * factor;
            r = Math.round(204 + (180 - 204) * factor); // lavender -> secondary red
            g = Math.round(195 + (19 - 195) * factor);  // lavender -> secondary green
            b = Math.round(216 + (109 - 216) * factor); // lavender -> secondary blue
            a = 0.85 + 0.15 * factor;
          }

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
          ctx.fill();
        }
      }
    }

    function gyroLoop() {
      gyroRafId = null;
      if (document.hidden) return; // paused while backgrounded; visibilitychange resumes it
      gyroOffset.x += (gyroTarget.x - gyroOffset.x) * GYRO_EASE;
      gyroOffset.y += (gyroTarget.y - gyroOffset.y) * GYRO_EASE;
      drawGyroFrame(gyroOffset.x, gyroOffset.y);
      gyroRafId = requestAnimationFrame(gyroLoop);
    }

    function startGyroLoop() {
      if (gyroRafId == null) gyroRafId = requestAnimationFrame(gyroLoop);
    }

    function handleOrientation(e) {
      if (typeof e.gamma !== 'number' && typeof e.beta !== 'number') return; // no real sensor data
      const gamma = Math.max(-45, Math.min(45, e.gamma || 0));       // left-right tilt
      const beta = Math.max(-45, Math.min(45, (e.beta || 0) - 45));  // front-back tilt, recentred to a natural holding angle
      gyroTarget.x = (gamma / 45) * GYRO_MAX_OFFSET;
      gyroTarget.y = (beta / 45) * GYRO_MAX_OFFSET;
      if (!gyroActive) {
        gyroActive = true;
        startGyroLoop();
      }
    }

    function requestGyroPermission() {
      if (gyroRequested) return;
      gyroRequested = true;
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return; // no gyroscope support -> stays on the static frame
      if (typeof DOE.requestPermission === 'function') {
        // iOS 13+: must be invoked from a user gesture. Denial or error ->
        // silent fallback, we never ask again this session.
        DOE.requestPermission()
          .then((state) => {
            if (state === 'granted') window.addEventListener('deviceorientation', handleOrientation, { passive: true });
          })
          .catch(() => {});
      } else {
        // No permission gate needed (Android / older iOS)
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && gyroActive) startGyroLoop();
    });

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (isTouchDevice && !gyroActive) drawStatic();
    }

    window.addEventListener('resize', resize);
    resize();

    if (isTouchDevice) {
      drawStatic();
      // Request gyro permission gracefully on the first tap anywhere on the
      // page, rather than immediately on load (iOS requires a user gesture).
      document.addEventListener('click', requestGyroPermission, { once: true, passive: true });
      document.addEventListener('touchend', requestGyroPermission, { once: true, passive: true });
      return; // no mousemove listeners, no continuous loop unless gyro kicks in
    }

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
  }

  window.initDotGrid = initDotGrid;

  // Auto-initialise any canvas that opts in with the data-dot-grid attribute.
  const boot = () => document.querySelectorAll('canvas[data-dot-grid]').forEach(initDotGrid);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
