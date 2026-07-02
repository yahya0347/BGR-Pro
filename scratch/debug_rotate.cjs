const puppeteer = require('puppeteer');
const path = require('path');
const SAMPLE = path.resolve('scratch/sample5.pdf');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/pdf/rotate.html', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 800));
  await (await page.$('#pdfFileInput')).uploadFile(SAMPLE);
  await new Promise((r) => setTimeout(r, 500));
  console.log('optAngle present:', await page.$('#optAngle') ? 'yes' : 'no');
  console.log('process btn present:', await page.$('#pdfProcessBtn') ? 'yes' : 'no');
  await page.click('#pdfProcessBtn');
  await new Promise((r) => setTimeout(r, 1500));
  const stageText = await page.$eval('#pdfToolStage', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  console.log('STAGE:', stageText.slice(0, 300));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
