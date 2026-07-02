const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');

const SAMPLE = path.resolve('scratch/sample5.pdf');
const DL = path.resolve('scratch/dl');

const cases = [
  { slug: 'merge',         files: [SAMPLE, SAMPLE], setup: null,                         expect: { type: 'pdf', pages: 10 } },
  { slug: 'split',         files: [SAMPLE],         setup: null,                         expect: { type: 'zip', entries: 5 } },
  { slug: 'rotate',        files: [SAMPLE],         setup: null,                         expect: { type: 'pdf', pages: 5 } },
  { slug: 'delete-pages',  files: [SAMPLE],         setup: { '#optPages': '2' },          expect: { type: 'pdf', pages: 4 } },
  { slug: 'extract-pages', files: [SAMPLE],         setup: { '#optPages': '1-2' },        expect: { type: 'pdf', pages: 2 } },
  { slug: 'reorder',       files: [SAMPLE],         setup: 'reorder',                    expect: { type: 'pdf', pages: 5 } },
  { slug: 'page-numbers',  files: [SAMPLE],         setup: null,                         expect: { type: 'pdf', pages: 5 } },
  { slug: 'crop',          files: [SAMPLE],         setup: { '#optTop': '20' },           expect: { type: 'pdf', pages: 5 } },
  { slug: 'compress',      files: [SAMPLE],         setup: null,                         expect: { type: 'pdf', pages: 5 } },
];

const clean = (d) => { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); };
const waitFile = async (dir, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const f = fs.readdirSync(dir).filter((x) => !x.endsWith('.crdownload'));
    if (f.length) { await new Promise((r) => setTimeout(r, 250)); return path.join(dir, f[0]); }
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
};

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });
  const results = [];
  for (const c of cases) {
    const dir = path.join(DL, c.slug);
    clean(dir);
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    await page.goto(`http://localhost:8123/pdf/${c.slug}.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 800));

    // upload
    const input = await page.$('#pdfFileInput');
    await input.uploadFile(...c.files);
    await new Promise((r) => setTimeout(r, 400));

    // per-tool setup
    if (c.setup === 'reorder') {
      // wait for thumbnails to render
      try { await page.waitForSelector('#pdfToolStage canvas', { timeout: 8000 }); } catch {}
      await new Promise((r) => setTimeout(r, 800));
    } else if (c.setup) {
      for (const [sel, val] of Object.entries(c.setup)) {
        await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, val);
      }
    }

    await page.waitForSelector('#pdfProcessBtn', { timeout: 5000 });
    await page.click('#pdfProcessBtn');

    const file = await waitFile(dir);
    let ok = false, detail = '';
    if (file) {
      const buf = fs.readFileSync(file);
      if (c.expect.type === 'pdf') {
        const isPdf = buf.slice(0, 4).toString() === '%PDF';
        let pages = -1;
        try { pages = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount(); } catch {}
        ok = isPdf && pages === c.expect.pages;
        detail = `pdf=${isPdf} pages=${pages}(want ${c.expect.pages})`;
      } else {
        const isZip = buf.slice(0, 2).toString() === 'PK';
        let entries = -1;
        try { entries = Object.keys((await JSZip.loadAsync(buf)).files).length; } catch {}
        ok = isZip && entries === c.expect.entries;
        detail = `zip=${isZip} entries=${entries}(want ${c.expect.entries})`;
      }
    } else {
      detail = 'NO DOWNLOAD';
    }
    // confirm success UI showed
    const doneShown = await page.$eval('#pdfToolStage', (el) => /Done!/.test(el.textContent)).catch(() => false);
    results.push({ slug: c.slug, PASS: ok && doneShown, detail, doneShown, file: file ? path.basename(file) : null, errs });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  const passed = results.filter((r) => r.PASS).length;
  console.log(`\n${passed}/${results.length} tools passed end-to-end`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
