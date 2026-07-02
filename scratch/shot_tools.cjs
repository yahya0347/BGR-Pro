const puppeteer = require('puppeteer');
const path = require('path');
const SAMPLE = path.resolve('scratch/sample5.pdf');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });

  // Reorder — thumbnail grid
  let page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/pdf/reorder.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise((r) => setTimeout(r, 800));
  await (await page.$('#pdfFileInput')).uploadFile(SAMPLE);
  await page.waitForSelector('#pdfToolStage canvas', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: 'scratch/tool_reorder.png' });
  await page.close();

  // Merge — file list with reorder arrows
  page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 820, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/pdf/merge.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise((r) => setTimeout(r, 800));
  await (await page.$('#pdfFileInput')).uploadFile(SAMPLE, SAMPLE);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: 'scratch/tool_merge.png' });
  await page.close();

  console.log('screenshots written');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
