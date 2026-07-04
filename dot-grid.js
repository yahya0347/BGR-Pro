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

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (isTouchDevice) drawStatic();
    }

    window.addEventListener('resize', resize);
    resize();

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      ctx.fillStyle = 'rgb(204, 195, 216)';
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          ctx.beginPath();
          ctx.arc(i * spacing, j * spacing, baseRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (isTouchDevice) {
      drawStatic();
      return; // no mousemove listeners, no rAF loop
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
