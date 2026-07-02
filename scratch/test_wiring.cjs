const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  // Allow ALL network so app.js's Firebase module import succeeds and its
  // DOMContentLoaded handlers (incl. initUploadHandlers) actually bind.
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Title before
  const before = await page.$eval('#uploadTitle', el => el.innerText);

  // Click the Watermark Remover AI card (existing wiring should update title + active)
  await page.click('.landing-tab-btn[data-landing-tab="wm-remover"]');
  await new Promise(r => setTimeout(r, 300));

  const after = await page.$eval('#uploadTitle', el => el.innerText);
  const activeTab = await page.$eval('.tool-card.active', el => el.getAttribute('data-landing-tab'));

  // PDF tile is a real external link
  const pdfHref = await page.$eval('.pdf-tile[data-pdf-tool="merge"]', el => el.getAttribute('href'));
  const pdfTarget = await page.$eval('.pdf-tile[data-pdf-tool="merge"]', el => el.getAttribute('target'));

  // Navbar real elements still present
  const hasCredits = await page.$('#creditsCount') ? true : false;
  const hasExportBtn = await page.$('#btnOpenExportPanel') ? true : false;

  console.log(JSON.stringify({
    titleBefore: before,
    titleAfter: after,
    titleChanged: before !== after,
    activeTabAfterClick: activeTab,
    pdfHref, pdfTarget,
    navbarCreditsPresent: hasCredits,
    navbarExportBtnPresent: hasExportBtn,
    pageErrors: errors
  }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
