const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Block the heavy external CDNs so the page settles (we only need the UI shell).
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    // Block only the heavy/hanging scripts; ALLOW icon + web fonts so the UI
    // renders as it really appears to users.
    if (/opencv|pdf\.min|pdf-lib|mammoth|jspdf|firebase|firebasejs/.test(u)) {
      return req.abort();
    }
    req.continue();
  });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Wait for icon/web fonts to load & apply so Material Symbols ligatures render.
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 2500));

  // Force the editor workspace visible + open the export panel + mark a size,
  // purely for the screenshot (mirrors what a real user flow would show).
  await page.evaluate(() => {
    document.querySelectorAll('.workspace-section').forEach(s => s.classList.remove('active'));
    const ew = document.getElementById('editorWorkspace');
    if (ew) ew.classList.add('active');
    const ul = document.getElementById('uploadLanding');
    if (ul) ul.classList.remove('active');
    const panel = document.getElementById('exportPanel');
    if (panel) panel.classList.remove('hidden');
    const sel = document.querySelector('.quick-size-btn[data-quick-w="1080"]');
    if (sel) sel.classList.add('is-selected');
    // credits badge visible for realism
    const cb = document.getElementById('creditsBadge');
    if (cb) { cb.classList.remove('hidden'); cb.classList.add('flex'); }
  });
  await new Promise(r => setTimeout(r, 700));

  await page.screenshot({ path: 'scratch/eraserpro_redesign.png' });
  console.log('screenshot written');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
