// Generates one static PDF tool page per entry in pdf-tools.config.mjs.
// Run: node scripts/generate-pdf-pages.mjs
// Output: pdf/<slug>.html  (each uses the shared /dot-grid.js background animation)
//
// The template below is the single reusable "component"; it accepts a tool's
// name, description, formatNote, icon and accept list. Only those swap per page.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pdfTools } from './pdf-tools.config.mjs';
import { SEO } from './pdf-seo.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'pdf');
const SITE = 'https://bgr-pro.vercel.app';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── SEO block builders (bottom educational content) ───────────────────────
function headSeo(seo, slug) {
  const url = `${SITE}/pdf/${slug}.html`;
  const howto = {
    '@context': 'https://schema.org', '@type': 'HowTo',
    name: seo.title.replace(/\s*[—-]\s*EraserPro$/, ''), description: seo.desc,
    step: seo.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: seo.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.desc)}"/>`,
    `<meta name="keywords" content="${esc(seo.keywords)}"/>`,
    `<link rel="canonical" href="${url}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:title" content="${esc(seo.title)}"/>`,
    `<meta property="og:description" content="${esc(seo.desc)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<script type="application/ld+json">${JSON.stringify(howto)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(faq)}</script>`,
  ].join('\n');
}

function stepsHtml(seo) {
  return seo.steps.map((s, i) => `
<div class="glass-panel rounded-xl p-lg flex flex-col items-center text-center group hover:-translate-y-1 transition-transform duration-300">
<div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-md group-hover:bg-primary/20 transition-colors">
<span class="material-symbols-outlined text-[32px] brand-gradient-icon" style="font-variation-settings:'FILL' 1;">${esc(s.icon)}</span>
</div>
<h3 class="font-headline-sm text-headline-sm text-on-surface mb-sm flex items-center gap-sm"><span class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md">${i + 1}</span>${esc(s.name)}</h3>
<p class="font-body-md text-body-md text-on-surface-variant">${esc(s.text)}</p>
</div>`).join('');
}

function benefitsHtml(seo) {
  const secure = seo.cs
    ? { icon: 'verified_user', title: 'Private & Secure', text: `Everything runs in your browser — files are never uploaded, so your data never leaves your device.`, fill: true }
    : { icon: 'lock', title: 'Secure Processing', text: `Files are sent over an encrypted connection to convert, then deleted automatically right after processing.`, fill: true };
  const items = [
    { icon: 'money_off', title: '100% Free', text: `${cap(seo.action)} without paying a cent — no watermarks and no forced sign-up.` },
    secure,
    { icon: 'cloud_off', title: 'No Installation', text: `Works right in your web browser — there's nothing to download or install.` },
    { icon: 'devices', title: 'Any Device', text: `Use it on Windows, macOS, Linux, iOS or Android — the experience is seamless everywhere.` },
  ];
  return items.map((it) => `
<div class="glass-panel p-md rounded-lg flex items-start gap-md">
<span class="material-symbols-outlined brand-gradient-icon mt-xs"${it.fill ? ` style="font-variation-settings:'FILL' 1;"` : ''}>${it.icon}</span>
<div><h3 class="font-headline-sm text-headline-sm text-on-surface mb-xs">${esc(it.title)}</h3><p class="font-body-md text-body-md text-on-surface-variant">${esc(it.text)}</p></div>
</div>`).join('');
}

function faqHtml(seo) {
  return seo.faqs.map((f) => `
<details class="glass-panel rounded-lg group" name="seo-faq">
<summary class="flex justify-between items-center p-md cursor-pointer hover:bg-surface-container-low/50 transition-colors rounded-lg gap-md">
<h3 class="font-headline-sm text-headline-sm text-on-surface m-0">${esc(f.q)}</h3>
<span class="material-symbols-outlined text-outline shrink-0 transition-transform duration-300 group-open:rotate-180">expand_more</span>
</summary>
<div class="p-md pt-0 font-body-md text-body-md text-on-surface-variant">${esc(f.a)}</div>
</details>`).join('');
}

// Unique, on-brand inline-SVG illustration per tool (purple→pink gradient).
function illoSvg(illo, alt) {
  const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#630ed4"/><stop offset="1" stop-color="#b4136d"/></linearGradient></defs>`;
  const wrap = (inner) => `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" class="w-full h-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(alt)}"><title>${esc(alt)}</title><rect width="400" height="300" fill="#f6f2fc"/>${defs}${inner}</svg>`;
  const doc = (x, y, w, h, label) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="url(#bg)" stroke-width="3"/>${label ? `<text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" font-family="Geist,sans-serif" font-weight="800" font-size="22" fill="url(#bg)">${label}</text>` : ''}`;
  const arrow = (x1, x2, y) => `<path d="M${x1} ${y} H${x2}" stroke="url(#bg)" stroke-width="5" stroke-linecap="round"/><path d="M${x2 - 14} ${y - 12} L${x2} ${y} L${x2 - 14} ${y + 12}" fill="none" stroke="url(#bg)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (illo.t === 'conv') return wrap(`${doc(58, 80, 110, 140, illo.a)}${arrow(184, 236, 150)}${doc(252, 80, 110, 140, illo.b)}`);
  if (illo.t === 'merge') return wrap(`${doc(48, 68, 92, 128)}${doc(92, 96, 92, 128)}${arrow(200, 252, 150)}${doc(268, 80, 92, 140, 'PDF')}`);
  if (illo.t === 'split') return wrap(`${doc(44, 80, 92, 140, 'PDF')}${arrow(150, 202, 150)}${doc(228, 58, 92, 118)}${doc(228, 150, 92, 118)}`);
  const badge = (inner) => `<rect x="120" y="50" width="160" height="200" rx="20" fill="url(#bg)"/>${inner}`;
  const G = { fill: '#fff', stroke: '#fff' };
  const glyph = {
    compress: `<path d="M200 92 V126 M188 114 l12 12 l12 -12 M200 208 V174 M188 186 l12 -12 l12 12" stroke="${G.stroke}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="160" y="146" width="80" height="8" rx="4" fill="#fff" opacity=".6"/>`,
    rotate: `<path d="M232 150 a32 32 0 1 1 -10 -23" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M222 108 l4 24 l-24 -2" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    delete: `<path d="M172 122 h56 M184 122 v-8 h32 v8 M180 122 l5 74 h30 l5 -74" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M192 138 v42 M208 138 v42" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
    extract: `<rect x="168" y="132" width="64" height="80" rx="8" fill="none" stroke="#fff" stroke-width="6"/><path d="M200 120 V84 M184 100 l16 -16 l16 16" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
    reorder: `<rect x="158" y="108" width="84" height="14" rx="5" fill="#fff"/><rect x="158" y="143" width="84" height="14" rx="5" fill="#fff"/><rect x="158" y="178" width="84" height="14" rx="5" fill="#fff"/><path d="M148 128 l0 -18 m-7 7 l7 -7 l7 7" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M252 172 l0 18 m-7 -7 l7 7 l7 -7" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    numbers: `<text x="200" y="166" text-anchor="middle" font-family="Geist,sans-serif" font-weight="800" font-size="46" fill="#fff">1 2 3</text>`,
    crop: `<path d="M170 128 v52 h52 M230 172 v-52 h-52" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M158 145 h84 M200 104 v92" stroke="#fff" stroke-width="3" opacity=".55"/>`,
    lock: `<rect x="166" y="150" width="68" height="54" rx="9" fill="#fff"/><path d="M178 150 v-14 a22 22 0 0 1 44 0 v14" fill="none" stroke="#fff" stroke-width="8"/><circle cx="200" cy="172" r="7" fill="url(#bg)"/><rect x="197" y="176" width="6" height="15" rx="3" fill="url(#bg)"/>`,
    unlock: `<rect x="166" y="150" width="68" height="54" rx="9" fill="#fff"/><path d="M178 150 v-14 a22 22 0 0 1 40 -9" fill="none" stroke="#fff" stroke-width="8"/><circle cx="200" cy="172" r="7" fill="url(#bg)"/><rect x="197" y="176" width="6" height="15" rx="3" fill="url(#bg)"/>`,
    sign: `<path d="M158 178 q14 -40 28 -6 t26 -14 q10 -18 20 4" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M152 196 h96" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
    watermark: `<rect x="150" y="108" width="100" height="84" rx="8" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/><text x="200" y="162" text-anchor="middle" font-family="Geist,sans-serif" font-weight="800" font-size="34" fill="#fff" opacity=".6" transform="rotate(-20 200 150)">WM</text>`,
    redact: `<rect x="150" y="110" width="100" height="15" rx="4" fill="#fff"/><rect x="150" y="142" width="72" height="15" rx="4" fill="#191c1d"/><rect x="150" y="174" width="92" height="15" rx="4" fill="#fff"/>`,
    flatten: `<rect x="158" y="106" width="84" height="18" rx="5" fill="#fff" opacity=".45"/><rect x="158" y="130" width="84" height="18" rx="5" fill="#fff" opacity=".7"/><rect x="158" y="162" width="84" height="26" rx="5" fill="#fff"/><path d="M200 94 v10 M192 98 l8 6 l8 -6" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    repair: `<g transform="rotate(45 200 150)"><rect x="192" y="120" width="16" height="72" rx="8" fill="#fff"/><circle cx="200" cy="118" r="15" fill="none" stroke="#fff" stroke-width="11"/></g>`,
  };
  return wrap(badge(glyph[illo.s] || ''));
}

// The Gemini watermark (bottom-right, fixed pixel position on every source
// image) is removed by pre-cropping the bottom ~16% of each JPG at image-
// processing time (see scripts/optimize-hero-images.py) -- NOT via CSS. That
// keeps the CSS itself simple and the composition symmetric: object-fit:cover
// + object-position:center crops left/right equally, so the subject stays
// centered instead of being pulled toward one corner.
function heroImg(slug, seo) {
  return `<img src="/pdf-hub-images/${slug}.jpg" alt="${esc(seo.illoAlt)}" loading="lazy" width="1500" height="703"/>`;
}

function seoBlock(seo, slug) {
  return `
<!-- ===== SEO educational content (bottom of page) ===== -->
<section class="w-full max-w-7xl mx-auto px-lg pb-xl flex flex-col gap-xl lg:gap-[64px] relative z-10">
<div class="text-center max-w-3xl mx-auto pt-xl">
<h2 class="font-headline-lg text-headline-lg md:font-display-lg md:text-display-lg text-on-surface mb-md">How to <span class="brand-gradient-text">${esc(seo.kw)}</span> Online</h2>
<p class="font-body-lg text-body-lg text-on-surface-variant">${seo.intro}</p>
</div>
<div class="w-full">
<div class="text-center mb-xl"><h2 class="font-headline-lg text-headline-lg text-on-surface">${esc(seo.kw)} in 3 Easy Steps</h2></div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-lg">${stepsHtml(seo)}</div>
</div>
<div class="w-full flex flex-col lg:flex-row gap-xl items-center lg:items-stretch">
<div class="w-full lg:w-1/2"><div class="hero-illustration-container w-full lg:h-full">${heroImg(slug, seo)}</div></div>
<div class="w-full lg:w-1/2 flex flex-col lg:justify-center">
<h2 class="font-headline-lg text-headline-lg text-on-surface mb-lg">Why use EraserPro to ${esc(seo.action)}</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-md">${benefitsHtml(seo)}</div>
</div>
</div>
<div class="w-full max-w-3xl mx-auto">
<h2 class="font-headline-lg text-headline-lg text-on-surface text-center mb-lg">Frequently Asked Questions</h2>
<div class="flex flex-col gap-sm">${faqHtml(seo)}</div>
</div>
</section>
<footer class="w-full py-xl px-lg flex flex-col sm:flex-row gap-md justify-between items-center max-w-7xl mx-auto border-t border-outline-variant/20 relative z-10">
<a href="/" class="font-headline-sm text-headline-sm text-primary">EraserPro</a>
<div class="text-on-surface-variant opacity-70 font-label-md text-label-md">© 2026 EraserPro AI. All rights reserved.</div>
<div class="flex gap-lg"><a class="text-on-surface-variant opacity-70 font-label-md text-label-md hover:text-primary transition-colors" href="/">Home</a><a class="text-on-surface-variant opacity-70 font-label-md text-label-md hover:text-primary transition-colors" href="/#pdfHub">PDF Hub</a></div>
</footer>`;
}

// Office-format conversions need a backend (Phase 3) — those stay UI shells.
// Everything else is client-side functional (Phase 1 + Phase 2 + protect/unlock).
const OFFICE = new Set(['word-to-pdf', 'ppt-to-pdf', 'excel-to-pdf', 'pdf-to-word', 'pdf-to-ppt', 'pdf-to-excel']);
const MULTIPLE = new Set(['merge', 'jpg-to-pdf', 'png-to-pdf']);
const NEEDS_PDFJS = new Set(['reorder', 'pdf-to-jpg', 'pdf-to-png', 'pdf-to-text', 'pdf-to-html', 'redact']);
const NEEDS_TESSERACT = new Set(['pdf-to-text']);
const NEEDS_HTML2PDF = new Set(['html-to-pdf']);
const NEEDS_QPDF = new Set(['protect', 'unlock']);

const PDFJS_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>\n<script>if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";</script>';
const TESSERACT_TAG = '<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>';
const HTML2PDF_TAG = '<script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js"></script>';
const QPDF_TAG = '<script type="module">import createModule from "https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm/+esm";window.__createQpdf=createModule;window.dispatchEvent(new Event("qpdf-lib-ready"));</script>';
// Office pages call the CloudConvert-backed /api/convert; they need Firebase
// (compat) to obtain the signed-in user's ID token for the credit check.
const FIREBASE_TAGS = '<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>';

function renderPage({ slug, name, description, formatNote, icon, accept }) {
  const seo = SEO[slug];
  const multipleAttr = MULTIPLE.has(slug) ? ' multiple' : '';
  const scripts = OFFICE.has(slug)
    ? [FIREBASE_TAGS, '<script src="pdf-convert.js"></script>'].join('\n')
    : [
        '<script src="vendor/pdf-lib.min.js"></script>',
        '<script src="vendor/jszip.min.js"></script>',
        NEEDS_PDFJS.has(slug) ? PDFJS_TAG : '',
        NEEDS_TESSERACT.has(slug) ? TESSERACT_TAG : '',
        NEEDS_HTML2PDF.has(slug) ? HTML2PDF_TAG : '',
        NEEDS_QPDF.has(slug) ? QPDF_TAG : '',
        '<script src="pdf-tools.js"></script>',
      ].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
${headSeo(seo, slug)}
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "tertiary-container": "#905b00",
                      "on-surface-variant": "#4a4455",
                      "on-secondary": "#ffffff",
                      "surface-tint": "#732ee4",
                      "on-primary-fixed-variant": "#5a00c6",
                      "on-error": "#ffffff",
                      "surface-container": "#edeeef",
                      "on-primary-container": "#ede0ff",
                      "secondary-fixed-dim": "#ffb0cd",
                      "surface-container-lowest": "#ffffff",
                      "on-background": "#191c1d",
                      "inverse-primary": "#d2bbff",
                      "outline-variant": "#ccc3d8",
                      "tertiary": "#704500",
                      "on-secondary-fixed-variant": "#8c0053",
                      "secondary-fixed": "#ffd9e4",
                      "inverse-on-surface": "#f0f1f2",
                      "on-primary-fixed": "#25005a",
                      "on-primary": "#ffffff",
                      "surface-container-low": "#f3f4f5",
                      "secondary-container": "#fd56a7",
                      "outline": "#7b7487",
                      "primary": "#630ed4",
                      "primary-fixed": "#eaddff",
                      "on-tertiary-container": "#ffe1c0",
                      "surface-container-highest": "#e1e3e4",
                      "primary-fixed-dim": "#d2bbff",
                      "on-tertiary-fixed": "#2a1700",
                      "on-secondary-fixed": "#3e0022",
                      "on-error-container": "#93000a",
                      "on-tertiary": "#ffffff",
                      "error-container": "#ffdad6",
                      "surface-dim": "#d9dadb",
                      "surface-variant": "#e1e3e4",
                      "on-tertiary-fixed-variant": "#653e00",
                      "tertiary-fixed": "#ffddb8",
                      "secondary": "#b4136d",
                      "error": "#ba1a1a",
                      "on-secondary-container": "#600037",
                      "background": "#f8f9fa",
                      "surface": "#f8f9fa",
                      "primary-container": "#7c3aed",
                      "on-surface": "#191c1d",
                      "tertiary-fixed-dim": "#ffb95f",
                      "surface-bright": "#f8f9fa",
                      "surface-container-high": "#e7e8e9",
                      "inverse-surface": "#2e3132"
              },
              "borderRadius": { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
              "spacing": { "lg": "24px", "xl": "32px", "gutter": "16px", "xs": "4px", "container-margin": "24px", "base": "4px", "sm": "8px", "md": "16px" },
              "fontFamily": {
                      "headline-sm": ["Geist"], "headline-md": ["Geist"], "headline-lg": ["Geist"],
                      "body-lg": ["Geist"], "headline-lg-mobile": ["Geist"], "body-md": ["Geist"],
                      "label-md": ["Geist"], "display-lg": ["Geist"]
              },
              "fontSize": {
                      "headline-sm": ["20px", { "lineHeight": "1.4", "fontWeight": "600" }],
                      "headline-md": ["24px", { "lineHeight": "1.3", "fontWeight": "700" }],
                      "headline-lg": ["32px", { "lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "700" }],
                      "body-lg": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
                      "headline-lg-mobile": ["28px", { "lineHeight": "1.2", "fontWeight": "700" }],
                      "body-md": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
                      "label-md": ["12px", { "lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "600" }],
                      "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "800" }]
              }
      },
          },
        }
    </script>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body { font-family: 'Geist', sans-serif; }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined'; }

        #interactive-grid {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: -1;
            background-color: #f8f9fa;
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0px 4px 20px rgba(0,0,0,0.05);
        }

        .gradient-dashed-border {
            position: relative;
            background: #ffffff;
            background-clip: padding-box;
            border: 2px dashed transparent;
            border-radius: 16px;
        }
        .gradient-dashed-border::before {
            content: '';
            position: absolute;
            top: -2px; bottom: -2px;
            left: -2px; right: -2px;
            background: linear-gradient(to right, #630ed4, #b4136d);
            z-index: -1;
            border-radius: 18px;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            padding: 2px;
        }

        /* SEO educational block */
        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0px 4px 20px rgba(0,0,0,0.05);
        }
        .brand-gradient-text, .brand-gradient-icon {
            background: linear-gradient(135deg, #630ed4, #b4136d);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
        }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] summary ~ * { animation: sweep .3s ease-in-out; }

        /* Hero illustration: watermark is pre-cropped out of the JPG itself
           (see scripts/optimize-hero-images.py), so this stays a plain,
           centered cover-crop with no transform hacks and no gap/border. */
        .hero-illustration-container {
            padding: 0;
            margin: 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            aspect-ratio: 16 / 9;
            border-radius: 0.75rem;
            background: #f6f2fc;
        }
        .hero-illustration-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block;
            margin: 0;
            padding: 0;
        }
        @keyframes sweep { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }

        /* ---- Mobile chrome: hamburger + drawer + bottom nav (<768px) ---- */
        .mobile-menu-btn {
            display: none; width: 40px; height: 40px; align-items: center; justify-content: center;
            border-radius: 50%; border: 1px solid rgba(24,19,31,0.08); background: #fff; color: #191c1d;
            flex-shrink: 0; cursor: pointer;
        }
        .mobile-drawer-scrim { display: none; position: fixed; inset: 0; background: rgba(24,19,31,0.45); z-index: 90; opacity: 0; transition: opacity .25s ease; }
        .mobile-drawer-scrim.open { display: block; opacity: 1; }
        .mobile-drawer {
            position: fixed; top: 0; left: 0; bottom: 0; width: min(300px, 84vw); background: #fff; z-index: 100;
            box-shadow: 0 16px 40px rgba(24,19,31,0.12); transform: translateX(-100%); transition: transform .3s cubic-bezier(.16,1,.3,1);
            display: flex; flex-direction: column; padding: 20px 0; padding-top: calc(20px + env(safe-area-inset-top)); overflow-y: auto;
        }
        .mobile-drawer.open { transform: translateX(0); }
        .mobile-drawer-head { display:flex; align-items:center; justify-content:space-between; padding:0 20px 16px; margin-bottom:8px; border-bottom:1px solid rgba(24,19,31,0.08); }
        .mobile-drawer-close { width:44px; height:44px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:none; background:transparent; color:#4a4455; cursor:pointer; }
        .mobile-drawer-links { display:flex; flex-direction:column; gap:2px; padding:8px 12px; }
        .mobile-drawer-links a { display:flex; align-items:center; gap:14px; padding:13px 12px; min-height:44px; border-radius:12px; color:#191c1d; font-weight:600; font-size:0.95rem; text-decoration:none; }
        .mobile-drawer-links a:hover, .mobile-drawer-links a:active { background:#f3f4f5; }
        .mobile-drawer-links a .material-symbols-outlined { color: #630ed4; font-size: 22px; }
        body.mobile-drawer-locked { overflow: hidden; }

        .mobile-bottom-nav { display: none; }

        @media (max-width: 767px) {
            .mobile-menu-btn { display: flex; }
            .nav-brand-group { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
            .desktop-only-action { display: none !important; }
            .credits-pill { display: flex !important; padding: 6px 10px !important; }
            .credits-pill span:last-child { font-size: 0.72rem; }

            .mobile-bottom-nav {
                display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 80;
                background: rgba(255,255,255,0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border-top: 1px solid rgba(24,19,31,0.08); padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
                justify-content: space-around; align-items: stretch;
            }
            .mobile-bottom-nav a { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; flex:1; min-height:44px; padding:4px 2px; border-radius:12px; color:#7b7487; text-decoration:none; font-size:0.65rem; font-weight:600; }
            .mobile-bottom-nav a .material-symbols-outlined { font-size: 22px; }
            .mobile-bottom-nav a.active { color: #630ed4; }

            main { padding-bottom: 88px !important; }

            /* 16px horizontal screen padding + full-width CTA on small phones */
            main.pt-32 { padding-left: 16px !important; padding-right: 16px !important; }
            #pdfDropzone .inline-flex { width: 100%; justify-content: center; }
            #pdfProcessBtn { width: 100%; justify-content: center; min-height: 48px; }
        }
        @media (min-width: 768px) {
            .mobile-drawer, .mobile-drawer-scrim, .mobile-bottom-nav { display: none !important; }
        }
    </style>
</head>
<body class="bg-surface text-on-surface min-h-screen relative overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container" data-tool="${esc(slug)}">
<!-- Interactive Background Canvas -->
<canvas id="interactive-grid" data-dot-grid></canvas>
<!-- TopNavBar -->
<header class="fixed top-0 w-full z-50 bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] transition-all duration-300">
<div class="flex justify-between items-center h-16 px-6 max-w-[1440px] mx-auto relative">
<button id="mobileMenuBtn" class="mobile-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobileDrawer"><span class="material-symbols-outlined">menu</span></button>
<a class="flex items-center gap-2 cursor-pointer hover:scale-95 transition-transform duration-200 nav-brand-group" href="../index.html">
<span class="font-headline-md text-headline-md font-bold tracking-tight text-primary dark:text-primary-fixed">EraserPro</span>
</a>
<nav class="hidden md:flex items-center gap-8"></nav>
<div class="flex items-center gap-4 nav-actions-group">
<div class="hidden sm:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/30 hover:bg-surface-container-high/50 transition-all duration-300 cursor-pointer credits-pill">
<span class="material-symbols-outlined text-[18px] text-tertiary-container" style="font-variation-settings: 'FILL' 1;">stars</span>
<span class="font-label-md text-label-md text-on-surface-variant">3 Credits</span>
</div>
<div class="h-6 w-px bg-outline-variant/50 hidden sm:block desktop-only-action"></div>
<button class="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-full font-label-md text-label-md flex items-center gap-2 hover:scale-95 transition-transform duration-200 shadow-sm desktop-only-action">
<span class="material-symbols-outlined text-[16px]">download</span>
                    Export
                </button>
<div class="bg-gradient-to-r from-tertiary-fixed to-tertiary-fixed-dim text-on-tertiary-fixed-variant px-3 py-1 rounded-full font-label-md text-[10px] tracking-wider font-bold shadow-sm hidden md:block border border-tertiary-container/20">
                    PRO ACTIVE
                </div>
<a class="hidden lg:block font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors" href="#">Manage</a>
<button id="btnHeaderAuth" class="w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant/30 hover:ring-2 hover:ring-primary/50 transition-all flex items-center justify-center shrink-0 ml-2 text-on-surface-variant desktop-only-action">
<span class="material-symbols-outlined text-[20px]">account_circle</span>
</button>
</div>
</div>
</header>

<!-- Mobile drawer + scrim + bottom nav (shared behaviour via /mobile-nav.js) -->
<div id="mobileDrawerScrim" class="mobile-drawer-scrim"></div>
<aside id="mobileDrawer" class="mobile-drawer" aria-hidden="true">
<div class="mobile-drawer-head">
<span class="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2">EraserPro</span>
<button id="mobileDrawerClose" class="mobile-drawer-close" aria-label="Close menu"><span class="material-symbols-outlined">close</span></button>
</div>
<nav class="mobile-drawer-links">
<a href="../index.html"><span class="material-symbols-outlined">home</span>Home</a>
<a href="../index.html#pdfHub"><span class="material-symbols-outlined">picture_as_pdf</span>PDF Hub</a>
<a href="javascript:void(0)" onclick="document.querySelector('.nav-actions-group button.bg-primary')?.click()"><span class="material-symbols-outlined">ios_share</span>Export</a>
<a href="javascript:void(0)" onclick="document.getElementById('btnHeaderAuth')?.click()"><span class="material-symbols-outlined">account_circle</span>Account</a>
</nav>
</aside>
<nav class="mobile-bottom-nav" aria-label="Primary">
<a data-nav="home" href="../index.html"><span class="material-symbols-outlined">home</span><span>Home</span></a>
<a data-nav="pdf-hub" href="../index.html#pdfHub"><span class="material-symbols-outlined">picture_as_pdf</span><span>PDF Hub</span></a>
<a data-nav="workspace" href="../index.html"><span class="material-symbols-outlined">work</span><span>Workspace</span></a>
<a data-nav="account" href="javascript:void(0)" onclick="document.getElementById('btnHeaderAuth')?.click()"><span class="material-symbols-outlined">account_circle</span><span>Account</span></a>
</nav>
<!-- Main Content Container -->
<main class="pt-32 pb-16 px-6 max-w-[800px] mx-auto min-h-screen flex flex-col items-center justify-center relative z-10">
<!-- Back Navigation -->
<div class="w-full mb-8">
<a class="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-body-md text-body-md transition-colors group" href="../index.html">
<span class="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                PDF Hub
            </a>
</div>
<!-- Page Header -->
<div class="w-full text-center mb-10 flex flex-col items-center">
<div class="w-14 h-14 rounded-full bg-primary-container/15 flex items-center justify-center mb-5 border border-primary-container/25 shadow-sm">
<span class="material-symbols-outlined text-[28px] text-primary" style="font-variation-settings: 'FILL' 1;">${esc(icon)}</span>
</div>
<h1 class="font-headline-lg text-headline-lg md:font-display-lg md:text-display-lg text-on-surface mb-4">${esc(name)}</h1>
<p class="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">${esc(description)}</p>
</div>
<!-- Dropzone Component -->
<div class="w-full relative group" id="pdfDropWrap">
<div class="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[20px] blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
<div class="glass-card w-full rounded-xl p-2 relative transition-all duration-300 hover:-translate-y-1">
<label id="pdfDropzone" class="gradient-dashed-border w-full flex flex-col items-center justify-center py-20 px-6 text-center cursor-pointer hover:bg-surface-container-low/30 transition-colors duration-300 h-[320px]">
<div class="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center mb-6 shadow-sm border border-primary-container/30">
<span class="material-symbols-outlined text-[32px] text-primary">cloud_upload</span>
</div>
<h3 class="font-headline-sm text-headline-sm text-on-surface mb-2">Drag and drop files here</h3>
<p class="font-body-md text-body-md text-on-surface-variant mb-8">or click to select files</p>
<span class="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-on-primary px-6 py-3 rounded-full font-label-md text-label-md shadow-md transition-all duration-300 hover:scale-105 active:scale-95 inline-flex items-center gap-2">
                        Browse Files
                    </span>
<p class="font-label-md text-[11px] text-outline mt-6 flex items-center gap-1 opacity-70">
<span class="material-symbols-outlined text-[14px]">info</span>
                        ${esc(formatNote)}
                    </p>
<input id="pdfFileInput" type="file" class="hidden" accept="${esc(accept)}"${multipleAttr}/>
</label>
</div>
</div>
<!-- Processing / options / result render here (pdf-tools.js) -->
<div id="pdfToolStage" class="w-full mt-8"></div>
</main>
${seoBlock(seo, slug)}
${scripts}
<script src="/dot-grid.js"></script>
<script src="/mobile-nav.js"></script>
</body></html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const tool of pdfTools) {
  const html = renderPage(tool);
  writeFileSync(join(OUT_DIR, `${tool.slug}.html`), html, 'utf8');
  count++;
}
console.log(`Generated ${count} PDF tool pages into pdf/`);
