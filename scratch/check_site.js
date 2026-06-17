const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', err => {
    console.error(`[PAGE EXCEPTION]: ${err.toString()}`);
  });

  console.log("Navigating to https://bg-eraser-pro.com ...");
  await page.goto('https://bg-eraser-pro.com', { waitUntil: 'networkidle2' });

  // Take a screenshot of the home page
  const homeScreenshotPath = path.join(__dirname, 'home_screenshot.png');
  await page.screenshot({ path: homeScreenshotPath });
  console.log(`Screenshot saved to ${homeScreenshotPath}`);

  // Let's check for any sample images and click one
  console.log("Checking for sample items...");
  const sampleSelector = '.sample-item';
  const hasSample = await page.$(sampleSelector) !== null;
  console.log(`Has sample items? ${hasSample}`);

  if (hasSample) {
    console.log("Clicking the first sample item...");
    await page.click(sampleSelector);

    // Wait for the workspace to load
    console.log("Waiting 3 seconds for workspace to load...");
    await new Promise(r => setTimeout(r, 3000));

    // Take screenshot of editor
    const editorScreenshotPath = path.join(__dirname, 'editor_screenshot.png');
    await page.screenshot({ path: editorScreenshotPath });
    console.log(`Editor screenshot saved to ${editorScreenshotPath}`);

    // Switch to Watermark Eraser tab
    console.log("Clicking Watermark Eraser tab...");
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-tab="wm-remover"]');
      if (btn) btn.click();
    });

    console.log("Waiting 3 seconds for Watermark Eraser to initialize...");
    await new Promise(r => setTimeout(r, 3000));

    // Take screenshot of Watermark Eraser tab
    const wmScreenshotPath = path.join(__dirname, 'wm_screenshot.png');
    await page.screenshot({ path: wmScreenshotPath });
    console.log(`Watermark Eraser tab screenshot saved to ${wmScreenshotPath}`);
  }

  await browser.close();
  console.log("Browser closed.");
})();
