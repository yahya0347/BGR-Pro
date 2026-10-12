// canvas-viewport.js
// Shared zoom / pan / fit controller for the editor canvas, used by all three
// tools (Background Eraser, Watermark Remover, Watermark Maker).
//
// The visible <canvas> is always exactly the size of its container (CSS px *
// devicePixelRatio). The image itself lives in full-resolution offscreen
// buffers owned by app.js and is drawn here once per frame through a single
// transform:  screen = image * scale + offset.  Nothing in CSS sizes or scales
// the image, so no breakpoint can fight the fit calculation.

const MAX_FIT_SCALE = 4;   // never auto-upscale a tiny image past 400%
const MAX_SCALE = 8;       // manual zoom ceiling
const FIT_FILL = 0.9;      // image fills 90% of the container when fitted
const KEEP_VISIBLE = 48;   // px of image that must stay on screen while panning

export function createViewport(canvas, opts) {
  const ctx = canvas.getContext('2d');

  let imgW = 0, imgH = 0;          // image size in image pixels
  let viewW = 0, viewH = 0;        // canvas size in CSS pixels
  let dpr = 1;
  let scale = 1, offX = 0, offY = 0;
  let fitted = true;               // false once the user zooms/pans manually
  let framePending = false;

  /* ---- geometry ------------------------------------------------------- */

  function fitScale() {
    if (!imgW || !imgH || !viewW || !viewH) return 1;
    return Math.min((viewW * FIT_FILL) / imgW, (viewH * FIT_FILL) / imgH, MAX_FIT_SCALE);
  }

  function minScale() {
    return Math.min(fitScale(), 1) * 0.5;
  }

  function clampAxis(off, view, size) {
    const keep = Math.min(KEEP_VISIBLE, size);
    return Math.max(keep - size, Math.min(view - keep, off));
  }

  function clampOffsets() {
    offX = clampAxis(offX, viewW, imgW * scale);
    offY = clampAxis(offY, viewH, imgH * scale);
  }

  function measure() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const d = window.devicePixelRatio || 1;
    if (w === viewW && h === viewH && d === dpr) return false;
    viewW = w; viewH = h; dpr = d;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    return true;
  }

  function changed() {
    requestRender();
    if (opts.onChange) opts.onChange();
  }

  function fit() {
    measure();
    fitted = true;
    scale = fitScale();
    offX = (viewW - imgW * scale) / 2;
    offY = (viewH - imgH * scale) / 2;
    changed();
  }

  // Zoom by `factor`, keeping the image point under (cx, cy) fixed.
  // cx/cy are CSS px relative to the canvas; default is the view centre.
  function zoomAt(factor, cx = viewW / 2, cy = viewH / 2) {
    const next = Math.max(minScale(), Math.min(Math.max(MAX_SCALE, fitScale()), scale * factor));
    if (next === scale) return;
    const ix = (cx - offX) / scale;
    const iy = (cy - offY) / scale;
    scale = next;
    offX = cx - ix * scale;
    offY = cy - iy * scale;
    fitted = false;
    clampOffsets();
    changed();
  }

  function panBy(dx, dy) {
    offX += dx;
    offY += dy;
    fitted = false;
    clampOffsets();
    changed();
  }

  // Container changed size (window resize, rotation, panel layout). A fitted
  // view re-fits; a manually zoomed view keeps its zoom level and keeps the
  // same image point in the centre of the view.
  function handleResize() {
    const oldW = viewW, oldH = viewH;
    if (!measure()) return;
    if (!viewW || !viewH) return;
    if (fitted || !oldW || !oldH) {
      fit();
      return;
    }
    const ix = (oldW / 2 - offX) / scale;
    const iy = (oldH / 2 - offY) / scale;
    scale = Math.max(minScale(), scale);
    offX = viewW / 2 - ix * scale;
    offY = viewH / 2 - iy * scale;
    clampOffsets();
    changed();
  }

  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Inverse of the render transform: pointer event -> image pixel coordinates.
  function screenToImage(e) {
    const p = localPoint(e);
    return { x: (p.x - offX) / scale, y: (p.y - offY) / scale };
  }

  /* ---- rendering ------------------------------------------------------ */

  function requestRender() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      if (measure() && fitted) {
        scale = fitScale();
        offX = (viewW - imgW * scale) / 2;
        offY = (viewH - imgH * scale) / 2;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!imgW || !imgH || !viewW || !viewH) return;
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      opts.render(ctx);
    });
  }

  /* ---- input ---------------------------------------------------------- */

  const pointers = new Map();   // pointerId -> {x, y} (CSS px, canvas-relative)
  let mode = null;              // null | 'paint' | 'pan' | 'pinch'
  let activeId = null;          // pointer driving paint / pan
  let penDown = false;          // palm rejection: ignore touch while a pen is down
  let last = null;              // previous pan point
  let pinch = null;             // { dist, scale, ix, iy }

  function refreshCursor() {
    canvas.style.cursor = mode === 'pan' || mode === 'pinch'
      ? 'grabbing'
      : (opts.cursor ? opts.cursor() : 'grab');
  }

  function endPaint(cancelled) {
    if (mode !== 'paint') return;
    mode = null;
    if (opts.paint) opts.paint.end(cancelled);
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      scale,
      ix: (mx - offX) / scale,
      iy: (my - offY) / scale
    };
    mode = 'pinch';
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && penDown) return;
    if (e.pointerType === 'pen') {
      penDown = true;
      // A palm that landed before the pen must not keep panning or painting.
      if (mode && activeId !== e.pointerId) {
        endPaint(true);
        mode = null;
        pointers.clear();
      }
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    pointers.set(e.pointerId, localPoint(e));

    if (e.pointerType === 'touch' && pointers.size === 2) {
      endPaint(true);            // second finger: the first one was not a stroke
      startPinch();
    } else if (pointers.size === 1) {
      activeId = e.pointerId;
      if (opts.paint && opts.paint.canStart(e)) {
        mode = 'paint';
        opts.paint.start(screenToImage(e), e);
      } else {
        mode = 'pan';
        last = pointers.get(e.pointerId);
      }
    }
    e.preventDefault();
    refreshCursor();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.set(e.pointerId, p);

    if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      scale = Math.max(minScale(), Math.min(Math.max(MAX_SCALE, fitScale()), pinch.scale * dist / pinch.dist));
      // The image point that was under the fingers' midpoint stays under it,
      // so one gesture both zooms and pans.
      offX = mx - pinch.ix * scale;
      offY = my - pinch.iy * scale;
      fitted = false;
      clampOffsets();
      changed();
    } else if (mode === 'paint' && e.pointerId === activeId) {
      // Coalesced events keep fast pen / finger strokes smooth.
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      (events.length ? events : [e]).forEach(ev => opts.paint.move(screenToImage(ev), ev));
    } else if (mode === 'pan' && e.pointerId === activeId) {
      panBy(p.x - last.x, p.y - last.y);
      last = p;
    }
    e.preventDefault();
  });

  function release(e) {
    if (e.pointerType === 'pen') penDown = false;
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);

    if (mode === 'paint' && e.pointerId === activeId) {
      endPaint(e.type === 'pointercancel');
    } else if (mode === 'pinch') {
      // One finger left: carry on as a pan from where that finger is now.
      if (pointers.size === 1) {
        activeId = [...pointers.keys()][0];
        last = pointers.get(activeId);
        mode = 'pan';
      } else {
        mode = null;
      }
    } else if (e.pointerId === activeId) {
      mode = null;
    }
    if (pointers.size === 0) mode = null;
    refreshCursor();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // deltaMode 1 = lines (Firefox mouse wheel); ctrlKey = trackpad pinch.
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    const p = localPoint(e);
    zoomAt(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
  }, { passive: false });

  if (window.ResizeObserver) new ResizeObserver(handleResize).observe(canvas);
  window.addEventListener('resize', handleResize);
  // Rotation: layout settles a frame or two after the event fires.
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(() => requestAnimationFrame(handleResize));
  });

  refreshCursor();

  return {
    // Tell the viewport how big the image is. Re-fits when asked to, or when
    // the size actually changed; otherwise the current zoom/pan is kept.
    setImageSize(w, h, refit) {
      const sizeChanged = w !== imgW || h !== imgH;
      imgW = w; imgH = h;
      if (refit || sizeChanged) fit(); else requestRender();
    },
    fit,
    zoomAt,
    panBy,
    screenToImage,
    requestRender,
    refreshCursor,
    get scale() { return scale; },
    get fitted() { return fitted; },
    // On-screen rectangle of the image, in CSS px relative to the canvas.
    imageRect() {
      return { left: offX, top: offY, width: imgW * scale, height: imgH * scale };
    },
    viewSize() {
      return { width: viewW, height: viewH };
    }
  };
}
