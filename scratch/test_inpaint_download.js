const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Mock confirm dialogs to auto failover to Magic Cutout
    await page.evaluateOnNewDocument(() => {
      window.confirm = () => true;
    });

    page.on('console', msg => {
      console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error(`[PAGE EXCEPTION]: ${err.toString()}`);
    });

    // Set download path to scratch directory
    const downloadPath = __dirname;
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000)); // Wait 5s for page scripts to load

    console.log("Clicking the first sample item...");
    await page.click('.sample-item');

    console.log("Waiting 3 seconds for workspace to load...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Switching to Watermark Eraser tab...");
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-tab="wm-remover"]');
      if (btn) btn.click();
    });

    console.log("Waiting 2 seconds for Watermark Eraser to initialize...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("Simulating brush drawing on canvas...");
    const brushCanvas = await page.$('#wmRemoverBrushCanvas');
    const box = await brushCanvas.boundingBox();

    // Brush in the center of the image
    const startX = box.x + box.width / 2 - 30;
    const startY = box.y + box.height / 2 - 30;
    const endX = box.x + box.width / 2 + 30;
    const endY = box.y + box.height / 2 + 30;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();
    console.log("Brushing finished.");

    const beforeInpaintImg = await page.evaluate(() => {
      return document.getElementById('wmRemoverBaseCanvas').toDataURL();
    });

    console.log("Waiting for OpenCV.js to be ready...");
    await page.waitForFunction(() => window.cvReady === true, { timeout: 30000 });
    console.log("OpenCV.js is ready!");

    console.log("Clicking 'Erase Watermark' button...");
    await page.click('#btnEraseWatermark');

    console.log("Waiting for inpainting process to complete...");
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const isHidden = await page.evaluate(() => {
        const overlay = document.getElementById('processingOverlay');
        return overlay ? overlay.classList.contains('hidden') : true;
      });
      if (isHidden) {
        console.log("Inpainting complete!");
        break;
      }
    }

    await new Promise(r => setTimeout(r, 1000));

    const afterInpaintImg = await page.evaluate(() => {
      return document.getElementById('wmRemoverBaseCanvas').toDataURL();
    });

    console.log("Is canvas image data changed after inpaint?", beforeInpaintImg !== afterInpaintImg);

    // Let's test the JPG download bug
    console.log("Selecting JPG export format...");
    await page.select('#exportFormat', 'jpg');

    console.log("Clicking 'Download Image' button...");
    await page.click('#btnDownloadImage');

    console.log("Waiting for download to finish (3 seconds)...");
    await new Promise(r => setTimeout(r, 3000));

    // Find the downloaded file
    const files = fs.readdirSync(downloadPath);
    console.log("Files in scratch directory:", files);
    const downloadedJpg = files.find(f => f.startsWith('sample_processed') && f.endsWith('.jpg'));

    if (downloadedJpg) {
      const filePath = path.join(downloadPath, downloadedJpg);
      const stats = fs.statSync(filePath);
      console.log(`Downloaded JPEG file found: ${downloadedJpg} (${stats.size} bytes)`);
      if (stats.size > 1000) {
        console.log("SUCCESS: JPEG download is not empty.");
      } else {
        console.error("FAIL: JPEG download file size is too small.");
      }
      // Clean up the downloaded file
      fs.unlinkSync(filePath);
    } else {
      console.error("FAIL: No downloaded JPEG file found.");
    }

    // Take a screenshot of the comparison view
    const testScreenshotPath = path.join(__dirname, 'test_inpaint_download_result.png');
    await page.screenshot({ path: testScreenshotPath });
    console.log(`Screenshot saved to ${testScreenshotPath}`);

    await browser.close();
    console.log("Browser closed.");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
})();
