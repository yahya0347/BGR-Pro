const puppeteer = require('puppeteer');

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
  await new Promise(r => setTimeout(r, 4000));

  // (3) AI tools + PDF Hub unchanged
  const aiCards = await page.$$eval('#toolPicker .landing-tab-btn', els => els.map(e => e.getAttribute('data-landing-tab')));
  const pdfTiles = await page.$$eval('.hub-pdf .pdf-tile', els => els.length);

  // FAQ present, correct count + heading hierarchy
  const faqCount = await page.$$eval('.faq-item', els => els.length);
  const h2 = await page.$eval('#faqHeading', el => el.tagName + ':' + el.innerText);
  const h3sAreH3 = await page.$$eval('.faq-question-text', els => els.every(e => e.tagName === 'H3'));

  // (1) Canvas animation: move mouse, sample pixels for purple bloom
  await page.mouse.move(300, 300);
  await page.mouse.move(320, 640);
  await new Promise(r => setTimeout(r, 400));
  const canvasSample = await page.evaluate(() => {
    const c = document.getElementById('homeHubCanvas');
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(320 - 60, 640 - 60, 120, 120).data;
    let lit = 0, maxPurple = 0;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] > 0) { lit++; if (img[i+2] > 200 && img[i+1] < 160) maxPurple = Math.max(maxPurple, img[i+2] - img[i+1]); }
    }
    return { lit, maxPurple };
  });

  // (2) Accordion: measure answer height closed -> open -> (open other) collapses first
  const item1 = '.faq-item:nth-child(1)';
  const item2 = '.faq-item:nth-child(2)';
  const h = async (sel) => page.$eval(sel + ' .faq-a-clip', el => el.getBoundingClientRect().height);

  const a1Closed = await h(item1);
  await page.click(item1 + ' .faq-q');
  await new Promise(r => setTimeout(r, 450));
  const a1Open = await h(item1);
  const chevronRotated = await page.$eval(item1 + ' .faq-chevron', el => getComputedStyle(el).transform !== 'none');
  const item1Expanded = await page.$eval(item1 + ' .faq-q', el => el.getAttribute('aria-expanded'));

  // Open item 2 -> item 1 should collapse (single-open)
  await page.click(item2 + ' .faq-q');
  await new Promise(r => setTimeout(r, 450));
  const a1AfterOpen2 = await h(item1);
  const a2Open = await h(item2);

  console.log(JSON.stringify({
    unchanged: { aiCards, pdfTiles },
    faq: { faqCount, h2, allQuestionsAreH3: h3sAreH3 },
    canvasAnimation: canvasSample,
    accordion: {
      answer1_closed_h: Math.round(a1Closed),
      answer1_open_h: Math.round(a1Open),
      chevronRotated, item1Expanded,
      answer1_after_opening_item2_h: Math.round(a1AfterOpen2),
      answer2_open_h: Math.round(a2Open)
    },
    pageErrors: errors
  }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
