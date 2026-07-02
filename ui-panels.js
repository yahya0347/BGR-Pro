// ui-panels.js
// UI-only glue for the redesigned EraserPro workspace. This file owns exactly
// four pieces of pure DOM interaction and never touches Firebase, credits,
// or any /api/* call — all of that logic lives untouched in app.js. Every
// control here is a real, already-wired app.js element (resolutionPreset,
// customWidth/customHeight, exportFormat, btnDownloadImage, etc.); this
// script only synthesizes the same events a user click/input would produce.

document.addEventListener('DOMContentLoaded', () => {
  initExportPanelToggle();
  initQuickSizeButtons();
  initSmartPngDefault();
  initWMRemoverModeToggle();
  initLeftPanelHoverCollapse();
});

// 1) Export panel open/close + hover expand/collapse ------------------------
// Behaviour (Stitch reference): hovering the header Export button expands the
// panel after a short delay; moving away from the panel collapses it after a
// grace delay; clicking still opens it, and the X still closes it instantly.
// This is pure show/hide of #exportPanel -- the CSS drives the expand/collapse
// animation. No export logic is touched here.
const EXPORT_OPEN_DELAY = 120;   // ms hover intent before expanding
const EXPORT_CLOSE_DELAY = 480;  // ms grace period before collapsing

function initExportPanelToggle() {
  const openBtn = document.getElementById('btnOpenExportPanel');
  const closeBtn = document.getElementById('btnCloseExportPanel');
  const panel = document.getElementById('exportPanel');
  if (!openBtn || !closeBtn || !panel) return;

  let openTimer = null;
  let closeTimer = null;

  const clearTimers = () => {
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  };

  const expand = () => {
    clearTimers();
    panel.classList.remove('is-collapsing');
    panel.classList.remove('hidden');
  };

  // Animated collapse: play the fade-out, then actually hide.
  const collapse = () => {
    clearTimers();
    if (panel.classList.contains('hidden')) return;
    panel.classList.add('is-collapsing');
    setTimeout(() => {
      panel.classList.add('hidden');
      panel.classList.remove('is-collapsing');
    }, 200);
  };

  // Click still opens instantly (pins it open).
  openBtn.addEventListener('click', expand);

  // X still closes instantly.
  closeBtn.addEventListener('click', collapse);

  // Hover intent on the trigger expands.
  openBtn.addEventListener('mouseenter', () => {
    clearTimers();
    openTimer = setTimeout(expand, EXPORT_OPEN_DELAY);
  });
  openBtn.addEventListener('mouseleave', () => {
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
    scheduleCollapse();
  });

  // Keep it open while the pointer is over the panel; collapse after leaving.
  panel.addEventListener('mouseenter', clearTimers);
  panel.addEventListener('mouseleave', scheduleCollapse);

  function scheduleCollapse() {
    clearTimers();
    closeTimer = setTimeout(collapse, EXPORT_CLOSE_DELAY);
  }
}

// 2) Quick export size-preset buttons ---------------------------------------
// Drives the existing resolutionPreset/customWidth/customHeight controls via
// synthetic events so app.js's own free-tier gate and aspect-lock math run
// exactly as they would for a manual selection.
function initQuickSizeButtons() {
  const buttons = document.querySelectorAll('.quick-size-btn');
  const resolutionPreset = document.getElementById('resolutionPreset');
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  if (!buttons.length || !resolutionPreset || !customWidth || !customHeight) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.getAttribute('data-quick-w');
      const h = btn.getAttribute('data-quick-h');

      resolutionPreset.value = 'custom';
      resolutionPreset.dispatchEvent(new Event('change', { bubbles: true }));

      // If the free-tier gate above just snapped the preset back to
      // 'medium' (and opened the checkout modal), don't force custom values.
      if (resolutionPreset.value !== 'custom') return;

      customWidth.value = w;
      customWidth.dispatchEvent(new Event('input', { bubbles: true }));
      customHeight.value = h;
      customHeight.dispatchEvent(new Event('input', { bubbles: true }));

      // Cosmetic only: mark the chosen preset (Stitch highlighted card).
      buttons.forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
    });
  });
}

// 3) Smart PNG-on-transparency default ---------------------------------------
// If the background was removed (transparent result) and the user picks a
// format that can't hold transparency, snap back to PNG.
function initSmartPngDefault() {
  const exportFormat = document.getElementById('exportFormat');
  if (!exportFormat) return;

  exportFormat.addEventListener('change', () => {
    const bgRemoverView = document.getElementById('view-bg-remover');
    const isTransparentResult = !!(bgRemoverView && bgRemoverView.classList.contains('active'));
    if (isTransparentResult && exportFormat.value === 'jpg') {
      exportFormat.value = 'png';
    }
  });
}

// 4) Auto/Manual segmented toggle inside the Watermark Remover panel --------
function initWMRemoverModeToggle() {
  const group = document.getElementById('wmRemoverModeGroup');
  const autoPanel = document.getElementById('wmRemoverAutoPanel');
  const manualPanel = document.getElementById('wmRemoverManualPanel');
  if (!group || !autoPanel || !manualPanel) return;

  const buttons = group.querySelectorAll('[data-wm-remover-mode]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-wm-remover-mode');

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'auto') {
        autoPanel.classList.remove('hidden');
        manualPanel.classList.add('hidden');
      } else {
        autoPanel.classList.add('hidden');
        manualPanel.classList.remove('hidden');
      }
    });
  });
}

// 5) Left tool panel hover expand/collapse (mirrors #1 above) ---------------
// Background Eraser / Watermark Remover / Watermark Maker collapse to just
// their icon+title header when the pointer isn't nearby, and expand to the
// full panel on hover -- same open/close delays as initExportPanelToggle,
// and the CSS-driven expand animation is shared with #exportPanel. Tool
// switching (.active, driven by app.js) is untouched; this only toggles
// `.is-panel-collapsed` on the active panel.
const LEFT_PANEL_OPEN_DELAY = 120;   // ms hover intent before expanding
const LEFT_PANEL_CLOSE_DELAY = 480;  // ms grace period before collapsing

function initLeftPanelHoverCollapse() {
  const panelIds = ['config-bg-remover', 'config-wm-remover', 'config-wm-maker'];

  panelIds.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;

    panel.classList.add('is-panel-collapsed');

    let openTimer = null;
    let closeTimer = null;

    panel.addEventListener('mouseenter', () => {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      openTimer = setTimeout(() => panel.classList.remove('is-panel-collapsed'), LEFT_PANEL_OPEN_DELAY);
    });
    panel.addEventListener('mouseleave', () => {
      if (openTimer) { clearTimeout(openTimer); openTimer = null; }
      closeTimer = setTimeout(() => panel.classList.add('is-panel-collapsed'), LEFT_PANEL_CLOSE_DELAY);
    });
  });
}
