# EraserPro (bg-eraser-pro)

Static site (vanilla JS, no build step) deployed on Vercel, with serverless
functions in `api/`.

## The canonical host is `https://www.bg-eraser-pro.com`

Vercel serves the site on `www` and redirects every other host to it. Every
canonical tag, `og:url`, `og:image`, sitemap `<loc>` and the `Sitemap:` line
in `robots.txt` must use exactly that origin. A canonical that points at a
redirecting host stops Google indexing the page.

The origin is written down once, in `scripts/site.config.mjs`.

**Before every deploy, run:**

```bash
npm run check:site
```

It exits non-zero and lists each problem if any deployed HTML file,
`sitemap.xml` or `robots.txt` names the site on another host, if a page's
canonical or `og:url` is not its own URL, if the sitemap is stale, or if a
generated page no longer matches its generator.

## Which files are generated

| Files | Source of truth | Regenerate with |
|---|---|---|
| `background-remover.html`, `watermark-remover.html`, `watermark-maker.html` | `index.html` + `scripts/generate-tool-pages.mjs` | `npm run build:pages` |
| `pdf/*.html` | `scripts/generate-pdf-pages.mjs` + its two config files | `npm run build:pages` |
| `sitemap.xml`, the `Sitemap:` line of `robots.txt` | the deployed HTML files + git history | `npm run build:sitemap` |

Do not edit generated files by hand: change the generator (or `index.html`)
and regenerate, otherwise the next run silently reverts the edit.

`index.html` and everything in `blog/` are written by hand. They contain the
site URL literally (canonical, `og:url`, `og:image`); `npm run check:site`
is what keeps those honest. New blog posts start from
`blog/post-template.html`.

## Sitemap dates

`<lastmod>` is the date of the last commit that changed a page. For a bulk
edit that is not a content change (metadata, template or host changes across
many pages), put `[no-lastmod]` in the commit message and the sitemap script
will skip that commit.
