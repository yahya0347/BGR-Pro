const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1600, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on('request', req => {
    if (/opencv|pdf\.min|pdf-lib|mammoth|jspdf|firebase|firebasejs/.test(req.url())) return req.abort();
    req.continue();
  });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  // Move the mouse so the dot grid lights up for the screenshot.
  await page.mouse.move(430, 360);
  await new Promise(r => setTimeout(r, 2500));

  await page.screenshot({ path: 'scratch/eraserpro_home.png', fullPage: true });
  console.log('screenshot written');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
