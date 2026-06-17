const puppeteer = require('puppeteer-core');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Dismiss dialogs
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });
  
  await page.goto('http://localhost:8080/', { waitUntil: 'load' });
  await page.click('.sample-item');
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const btn = document.querySelector('button[data-tab="wm-remover"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  const hierarchy = await page.evaluate(() => {
    const elements = [
      { selector: '#editorWorkspace', name: 'workspace' },
      { selector: '.canvas-workspace', name: 'canvas-workspace' },
      { selector: '.canvas-box', name: 'canvas-box' },
      { selector: '#view-wm-remover', name: 'view-wm-remover' },
      { selector: '#view-wm-remover .editor-canvas-wrapper', name: 'editor-canvas-wrapper' },
      { selector: '#view-wm-remover .canvas-bg-pattern', name: 'canvas-bg-pattern' },
      { selector: '#view-wm-remover .brush-control-bar', name: 'brush-control-bar' }
    ];

    return elements.map(item => {
      const el = document.querySelector(item.selector);
      if (!el) return { name: item.name, error: 'Not found' };
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        name: item.name,
        width: style.width,
        height: style.height,
        display: style.display,
        position: style.position,
        maxWidth: style.maxWidth,
        maxHeight: style.maxHeight,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      };
    });
  });

  console.log("HIERARCHY RESULTS:\n", JSON.stringify(hierarchy, null, 2));
  await browser.close();
})();
