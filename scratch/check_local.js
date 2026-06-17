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
  
  // Set viewport to desktop size
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[PAGE EXCEPTION]: ${err.toString()}`);
  });

  page.on('dialog', async dialog => {
    console.log(`[PAGE DIALOG] type: ${dialog.type()}, message: ${dialog.message()}`);
    await dialog.dismiss();
  });

  console.log("Navigating to http://localhost:8080 ...");
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });

  // Check for any sample images and click one
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

    // Switch to Watermark Eraser tab
    console.log("Clicking Watermark Eraser tab...");
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-tab="wm-remover"]');
      if (btn) btn.click();
    });

    console.log("Waiting 3 seconds for Watermark Eraser to initialize...");
    await new Promise(r => setTimeout(r, 3000));

    // Measure the dimensions of the canvas style and container
    const dims = await page.evaluate(() => {
      const canvas = document.getElementById('wmRemoverBaseCanvas');
      const layers = document.querySelector('.canvas-layers');
      const box = document.querySelector('.canvas-box');
      return {
        canvasWidth: canvas ? canvas.style.width : null,
        canvasHeight: canvas ? canvas.style.height : null,
        layersWidth: layers ? layers.style.width : null,
        layersHeight: layers ? layers.style.height : null,
        boxWidth: box ? box.getBoundingClientRect().width : null,
        boxHeight: box ? box.getBoundingClientRect().height : null
      };
    });
    console.log("Measured dimensions:", dims);

    // Take screenshot of Watermark Eraser tab
    const wmScreenshotPath = path.join(__dirname, 'local_wm_eraser_desktop.png');
    await page.screenshot({ path: wmScreenshotPath });
    console.log(`Screenshot saved to ${wmScreenshotPath}`);
  }

  await browser.close();
  console.log("Browser closed.");
})();
