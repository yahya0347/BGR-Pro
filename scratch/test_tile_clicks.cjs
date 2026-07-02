const puppeteer = require('puppeteer');

// Click a sample across all 4 categories.
const CASES = [
  { slug: 'jpg-to-pdf', label: 'JPG to PDF', expectH1: 'JPG to PDF' },
  { slug: 'pdf-to-jpg', label: 'PDF to JPG', expectH1: 'PDF to JPG' },
  { slug: 'merge',      label: 'Merge',      expectH1: 'Merge PDF' },
  { slug: 'esign',      label: 'eSign',      expectH1: 'eSign PDF' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const results = [];
  for (const c of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

    const sel = `.pdf-tile[data-pdf-tool="${c.slug}"]`;
    const hrefAttr = await page.$eval(sel, el => el.getAttribute('href'));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.click(sel),
    ]);
    const url = page.url();
    const h1 = await page.$eval('h1', el => el.innerText.trim()).catch(() => '(no h1)');
    results.push({
      clicked: c.label,
      hrefAttr,
      landedURL: url,
      h1,
      urlOK: url.endsWith(`/pdf/${c.slug}.html`),
      h1OK: h1 === c.expectH1,
    });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
