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
});

// 1) Export panel open/close ------------------------------------------------
function initExportPanelToggle() {
  const openBtn = document.getElementById('btnOpenExportPanel');
  const closeBtn = document.getElementById('btnCloseExportPanel');
  const panel = document.getElementById('exportPanel');
  if (!openBtn || !closeBtn || !panel) return;

  openBtn.addEventListener('click', () => {
    panel.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
  });
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
