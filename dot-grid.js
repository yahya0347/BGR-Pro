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
    const GYRO_MAX_OFFSET = 6;  // px — "a few pixels max"
    const GYRO_EASE = 0.06;     // low = calm/smooth, no dizzying motion

    // ---- TEMPORARY on-screen debug badge (Android real-device diagnosis) --
    // Remove this block once the drift issue is confirmed fixed on-device.
    let gyroDebugEl = null;
    function setGyroDebugState(text) {
      if (gyroDebugEl) gyroDebugEl.textContent = 'gyro: ' + text;
    }

    function gyroLoop() {
      gyroRafId = null;
      if (document.hidden) return; // paused while backgrounded; visibilitychange resumes it
      gyroOffset.x += (gyroTarget.x - gyroOffset.x) * GYRO_EASE;
      gyroOffset.y += (gyroTarget.y - gyroOffset.y) * GYRO_EASE;
      drawFrame(gyroOffset.x, gyroOffset.y);
      gyroRafId = requestAnimationFrame(gyroLoop);
    }

    function startGyroLoop() {
      if (gyroRafId == null) gyroRafId = requestAnimationFrame(gyroLoop);
    }

    function handleOrientation(e) {
      if (typeof e.gamma !== 'number' && typeof e.beta !== 'number') {
        setGyroDebugState('listener attached (no data received)');
        return; // no real sensor data
      }
      const gamma = Math.max(-45, Math.min(45, e.gamma || 0));       // left-right tilt
      const beta = Math.max(-45, Math.min(45, (e.beta || 0) - 45));  // front-back tilt, recentred to a natural holding angle
      gyroTarget.x = (gamma / 45) * GYRO_MAX_OFFSET;
      gyroTarget.y = (beta / 45) * GYRO_MAX_OFFSET;
      if (!gyroActive) {
        gyroActive = true;
        startGyroLoop();
      }
      setGyroDebugState('granted, listener attached — β:' + Math.round(e.beta) + ' γ:' + Math.round(e.gamma));
    }

    function requestGyroPermission() {
      if (gyroRequested) return;
      gyroRequested = true;
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) { setGyroDebugState('unsupported (no DeviceOrientationEvent)'); return; } // no gyroscope support -> stays on the static frame
      if (typeof DOE.requestPermission === 'function') {
        // iOS 13+: must be invoked from a user gesture. Denial or error ->
        // silent fallback, we never ask again this session.
        setGyroDebugState('requesting');
        DOE.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, { passive: true });
              setGyroDebugState('granted, listener attached');
            } else {
              setGyroDebugState('denied (' + state + ')');
            }
          })
          .catch((err) => setGyroDebugState('denied (error: ' + (err && err.message) + ')'));
      } else {
        // No permission gate needed (Android / older iOS)
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        setGyroDebugState('granted, listener attached');
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
      // TEMPORARY: visible on-screen state badge for real-device diagnosis.
      // Remove this element once the drift issue is confirmed fixed.
      gyroDebugEl = document.createElement('div');
      gyroDebugEl.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);left:0;z-index:2147483647;'
        + 'background:rgba(0,0,0,0.8);color:#39ff14;font:11px/1.4 monospace;padding:4px 8px;'
        + 'border-bottom-right-radius:8px;pointer-events:none;white-space:pre-wrap;max-width:100vw;';
      gyroDebugEl.textContent = 'gyro: not requested';
      document.body.appendChild(gyroDebugEl);

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
