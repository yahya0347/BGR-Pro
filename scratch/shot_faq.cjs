const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 3500));

  // Open the 3rd FAQ item and scroll it into view
  await page.click('.faq-item:nth-child(3) .faq-q');
  await new Promise(r => setTimeout(r, 500));
  await page.$eval('.hub-faq', el => el.scrollIntoView({ block: 'start' }));
  // nudge mouse so dot grid blooms in the shot too
  await page.mouse.move(360, 500);
  await new Promise(r => setTimeout(r, 400));

  await page.screenshot({ path: 'scratch/faq_section.png' });
  console.log('screenshot written');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
