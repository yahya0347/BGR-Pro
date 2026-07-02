const puppeteer = require('puppeteer');

const vis = (page, sel) => page.$eval(sel, el => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
}).catch(() => false);

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000)); // let Firebase + app.js init

  const homeDropzoneVisible = await vis(page, '#dropZone');           // expect false
  const launcherVisible = await vis(page, '#hubLauncher');            // expect true
  const pdfGridVisible = await vis(page, '.hub-pdf');                 // expect true

  // Click Watermark Maker card -> should reveal upload view, scoped
  await page.click('.landing-tab-btn[data-landing-tab="wm-maker"]');
  await new Promise(r => setTimeout(r, 400));
  const afterClick = {
    launcherVisible: await vis(page, '#hubLauncher'),                 // expect false
    uploadViewVisible: await vis(page, '#hubUploadView'),             // expect true
    dropzoneVisible: await vis(page, '#dropZone'),                    // expect true
    scopedTitle: await page.$eval('#uploadTitle', el => el.innerText),// expect "Add Image Watermark"
  };

  // Click Back -> launcher again, no upload UI
  await page.click('#hubBackToTools');
  await new Promise(r => setTimeout(r, 400));
  const afterBack = {
    launcherVisible: await vis(page, '#hubLauncher'),                 // expect true
    uploadViewVisible: await vis(page, '#hubUploadView'),             // expect false
    dropzoneVisible: await vis(page, '#dropZone'),                    // expect false
  };

  console.log(JSON.stringify({
    home: { homeDropzoneVisible, launcherVisible, pdfGridVisible },
    afterClick, afterBack, pageErrors: errors
  }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
