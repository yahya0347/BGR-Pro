const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  console.log("Launching browser in mobile emulation mode...");
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport to a standard mobile device (iPhone 12/13/14 Pro width)
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });

  page.on('console', msg => console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGE EXCEPTION]: ${err.toString()}`));
  
  console.log("Navigating to http://localhost:8080/ ...");
  await page.goto('http://localhost:8080/', { waitUntil: 'load', timeout: 30000 });

  // Accept any dialogs (like fallback contrast cutout)
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  // Take a screenshot of the mobile landing page
  await page.screenshot({ path: path.join(__dirname, 'mobile_home.png'), fullPage: true });
  console.log("Captured mobile_home.png");

  // Click the first sample item
  console.log("Clicking first sample item...");
  await page.click('.sample-item');
  await new Promise(r => setTimeout(r, 4000));

  // Take a screenshot of the mobile BG Remover view
  await page.screenshot({ path: path.join(__dirname, 'mobile_bg_remover.png') });
  console.log("Captured mobile_bg_remover.png");

  // Switch to Watermark Eraser tab
  console.log("Switching to Watermark Eraser tab...");
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-tab="wm-remover"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  // Take a screenshot of the mobile Watermark Eraser view
  await page.screenshot({ path: path.join(__dirname, 'mobile_wm_remover.png') });
  console.log("Captured mobile_wm_remover.png");

  // Switch to Watermark Maker tab
  console.log("Switching to Watermark Maker tab...");
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-tab="wm-maker"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  // Take a screenshot of the mobile Watermark Maker view
  await page.screenshot({ path: path.join(__dirname, 'mobile_wm_maker.png') });
  console.log("Captured mobile_wm_maker.png");

  await browser.close();
  console.log("Browser closed.");
})();
