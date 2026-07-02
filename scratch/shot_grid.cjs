const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 3000));

  // Spot-check a brand-new tile navigates correctly (Crop).
  const cropHref = await page.$eval('.pdf-tile[data-pdf-tool="crop"]', el => el.getAttribute('href'));

  // Screenshot the PDF Hub section.
  await page.$eval('#pdfHub', el => el.scrollIntoView({ block: 'start' }));
  await page.mouse.move(150, 500);
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'scratch/pdf_hub_grid.png' });

  // Now actually click the new "Repair" tile and confirm landing.
  await page.$eval('#pdfHub', el => el.scrollIntoView({ block: 'start' }));
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.click('.pdf-tile[data-pdf-tool="repair"]'),
  ]);
  const repairURL = page.url();
  const repairH1 = await page.$eval('h1', el => el.innerText.trim()).catch(() => '(none)');

  console.log(JSON.stringify({ cropHref, repairURL, repairH1 }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
