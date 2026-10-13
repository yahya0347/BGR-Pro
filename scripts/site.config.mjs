// The one place the site's public URL is written down.
//
// www is the canonical host: Vercel serves the site on www and 308-redirects
// the apex (bg-eraser-pro.com) to it. Every canonical tag, og:url, og:image,
// sitemap <loc> and the robots.txt Sitemap line must use exactly this origin.
// A canonical that points at a redirecting host keeps Google from indexing
// the page at all.
//
// Used by: generate-tool-pages.mjs, generate-pdf-pages.mjs,
// generate-sitemap.mjs and check-site.mjs (run `npm run check:site` before
// every deploy).
export const SITE = 'https://www.bg-eraser-pro.com';

// Social preview image used for og:image on every page.
export const OG_IMAGE = `${SITE}/icon-512.png`;
