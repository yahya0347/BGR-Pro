const puppeteer = require('puppeteer');

const TOOLS = [
  { slug: 'merge',       name: 'Merge PDF',   note: 'PDF files only, max 10MB per file' },
  { slug: 'jpg-to-pdf',  name: 'JPG to PDF',  note: 'JPG images only, max 10MB per file' },
  { slug: 'protect',     name: 'Protect PDF', note: 'PDF files only, max 10MB per file' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const results = [];
  for (const t of TOOLS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:8123/pdf/${t.slug}.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
    await new Promise(r => setTimeout(r, 1500));

    const title = await page.title();
    const h1 = await page.$eval('h1', el => el.innerText.trim());
    const desc = await page.$eval('h1 + p', el => el.innerText.trim());
    const note = await page.$eval('.gradient-dashed-border p.font-label-md', el => el.innerText.trim());
    const backHref = await page.$eval('main a[href]', el => el.getAttribute('href'));

    // Move mouse to trigger repel + purple; sample canvas pixels
    await page.mouse.move(300, 300);
    await page.mouse.move(640, 450);
    await new Promise(r => setTimeout(r, 500));
    const canvas = await page.evaluate(() => {
      const c = document.getElementById('interactive-grid');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(640 - 80, 450 - 80, 160, 160).data;
      let lit = 0, purple = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i+3] > 0) { lit++; // #630ed4 = (99,14,212): high R+B, very low G
          if (img[i] > 70 && img[i] < 130 && img[i+1] < 60 && img[i+2] > 170) purple++; }
      }
      return { lit, purple };
    });

    // Screenshot only for merge (representative) + jpg-to-pdf to show format-note swap
    if (t.slug === 'merge' || t.slug === 'jpg-to-pdf') {
      await page.screenshot({ path: `scratch/pdf_${t.slug}.png` });
    }

    results.push({
      slug: t.slug,
      title, h1, desc, formatNote: note, backHref,
      titleOK: title === `${t.name} - EraserPro`,
      h1OK: h1 === t.name,
      noteOK: note === t.note,
      canvasLit: canvas.lit, canvasPurple: canvas.purple,
      animationWorks: canvas.lit > 50 && canvas.purple > 0,
      pageErrors: errors,
    });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
