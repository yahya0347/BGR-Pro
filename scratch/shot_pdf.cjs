const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  for (const slug of ['merge', 'jpg-to-pdf', 'protect']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:8123/pdf/${slug}.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
    await new Promise(r => setTimeout(r, 1800));
    // Sweep into an open left-margin area and screenshot mid-motion for the bloom.
    await page.mouse.move(200, 300);
    await page.mouse.move(180, 620);
    await page.mouse.move(160, 640);
    await page.screenshot({ path: `scratch/pdf_${slug}.png` });
    await page.close();
  }
  console.log('screenshots written');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
