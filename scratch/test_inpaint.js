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

    console.log("Clicking the first sample item...");
    await page.click('.sample-item');

    console.log("Waiting 3 seconds for workspace to load...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Clicking Watermark Eraser tab...");
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-tab="wm-remover"]');
      if (btn) btn.click();
    });

    console.log("Waiting 3 seconds for Watermark Eraser to initialize...");
    await new Promise(r => setTimeout(r, 3000));

    // Let's draw a red brush mask on the canvas
    console.log("Simulating brush drawing on canvas...");
    const brushCanvas = await page.$('#wmRemoverBrushCanvas');
    const box = await brushCanvas.boundingBox();
    console.log("Brush canvas bounding box:", box);

    // Click and drag mouse over canvas to draw a thick mask in the center
    const startX = box.x + box.width / 2 - 50;
    const startY = box.y + box.height / 2 - 50;
    const endX = box.x + box.width / 2 + 50;
    const endY = box.y + box.height / 2 + 50;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    console.log("Brushing finished.");

    // Let's capture the canvas state before inpainting
    const beforeInpaintImg = await page.evaluate(() => {
      return document.getElementById('wmRemoverBaseCanvas').toDataURL();
    });

    console.log("Clicking 'Erase Watermark' button...");
    await page.click('#btnEraseWatermark');

    console.log("Waiting for inpainting process to complete...");
    // The loader overlay class list will have "hidden" when done, check every 500ms
    for (let i = 0; i < 30; i++) {
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

    // Let's wait another 1 second to let onload images render
    await new Promise(r => setTimeout(r, 1000));

    // Check canvas status and compareImg source
    const results = await page.evaluate(() => {
      const baseCanvas = document.getElementById('wmRemoverBaseCanvas');
      const compareImg = document.getElementById('wmRemoverCompareImg');
      const slider = document.getElementById('wmComparisonSlider');
      return {
        baseCanvasData: baseCanvas.toDataURL(),
        compareImgSrc: compareImg ? compareImg.src : null,
        compareImgDisplay: compareImg ? compareImg.style.display : null,
        sliderDisplay: slider ? slider.style.display : null,
        sliderPercent: window.state ? window.state.wmSliderPercent : null,
        sliderLeft: slider ? slider.style.left : null,
        clipPath: compareImg ? compareImg.style.clipPath : null
      };
    });

    console.log("Compare image source matched original?", results.compareImgSrc.startsWith('data:image'));
    console.log("Compare image display style:", results.compareImgDisplay);
    console.log("Slider display style:", results.sliderDisplay);
    console.log("Slider left style:", results.sliderLeft);
    console.log("Compare image clipPath:", results.clipPath);
    console.log("Is canvas image data changed after inpaint?", beforeInpaintImg !== results.baseCanvasData);

    // Take screenshot of Slider comparison view
    const testScreenshotPath = path.join(__dirname, 'test_inpaint_result.png');
    await page.screenshot({ path: testScreenshotPath });
    console.log(`Screenshot saved to ${testScreenshotPath}`);

    await browser.close();
    console.log("Browser closed.");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
})();
