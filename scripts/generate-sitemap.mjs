// Writes sitemap.xml and the Sitemap: line of robots.txt from the HTML files
// that are actually deployed, using the site origin from site.config.mjs.
//
// <lastmod> is the date of the last commit that changed a page's content.
// Commits whose message contains [no-lastmod] are skipped, so bulk metadata
// edits (canonical host changes, template tweaks) do not make every page look
// freshly updated. Put [no-lastmod] in the message of any such commit.
//
// Run: node scripts/generate-sitemap.mjs      (or: npm run build:sitemap)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SITE } from './site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const NO_LASTMOD = '[no-lastmod]';

const htmlIn = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.html')).sort().map((f) => (dir ? `${dir}/${f}` : f));
const isNoindex = (file) => /<meta name="robots" content="[^"]*noindex/.test(readFileSync(join(ROOT, file), 'utf8'));

// The public URL of a deployed file. index.html is served at "/".
export const urlFor = (file) => `${SITE}/${file === 'index.html' ? '' : file}`;

// Every page that should be indexed, in sitemap order.
export function sitemapPages() {
  const root = htmlIn('').filter((f) => !/^google[0-9a-f]+\.html$/.test(f)); // Search Console verification file
  const blog = htmlIn('blog');
  const pages = [
    'index.html',
    ...root.filter((f) => f !== 'index.html'),
    ...blog.filter((f) => f === 'blog/index.html'),
    ...blog.filter((f) => f !== 'blog/index.html'),
    ...htmlIn('pdf'),
  ];
  return pages.filter((f) => !isNoindex(f));
}

export function lastmod(file) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%as', '--fixed-strings', '--invert-grep', `--grep=${NO_LASTMOD}`, '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

export function buildSitemap() {
  const rows = sitemapPages().map((file) => {
    const date = lastmod(file);
    return `  <url><loc>${urlFor(file)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

export const SITEMAP_LINE = `Sitemap: ${SITE}/sitemap.xml`;
export function buildRobots() {
  const robots = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
  return robots.replace(/^Sitemap:.*$/m, SITEMAP_LINE);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const robots = buildRobots();
  const sitemap = buildSitemap();
  writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  writeFileSync(join(ROOT, 'robots.txt'), robots, 'utf8');
  console.log(`Wrote sitemap.xml (${sitemapPages().length} URLs) and robots.txt for ${SITE}`);
}
