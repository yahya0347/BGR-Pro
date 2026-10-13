// Pre-deploy check: proves nothing has drifted from the canonical host in
// site.config.mjs. Exits non-zero and lists every problem if it has.
//
//   1. No deployed HTML file, sitemap.xml or robots.txt mentions this site
//      on any other host (apex, *.vercel.app, http://).
//   2. Every indexable page has exactly one canonical, equal to its own
//      public URL; og:url equals the canonical; og:image is on the site host.
//   3. sitemap.xml and robots.txt are exactly what generate-sitemap.mjs
//      would write (every indexable page listed once, nothing else).
//   4. The generated pages (3 tool pages, pdf/*.html) are exactly what the
//      generators produce from the current index.html and configs.
//
// Run: node scripts/check-site.mjs      (or: npm run check:site)

import { readFileSync, readdirSync, mkdtempSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { SITE } from './site.config.mjs';
import { sitemapPages, urlFor, buildSitemap, buildRobots } from './generate-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

// ---- 1. foreign hosts ---------------------------------------------------
// Any URL that names this site (by its domain or one of its Vercel projects)
// must start with SITE. Firebase's own project hosts are not the site.
const OURS = /bg-eraser-pro\.com|bgr-pro|bg-eraser-pro[a-z0-9-]*\.vercel\.app|eraserpro\.vercel\.app/i;
const NOT_THE_SITE = /\.firebaseapp\.com|\.web\.app|\.firebasestorage\.app/i;
const pagesIn = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.html')).map((f) => (dir ? `${dir}/${f}` : f));
const deployedHtml = [...pagesIn(''), ...pagesIn('blog'), ...pagesIn('pdf'), ...(existsSync(join(ROOT, 'archive')) ? pagesIn('archive') : [])];

for (const file of [...deployedHtml, 'sitemap.xml', 'robots.txt']) {
  const text = read(file);
  for (const m of text.matchAll(/(?:https?:)?\/\/[^\s"'<>)\\]+/g)) {
    const url = m[0];
    if (!OURS.test(url) || NOT_THE_SITE.test(url)) continue;
    if (url !== SITE && !url.startsWith(SITE + '/')) {
      const line = text.slice(0, m.index).split('\n').length;
      fail(`${file}:${line}`, `site URL on the wrong host: ${url}`);
    }
  }
}

// ---- 2. canonical / og tags --------------------------------------------
const indexable = sitemapPages();
for (const file of indexable) {
  const html = read(file);
  const expected = urlFor(file);
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
  const ogUrls = [...html.matchAll(/<meta property="og:url" content="([^"]*)"/g)].map((m) => m[1]);
  const ogImages = [...html.matchAll(/<meta property="og:image" content="([^"]*)"/g)].map((m) => m[1]);
  if (canonicals.length !== 1) fail(file, `expected exactly one canonical, found ${canonicals.length}`);
  else if (canonicals[0] !== expected) fail(file, `canonical is ${canonicals[0]}, expected ${expected}`);
  if (ogUrls.length !== 1) fail(file, `expected exactly one og:url, found ${ogUrls.length}`);
  else if (ogUrls[0] !== expected) fail(file, `og:url is ${ogUrls[0]}, expected ${expected}`);
  for (const img of ogImages) if (!img.startsWith(SITE + '/')) fail(file, `og:image is not on ${SITE}: ${img}`);
}

// ---- 3. sitemap.xml and robots.txt are current --------------------------
if (read('sitemap.xml') !== buildSitemap()) fail('sitemap.xml', 'out of date -- run: npm run build:sitemap');
if (read('robots.txt') !== buildRobots()) fail('robots.txt', 'Sitemap line out of date -- run: npm run build:sitemap');

// ---- 4. generated pages match their generators --------------------------
const tmp = mkdtempSync(join(tmpdir(), 'check-site-'));
try {
  cpSync(join(ROOT, 'scripts'), join(tmp, 'scripts'), { recursive: true });
  cpSync(join(ROOT, 'index.html'), join(tmp, 'index.html'));
  mkdirSync(join(tmp, 'pdf'));
  for (const gen of ['generate-tool-pages.mjs', 'generate-pdf-pages.mjs']) {
    execFileSync(process.execPath, [join(tmp, 'scripts', gen)], { stdio: 'pipe' });
  }
  const generated = [];
  for (const f of readdirSync(tmp).filter((f) => f.endsWith('.html') && f !== 'index.html')) generated.push(f);
  for (const f of readdirSync(join(tmp, 'pdf'))) generated.push(`pdf/${f}`);
  for (const f of generated) {
    if (!existsSync(join(ROOT, f))) fail(f, 'the generator produces this page but it is not in the repo');
    else if (read(f) !== readFileSync(join(tmp, f), 'utf8')) fail(f, 'differs from generator output -- run: npm run build:pages (do not edit generated pages by hand)');
  }
  for (const f of pagesIn('pdf')) if (!generated.includes(f)) fail(f, 'not produced by generate-pdf-pages.mjs');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`check-site: ${problems.length} problem(s). Canonical host is ${SITE}\n`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`check-site: OK -- ${deployedHtml.length} HTML files, ${indexable.length} sitemap URLs, all on ${SITE}; generated pages match their generators.`);
