// Generates 3 dedicated, SEO-optimized pages for the AI tools that otherwise
// only exist as tabs inside index.html's single-page editor:
//   background-remover.html, watermark-remover.html, watermark-maker.html
//
// Same precedent as scripts/generate-pdf-pages.mjs, but instead of building
// each page from a template function, this one takes index.html's OWN raw
// HTML as the base and does targeted string surgery:
//   - unique <title>/meta description/OG tags/canonical link
//   - unique FAQPage + HowTo JSON-LD (replaces the sitewide FAQ schema)
//   - the matching tool pre-selected (hubLauncher hidden, hubUploadView shown,
//     correct tool card marked active) so the page opens straight into that
//     tool's upload screen -- no tool logic duplicated, just a different
//     initial DOM state for markup app.js/home-hub.js already drive
//   - one small inline bootstrap <script type="module"> (page-specific,
//     not shared) that fires a real click on the right tool card after
//     DOMContentLoaded, so app.js's own state.activeTab gets set correctly
//     for when the visitor actually uploads a file -- then restores the
//     SEO-optimized <h1> text, since app.js's click handler overwrites it
//     with its own short microcopy as a side effect
//   - the SEO blog block appended inside #uploadLanding, after the upload
//     card and before </main>, so it's part of that section's existing
//     scroll container and only shows while the visitor hasn't uploaded yet
//
// Every shared script (app.js, ui-panels.js, dot-grid.js, mobile-nav.js,
// home-hub.js, pdf-hub-mobile.js, project-history.js) is linked exactly as
// index.html already links it -- untouched, not duplicated.
//
// Run: node scripts/generate-tool-pages.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://bgr-pro.vercel.app';
const SOURCE = readFileSync(join(ROOT, 'index.html'), 'utf8');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Strips simple <a>/<strong> etc. tags down to plain text, keeping the words,
// for the JSON-LD Answer.text (schema.org expects plain text; the visible
// on-page HTML keeps the real <a> links). Same words either way.
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');

// ── Per-tool config (content supplied by the user, verbatim) ──────────────
const TOOLS = [
  {
    slug: 'background-remover',
    tab: 'bg-remover',
    title: 'Free AI Background Remover | EraserPro',
    description: 'Remove any image background in seconds with AI. Clean edges around hair, fur, and fine details — no Photoshop skills needed. Try it free.',
    h1: 'AI Background Remover',
    keywords: 'ai background remover, remove background from image, transparent background maker, background eraser online',
    kw: 'Remove a Background',
    headline: 'How AI Background Removal Works — And Why It Beats Manual Editing',
    intro: `Manually cutting out a background used to mean minutes of careful work with a lasso or pen tool — zooming in strand by strand around hair, fixing jagged edges, redoing it every time a photo changed. AI background removal replaces all of that with a single upload.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your image', text: 'Upload your image (JPG, PNG, or WEBP).' },
      { icon: 'auto_awesome', name: 'AI separates your subject', text: 'The AI analyzes the image and separates your subject from the background, pixel by pixel.' },
      { icon: 'check_circle', name: 'Preview the cutout', text: 'Preview the cutout against a transparent checkerboard.' },
      { icon: 'download_done', name: 'Fine-tune and export', text: 'Fine-tune edges if needed, then export as a transparent PNG or drop in a new background.' },
    ],
    benefitsTitle: 'Why AI Beats Manual Editing',
    benefits: [
      { icon: 'speed', title: 'Speed', text: 'Seconds instead of 10–20 minutes per image in traditional photo editors.' },
      { icon: 'content_cut', title: 'Accuracy on hard edges', text: 'Trained on millions of images, the AI handles fine details like hair strands, fur, and semi-transparent objects (glass, mesh fabric) that manual selection tools struggle with.' },
      { icon: 'verified', title: 'Consistency', text: 'Process product photos and get a clean result every time.' },
      { icon: 'school', title: 'No skill required', text: 'No masking, feathering, or channel techniques to learn.' },
    ],
    useCasesTitle: 'Common Use Cases',
    useCases: [
      'E-commerce product photography (Amazon, Shopify, Etsy listings)',
      'Profile pictures and headshots for LinkedIn or resumes',
      'Marketing graphics, banners, and social posts',
      'Presentation slides and design mockups',
      'ID-style photos',
    ],
    tipsTitle: 'Tips for the Cleanest Cutout',
    tips: [
      'Shoot against a plain, evenly lit background when possible.',
      'Avoid subjects wearing colors identical to the background.',
      'Higher-resolution originals give the AI more detail to work with around edges like hair.',
    ],
    faqs: [
      { q: 'Is background removal free?', a: 'Yes — every account starts with free credits, with a Pro plan available for higher volume.' },
      { q: 'What image formats are supported?', a: 'JPG, PNG, and WEBP uploads, exported as a PNG with transparency.' },
      { q: 'Will it handle complex edges like hair or fur?', a: 'Yes, this is specifically what the AI model is trained for.' },
      { q: 'Can I use the result commercially?', a: 'Yes, for images you have the rights to use.' },
      { q: 'Is there an image size limit?', a: 'There’s no strict upload limit — very large images are automatically optimized in the background before processing, so results stay fast without sacrificing quality.' },
    ],
    closingLink: { href: '/watermark-remover.html', text: 'Watermark Remover' },
    closingText: (link) => `Need to protect the result afterward? Try our ${link} to clean up any leftover logos, or explore the <a href="/index.html#pdfHub" class="brand-gradient-text font-headline-sm">PDF Hub</a> for document tools.`,
  },
  {
    slug: 'watermark-remover',
    tab: 'wm-remover',
    title: 'Free Watermark Remover Online | EraserPro',
    description: 'Remove watermarks and logo overlays from your own images in seconds with AI. Fast, simple, no editing skills needed.',
    h1: 'Watermark Remover',
    keywords: 'watermark remover, remove watermark from image, remove logo from photo, delete watermark online',
    kw: 'Remove a Watermark',
    headline: 'How to Remove Watermarks from Your Own Photos and Files',
    intro: `Whether it's an old company stamp on an archived photo, a timestamp overlay from a camera, or a preview mark on a stock image you've already licensed, this tool reconstructs the pixels underneath a watermark automatically.<br><br><strong>Use this tool only on images you own or have the rights to edit</strong> — it's built for cleaning up your own content, not for removing copyright protection from someone else's work.`,
    steps: [
      { icon: 'upload_file', name: 'Upload the image', text: 'Upload the image.' },
      { icon: 'gesture', name: 'Mark the watermark', text: 'Mark the watermark area — auto-detect or manual brush.' },
      { icon: 'auto_awesome', name: 'AI reconstructs the pixels', text: 'The AI reconstructs the pixels underneath.' },
      { icon: 'download_done', name: 'Download', text: 'Download the cleaned image.' },
    ],
    benefitsTitle: null,
    benefits: [],
    useCasesTitle: 'Common Use Cases',
    useCases: [
      'Removing an old logo overlay from your own archived photos',
      'Cleaning up personal photos with a date/timestamp stamp',
      'Removing a preview watermark from a stock image after purchasing the license',
      { text: 'Removing your own outdated watermark before re-branding — pair it with our', linkHref: '/watermark-maker.html', linkText: 'Watermark Maker', after: 'to add your new one.' },
    ],
    tipsTitle: 'Tips',
    tips: [
      'Larger, higher-resolution source images give a cleaner reconstruction.',
      'Works best on watermarks over relatively simple or textured backgrounds; very busy backgrounds may need a manual touch-up afterward.',
    ],
    faqs: [
      { q: 'Is this legal to use?', a: 'Yes, on images you own or have rights to — it’s not intended for removing copyright protection from someone else’s work.' },
      { q: 'What types of watermarks can it remove?', a: 'Text overlays, logos, and timestamp stamps.' },
      { q: 'Will removing a watermark reduce image quality?', a: 'Reconstruction is localized to the watermark area — the rest of the image is untouched.' },
      { q: 'Is it free?', a: 'Yes, with free credits included and a Pro plan for higher volume.' },
      { q: 'Can I process multiple images at once?', a: 'Not yet — each image is processed individually right now to keep quality high.' },
    ],
    closingLink: { href: '/watermark-maker.html', text: 'Watermark Maker' },
    closingText: (link) => `Want to add your own watermark afterward? Try our ${link}, or explore the <a href="/index.html#pdfHub" class="brand-gradient-text font-headline-sm">PDF Hub</a> for document tools.`,
  },
  {
    slug: 'watermark-maker',
    tab: 'wm-maker',
    title: 'Free Watermark Maker Online | EraserPro',
    description: 'Protect and brand your photos with a custom text or logo watermark. Adjust position, size, and opacity, then download — free to start.',
    h1: 'Watermark Maker',
    keywords: 'watermark maker, add watermark to photo, create watermark online, logo watermark tool',
    kw: 'Add a Watermark',
    headline: 'How to Add a Watermark to Your Photos',
    intro: `A watermark is the simplest way to protect your work from unauthorized use while quietly reinforcing your brand every time an image is shared.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your image', text: 'Upload your image.' },
      { icon: 'branding_watermark', name: 'Add text or logo', text: 'Add a text watermark or upload your logo.' },
      { icon: 'tune', name: 'Adjust', text: 'Adjust position, size, opacity, and rotation.' },
      { icon: 'download_done', name: 'Apply and download', text: 'Apply and download.' },
    ],
    benefitsTitle: null,
    benefits: [],
    useCasesTitle: 'Common Use Cases',
    useCases: [
      'Photographers protecting portfolio previews from unauthorized use',
      'E-commerce sellers branding product photos consistently across listings',
      'Content creators marking social media graphics',
      'Agencies adding "draft" stamps before final client delivery',
    ],
    tipsTitle: 'Tips',
    tips: [
      'Lower opacity (around 30–50%) protects the image without overwhelming it.',
      'Placing the watermark across a busier area of the image — not just a corner — makes it harder to crop out.',
      'Save a watermark preset so you’re not repositioning it every time.',
    ],
    faqs: [
      { q: 'Can I upload my own logo as a watermark?', a: 'Yes, in addition to text watermarks.' },
      { q: 'Will the watermark reduce image quality?', a: 'No, it’s applied as an overlay on the original resolution.' },
      { q: 'Can I apply a watermark to multiple images at once?', a: 'Not yet — each image is processed individually right now, one upload at a time.' },
      { q: 'Is it free to use?', a: 'Yes, with free credits included and a Pro plan for higher volume.' },
      { q: 'Can I remove a watermark later if needed?', a: 'Yes, using the Watermark Remover tool.', linkHref: '/watermark-remover.html', linkText: 'Watermark Remover tool' },
    ],
    closingLink: { href: '/watermark-remover.html', text: 'Watermark Remover' },
    closingText: (link) => `Need to take an old watermark off first? Try our ${link}, or explore the <a href="/index.html#pdfHub" class="brand-gradient-text font-headline-sm">PDF Hub</a> for document tools.`,
  },
];

// ── SEO <head> block (title/description/OG/canonical/schema) ──────────────
function headSeo(tool) {
  const url = `${SITE}/${tool.slug}.html`;
  const howto = {
    '@context': 'https://schema.org', '@type': 'HowTo',
    name: tool.h1, description: tool.description,
    step: tool.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: tool.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) },
    })),
  };
  return [
    `<title>${esc(tool.title)}</title>`,
    `<meta name="description" content="${esc(tool.description)}"/>`,
    `<meta name="keywords" content="${esc(tool.keywords)}"/>`,
    `<link rel="canonical" href="${url}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:title" content="${esc(tool.title)}"/>`,
    `<meta property="og:description" content="${esc(tool.description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<script type="application/ld+json">${JSON.stringify(howto)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(faq)}</script>`,
  ].join('\n');
}

// ── SEO body block (steps / benefits / use cases / tips / FAQ) ────────────
function stepsHtml(tool) {
  return tool.steps.map((s, i) => `
<div class="glass-panel rounded-xl p-lg flex flex-col items-center text-center">
<div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-md">
<span class="material-symbols-outlined text-[32px] brand-gradient-icon" style="font-variation-settings:'FILL' 1;">${esc(s.icon)}</span>
</div>
<h3 class="font-headline-sm text-headline-sm text-on-surface mb-sm flex items-center gap-sm"><span class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md">${i + 1}</span>${esc(s.name)}</h3>
<p class="font-body-md text-body-md text-on-surface-variant">${esc(s.text)}</p>
</div>`).join('');
}

function benefitsHtml(tool) {
  return tool.benefits.map((b) => `
<div class="glass-panel p-md rounded-lg flex items-start gap-md">
<span class="material-symbols-outlined brand-gradient-icon mt-xs" style="font-variation-settings:'FILL' 1;">${esc(b.icon)}</span>
<div><h3 class="font-headline-sm text-headline-sm text-on-surface mb-xs">${esc(b.title)}</h3><p class="font-body-md text-body-md text-on-surface-variant">${esc(b.text)}</p></div>
</div>`).join('');
}

// Renders a bullet list item that may include an inline link (used for the
// cross-tool internal links called for in "Common Use Cases"/FAQ content).
function bulletHtml(item) {
  if (typeof item === 'string') return `<li class="font-body-md text-body-md text-on-surface-variant">${esc(item)}</li>`;
  return `<li class="font-body-md text-body-md text-on-surface-variant">${esc(item.text)} <a href="${esc(item.linkHref)}" class="brand-gradient-text font-headline-sm">${esc(item.linkText)}</a> ${esc(item.after || '')}</li>`;
}

function faqHtml(tool) {
  return tool.faqs.map((f) => {
    const answerHtml = f.linkHref
      ? f.a.replace(f.linkText, `<a href="${esc(f.linkHref)}" class="brand-gradient-text font-headline-sm">${esc(f.linkText)}</a>`)
      : esc(f.a);
    return `
<details class="glass-panel rounded-lg group" name="seo-faq">
<summary class="flex justify-between items-center p-md cursor-pointer hover:bg-surface-container-low/50 transition-colors rounded-lg gap-md">
<h3 class="font-headline-sm text-headline-sm text-on-surface m-0">${esc(f.q)}</h3>
<span class="material-symbols-outlined text-outline shrink-0 transition-transform duration-300 group-open:rotate-180">expand_more</span>
</summary>
<div class="p-md pt-0 font-body-md text-body-md text-on-surface-variant">${answerHtml}</div>
</details>`;
  }).join('');
}

function seoBlock(tool) {
  const closingLinkHtml = `<a href="${esc(tool.closingLink.href)}" class="brand-gradient-text font-headline-sm">${esc(tool.closingLink.text)}</a>`;
  return `
<!-- ===== SEO blog content (below the tool UI, above the footer) ===== -->
<section class="tool-seo-block w-full max-w-7xl mx-auto px-lg pb-xl flex flex-col gap-xl lg:gap-[64px] relative z-10 mt-16">
<div class="text-center max-w-3xl mx-auto pt-xl">
<h2 class="font-headline-lg text-headline-lg text-on-surface mb-md">${esc(tool.headline)}</h2>
<p class="font-body-lg text-body-lg text-on-surface-variant">${tool.intro}</p>
</div>
<div class="w-full">
<div class="text-center mb-xl"><h2 class="font-headline-lg text-headline-lg text-on-surface">How It Works</h2></div>
<div class="grid grid-cols-1 md:grid-cols-4 gap-lg">${stepsHtml(tool)}</div>
</div>
${tool.benefits.length ? `<div class="w-full">
<h2 class="font-headline-lg text-headline-lg text-on-surface text-center mb-lg">${esc(tool.benefitsTitle)}</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-md">${benefitsHtml(tool)}</div>
</div>` : ''}
<div class="w-full flex flex-col lg:flex-row gap-xl">
<div class="w-full lg:w-1/2">
<h2 class="font-headline-lg text-headline-lg text-on-surface mb-md">${esc(tool.useCasesTitle)}</h2>
<ul class="flex flex-col gap-sm list-disc pl-6">${tool.useCases.map(bulletHtml).join('')}</ul>
</div>
<div class="w-full lg:w-1/2">
<h2 class="font-headline-lg text-headline-lg text-on-surface mb-md">${esc(tool.tipsTitle)}</h2>
<ul class="flex flex-col gap-sm list-disc pl-6">${tool.tips.map(bulletHtml).join('')}</ul>
</div>
</div>
<div class="w-full max-w-3xl mx-auto">
<h2 class="font-headline-lg text-headline-lg text-on-surface text-center mb-lg">Frequently Asked Questions</h2>
<div class="flex flex-col gap-sm">${faqHtml(tool)}</div>
</div>
<div class="w-full text-center max-w-2xl mx-auto">
<p class="font-body-lg text-body-lg text-on-surface-variant">${tool.closingText(closingLinkHtml)}</p>
</div>
</section>
<footer class="w-full py-xl px-lg flex flex-col sm:flex-row gap-md justify-between items-center max-w-7xl mx-auto border-t border-outline-variant/20 relative z-10">
<a href="/index.html" class="font-headline-sm text-headline-sm text-primary">EraserPro</a>
<div class="text-on-surface-variant opacity-70 font-label-md text-label-md">© 2026 EraserPro AI. All rights reserved.</div>
<div class="flex gap-lg"><a class="text-on-surface-variant opacity-70 font-label-md text-label-md hover:text-primary transition-colors" href="/index.html">Home</a><a class="text-on-surface-variant opacity-70 font-label-md text-label-md hover:text-primary transition-colors" href="/index.html#pdfHub">PDF Hub</a></div>
</footer>`;
}

// The bootstrap that sets state.activeTab correctly (via a real click on the
// existing tool-card control -- no app.js logic duplicated) and then
// restores the SEO <h1> text, since app.js's own click handler overwrites
// #uploadTitle with its own short microcopy as a side effect of that click.
function bootstrapScript(tool) {
  return `<script type="module">
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.landing-tab-btn[data-landing-tab="${tool.tab}"]')?.click();
  const h1 = document.getElementById('uploadTitle');
  if (h1) h1.textContent = ${JSON.stringify(tool.h1)};
});
</script>`;
}

function renderPage(tool) {
  let html = SOURCE;

  // 1) <title> + meta description/OG/canonical/schema: replace the sitewide
  //    FAQPage schema block (10 general Q&As -- not specific to this page)
  //    with this tool's own head SEO block in one shot.
  html = html.replace(/<title>[^<]*<\/title>/, ''); // dropped; headSeo() re-adds it
  const faqScriptRe = /\s*<!-- FAQ structured data \(all 10 Q&As\) for SEO rich results -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/;
  if (!faqScriptRe.test(html)) {
    throw new Error(`${tool.slug}: sitewide FAQPage schema block not found (index.html structure changed?)`);
  }
  html = html.replace(faqScriptRe, `\n${headSeo(tool)}\n`);

  // 2) Bump index.html's own generic viewport meta neighbor untouched; just
  //    make sure our head block landed once (sanity check happens at the end).

  // 3) Demote the OTHER <h1>s that exist elsewhere in this same shared
  //    markup (hub-hero's hidden hero heading, and My Projects' heading) to
  //    <h2> so there's exactly one real <h1> on the page -- the visible
  //    #uploadTitle one, set in step 5. Both are inert here (hub-hero lives
  //    inside the now-hidden #hubLauncher; My Projects only becomes visible
  //    if the visitor navigates to that view), demoting them costs nothing.
  const heroH1 = `<h1 class="hub-hero-title">Every tool you need.<br><span class="hub-gradient-text">One workspace.</span></h1>`;
  const heroH2 = `<h2 class="hub-hero-title">Every tool you need.<br><span class="hub-gradient-text">One workspace.</span></h2>`;
  if (!html.includes(heroH1)) throw new Error(`${tool.slug}: hub-hero <h1> not found verbatim (index.html copy changed?)`);
  html = html.replace(heroH1, heroH2);

  const myProjectsH1 = `<h1 class="projects-title">My Projects</h1>`;
  const myProjectsH2 = `<h2 class="projects-title">My Projects</h2>`;
  if (!html.includes(myProjectsH1)) throw new Error(`${tool.slug}: My Projects <h1> not found verbatim (index.html copy changed?)`);
  html = html.replace(myProjectsH1, myProjectsH2);

  // 4) Hide the tool-picker launcher, show this tool's upload screen, and
  //    mark the matching tool card active (in case the visitor clicks
  //    "All tools" before uploading).
  html = html.replace(
    '<div class="hub-wrap" id="hubLauncher">',
    '<div class="hub-wrap" id="hubLauncher" hidden>'
  );
  html = html.replace(
    '<div class="hub-upload-wrap" id="hubUploadView" hidden>',
    '<div class="hub-upload-wrap" id="hubUploadView">'
  );
  for (const t of TOOLS) {
    const activeCard = `<a href="${t.slug}.html" class="landing-tab-btn tool-card active" data-landing-tab="${t.tab}">`;
    const inactiveCard = `<a href="${t.slug}.html" class="landing-tab-btn tool-card" data-landing-tab="${t.tab}">`;
    html = html.includes(activeCard)
      ? html.replace(activeCard, t.slug === tool.slug ? activeCard : inactiveCard)
      : html.replace(inactiveCard, t.slug === tool.slug ? activeCard : inactiveCard);
  }

  // 5) Pre-set the SEO-optimized <h1> + upload CTA copy statically (so
  //    there's no flash of the wrong tool's text before the bootstrap
  //    script runs).
  html = html.replace(
    '<h1 id="uploadTitle" class="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">Upload an Image</h1>',
    `<h1 id="uploadTitle" class="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">${esc(tool.h1)}</h1>`
  );

  // 6) Insert the SEO blog block inside #uploadLanding, right after the
  //    upload card and before the section's closing </main>.
  const uploadViewClose = `        <input type="file" id="fileInput" accept="image/png, image/jpeg, image/webp" class="hidden">\n        </div>\n    </div>\n</main>`;
  if (!html.includes(uploadViewClose)) throw new Error(`${tool.slug}: #hubUploadView closing markup not found verbatim`);
  html = html.replace(uploadViewClose, uploadViewClose.replace('</main>', `${seoBlock(tool)}\n</main>`));

  // 7) Bootstrap script: placed right after app.js's own module script tag,
  //    so it runs after app.js's DOMContentLoaded handler has attached the
  //    tool-card click listener (module scripts execute in document order).
  const appScriptTag = /<script type="module" src="app\.js\?v=\d+"><\/script>/;
  if (!appScriptTag.test(html)) throw new Error(`${tool.slug}: app.js script tag not found`);
  html = html.replace(appScriptTag, (m) => `${m}\n${bootstrapScript(tool)}`);

  return html;
}

let count = 0;
for (const tool of TOOLS) {
  const html = renderPage(tool);
  writeFileSync(join(ROOT, `${tool.slug}.html`), html, 'utf8');
  count++;
}
console.log(`Generated ${count} tool pages into project root: ${TOOLS.map((t) => t.slug + '.html').join(', ')}`);
