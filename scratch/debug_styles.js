const puppeteer = require('puppeteer-core');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Handle dialogs
  page.on('dialog', async dialog => {
    console.log(`[PAGE DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });

  page.on('console', msg => console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGE EXCEPTION]: ${err.toString()}`));
  
  console.log("Navigating to http://localhost:8080/ ...");
  await page.goto('http://localhost:8080/', { waitUntil: 'load', timeout: 30000 });

  console.log("Clicking the first sample item...");
  await page.click('.sample-item');
  
  console.log("Waiting 3 seconds...");
  await new Promise(r => setTimeout(r, 3000));

  console.log("Clicking Watermark Eraser tab...");
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-tab="wm-remover"]');
    if (btn) btn.click();
  });

  console.log("Waiting 2 seconds for tab initialization...");
  await new Promise(r => setTimeout(r, 2000));

  // Take a local screenshot to visually verify the new floating switcher
  const localScreenshotPath = require('path').join(__dirname, 'local_wm_switcher.png');
  await page.screenshot({ path: localScreenshotPath });
  console.log(`Screenshot saved to ${localScreenshotPath}`);

  console.log("Querying computed styles...");
  const data = await page.evaluate(() => {
    const wrapper = document.querySelector('#view-wm-remover .editor-canvas-wrapper');
    const pattern = document.querySelector('#view-wm-remover .canvas-bg-pattern');
    const bar = document.querySelector('#view-wm-remover .brush-control-bar');
    const switcher = document.querySelector('#view-wm-remover #wmModeSwitcher');
    
    const getRectAndStyle = (el, name) => {
      if (!el) return { name, error: 'Not found' };
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        name,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        position: style.position,
        display: style.display,
        width: style.width,
        height: style.height
      };
    };

    return {
      window: { width: window.innerWidth, height: window.innerHeight },
      wrapper: getRectAndStyle(wrapper, 'wrapper'),
      switcher: getRectAndStyle(switcher, 'switcher'),
      pattern: getRectAndStyle(pattern, 'pattern'),
      bar: getRectAndStyle(bar, 'bar')
    };
  });

  console.log("RESULTS:\n", JSON.stringify(data, null, 2));

  await browser.close();
})();
