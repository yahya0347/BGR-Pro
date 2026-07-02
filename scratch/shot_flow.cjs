const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 4000));

  // 1) Home launcher (no upload UI)
  await page.mouse.move(500, 300);
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'scratch/home_launcher.png', fullPage: true });

  // 2) Secondary per-tool upload screen (Watermark Remover)
  await page.click('.landing-tab-btn[data-landing-tab="wm-remover"]');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'scratch/home_upload_screen.png' });

  console.log('screenshots written');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
