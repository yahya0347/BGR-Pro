const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 2500));

  // Click the eSign tile like a user would.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.click('.pdf-tile[data-pdf-tool="esign"]'),
  ]);
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 1800));
  // sweep cursor for the repel bloom
  await page.mouse.move(200, 300);
  await page.mouse.move(170, 630);
  await page.mouse.move(160, 645);
  await page.screenshot({ path: 'scratch/clicked_esign.png' });

  console.log('landed on:', page.url());
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
