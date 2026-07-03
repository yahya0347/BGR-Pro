// Per-tool SEO content for the bottom educational block on every PDF page.
// Single source of truth consumed by generate-pdf-pages.mjs. Each entry:
//   title    <title> tag, keyword-first, < 60 chars
//   desc     <meta description>, < 155 chars
//   keywords <meta keywords>
//   kw       gradient keyword phrase used inside the H2 intro heading
//   action   short verb phrase, woven into the benefit cards
//   cs        true = runs 100% in the browser; false = uses the CloudConvert service
//   intro    intro paragraph HTML (contains 2 contextual internal links)
//   steps    exactly 3 {icon,name,text} — must match the HowTo JSON-LD
//   faqs     4–5 {q,a} — must match the FAQPage JSON-LD
//   illo     illustration concept (see illoSvg in the generator)
//   illoAlt  descriptive alt text containing the tool keyword
//
// Internal-link helper (keeps intros terse).
const L = (slug, label) => `<a href="/pdf/${slug}.html" class="text-primary font-medium hover:underline">${label}</a>`;

export const SEO = {
  // ─────────────── Organize & Edit ───────────────
  merge: {
    title: 'Merge PDF Files Online Free — EraserPro',
    desc: 'Combine multiple PDF files into one document online, free. Reorder, add and remove PDFs, then download — right in your browser.',
    keywords: 'merge pdf, combine pdf, join pdf online, pdf merger free',
    kw: 'Merge PDF Files', action: 'merge your PDF files', cs: true,
    intro: `Need to <strong class="text-on-surface">combine PDF files</strong> into one document? EraserPro lets you join PDFs online for free with drag-to-reorder control. Once combined, you can ${L('split', 'split the result')} back apart or ${L('compress', 'compress it')} to shrink the file size.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDFs', text: 'Drag and drop the PDF files you want to combine, or click to select them from your device.' },
      { icon: 'swap_vert', name: 'Reorder the files', text: 'Use the up and down arrows to arrange the PDFs in the exact order you want them merged.' },
      { icon: 'download_done', name: 'Download the merged PDF', text: 'Click Merge & Download and your single combined PDF is ready in seconds.' },
    ],
    faqs: [
      { q: 'Is it safe to merge PDF files here?', a: 'Yes — merging happens entirely in your browser. Your PDFs are never uploaded to a server, so nothing leaves your device.' },
      { q: 'How many PDFs can I combine at once?', a: 'You can merge as many PDFs as your device memory allows. For most files there is no practical limit.' },
      { q: 'Can I change the order of the files?', a: 'Absolutely. Each file has up and down controls so you can arrange the order before merging.' },
      { q: 'Is the PDF merger free?', a: 'Yes, merging PDFs is 100% free with no watermarks and no sign-up required.' },
    ],
    illo: { t: 'merge' }, illoAlt: 'Illustration of two PDF documents being merged into one combined PDF file',
  },

  split: {
    title: 'Split PDF Online Free — EraserPro',
    desc: 'Split a PDF into separate pages or custom page ranges and download them as a ZIP — free and fully in your browser.',
    keywords: 'split pdf, separate pdf pages, extract pdf pages, pdf splitter',
    kw: 'Split PDF Files', action: 'split your PDF', cs: true,
    intro: `Want to <strong class="text-on-surface">split a PDF</strong> into individual pages or ranges? EraserPro breaks your document apart in seconds. Need the opposite? ${L('merge', 'Merge PDFs')} back together, or ${L('extract-pages', 'extract specific pages')} instead.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Drop in the PDF you want to divide, or click to browse for it on your device.' },
      { icon: 'call_split', name: 'Choose how to split', text: 'Split every page into its own file, or enter custom ranges like 1-3, 4-6 to group pages.' },
      { icon: 'folder_zip', name: 'Download the ZIP', text: 'Click Split & Download to get all your separated PDFs neatly packaged in a ZIP file.' },
    ],
    faqs: [
      { q: 'Does splitting my PDF upload it anywhere?', a: 'No. The split runs locally in your browser, so your document never leaves your computer.' },
      { q: 'Can I split by page ranges?', a: 'Yes — choose "custom ranges" and enter values like 1-3, 4-6 to create one PDF per range.' },
      { q: 'What format is the output?', a: 'Each resulting page or range is a separate PDF, bundled together in a single downloadable ZIP.' },
      { q: 'Is there a page limit?', a: 'No fixed limit — you can split large PDFs, constrained only by your device memory.' },
    ],
    illo: { t: 'split' }, illoAlt: 'Illustration of a single PDF splitting into two separate PDF documents',
  },

  compress: {
    title: 'Compress PDF Online Free — EraserPro',
    desc: 'Reduce PDF file size online for free. Optimize your PDF in the browser and download a smaller file — no uploads, no sign-up.',
    keywords: 'compress pdf, reduce pdf size, shrink pdf, pdf compressor free',
    kw: 'Compress PDF Files', action: 'compress your PDF', cs: true,
    intro: `Emailing or uploading a bulky file? <strong class="text-on-surface">Compress your PDF</strong> to reduce its size while keeping it readable. You can also ${L('merge', 'merge several PDFs')} first, or ${L('split', 'split large documents')} before compressing.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to shrink by dragging it in or selecting it from your device.' },
      { icon: 'compress', name: 'Optimize the file', text: 'EraserPro streamlines the PDF structure to make it as small as possible without losing content.' },
      { icon: 'download_done', name: 'Download the smaller PDF', text: 'See the before/after size, then download your optimized, lighter PDF.' },
    ],
    faqs: [
      { q: 'Are my files uploaded to compress them?', a: 'No — compression happens in your browser, so your PDF stays private on your device.' },
      { q: 'Will compression reduce quality?', a: 'It optimizes the PDF structure without degrading text or vector content. Image-heavy scans compress less.' },
      { q: 'How much smaller will my PDF be?', a: 'It varies by file. PDFs heavy on fonts and vectors shrink the most; you will see the exact result before downloading.' },
      { q: 'Is compressing PDFs free?', a: 'Yes, it is completely free with no watermarks or limits.' },
    ],
    illo: { t: 'sym', s: 'compress' }, illoAlt: 'Illustration of a PDF document being compressed to a smaller file size',
  },

  rotate: {
    title: 'Rotate PDF Online Free — EraserPro',
    desc: 'Rotate PDF pages 90, 180 or 270 degrees online for free. Fix sideways or upside-down pages in your browser and download.',
    keywords: 'rotate pdf, turn pdf pages, fix pdf orientation, rotate pdf online',
    kw: 'Rotate PDF Pages', action: 'rotate your PDF pages', cs: true,
    intro: `Scanned pages sideways? <strong class="text-on-surface">Rotate your PDF</strong> to the correct orientation in seconds. Pair it with ${L('crop', 'cropping margins')} or ${L('reorder', 'reordering pages')} to fully clean up a document.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Drag in the PDF whose pages need turning, or browse to select it.' },
      { icon: 'rotate_right', name: 'Pick the rotation', text: 'Choose 90°, 180° or 270°, and optionally limit it to specific pages like 1, 3-5.' },
      { icon: 'download_done', name: 'Download the fixed PDF', text: 'Apply the rotation and download your correctly oriented PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to rotate it?', a: 'No — rotation is done locally in your browser, keeping your file private.' },
      { q: 'Can I rotate only some pages?', a: 'Yes. Leave the field blank to rotate every page, or enter pages like 1, 3-5 to target specific ones.' },
      { q: 'What rotation angles are supported?', a: 'You can rotate pages 90° clockwise, 180°, or 270° (90° counter-clockwise).' },
      { q: 'Is rotating PDFs free?', a: 'Yes, it is free with no watermark and no account required.' },
    ],
    illo: { t: 'sym', s: 'rotate' }, illoAlt: 'Illustration of a PDF page being rotated to the correct orientation',
  },

  'delete-pages': {
    title: 'Delete PDF Pages Online Free — EraserPro',
    desc: 'Remove unwanted pages from a PDF online for free. Delete specific pages in your browser and download the trimmed PDF.',
    keywords: 'delete pdf pages, remove pages from pdf, pdf page remover',
    kw: 'Delete PDF Pages', action: 'delete pages from your PDF', cs: true,
    intro: `Have blank or unwanted pages? <strong class="text-on-surface">Delete PDF pages</strong> quickly and keep only what you need. You can also ${L('extract-pages', 'extract pages')} into a new file or ${L('split', 'split the PDF')} instead.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to edit by dragging it in or selecting it.' },
      { icon: 'delete_sweep', name: 'Choose pages to remove', text: 'Enter the page numbers or ranges to delete, such as 2, 4-6.' },
      { icon: 'download_done', name: 'Download the result', text: 'Remove the pages and download your trimmed PDF instantly.' },
    ],
    faqs: [
      { q: 'Do you upload my PDF to delete pages?', a: 'No — everything happens in your browser, so your document is never sent to a server.' },
      { q: 'Which pages can I delete?', a: 'Any pages you specify, individually or in ranges (for example 2, 4-6).' },
      { q: 'Can I delete every page?', a: 'At least one page must remain, so a PDF is never left empty.' },
      { q: 'Is deleting PDF pages free?', a: 'Yes, completely free with no watermarks or sign-up.' },
    ],
    illo: { t: 'sym', s: 'delete' }, illoAlt: 'Illustration of an unwanted page being removed from a PDF document',
  },

  'extract-pages': {
    title: 'Extract PDF Pages Online Free — EraserPro',
    desc: 'Pull selected pages out of a PDF into a new file, free and in your browser. Pick pages in any order and download.',
    keywords: 'extract pdf pages, pull pages from pdf, save pdf pages, pdf page extractor',
    kw: 'Extract PDF Pages', action: 'extract pages from your PDF', cs: true,
    intro: `Only need a few pages? <strong class="text-on-surface">Extract PDF pages</strong> into a brand-new document in the order you choose. To remove pages instead, use ${L('delete-pages', 'Delete Pages')}, or ${L('split', 'split the whole PDF')} at once.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Drop in the source PDF or click to browse for it.' },
      { icon: 'content_copy', name: 'Select pages to extract', text: 'Type the pages you want, in order — for example 1, 3, 5-7.' },
      { icon: 'download_done', name: 'Download the new PDF', text: 'Extract and download a fresh PDF containing only your chosen pages.' },
    ],
    faqs: [
      { q: 'Is my file uploaded to extract pages?', a: 'No — extraction runs in your browser, so the original PDF stays on your device.' },
      { q: 'Can I reorder pages while extracting?', a: 'Yes. The pages appear in the order you type them, so 3, 1 puts page 3 first.' },
      { q: 'Does the original PDF change?', a: 'No, your original stays intact — extraction creates a separate new PDF.' },
      { q: 'Is page extraction free?', a: 'Yes, it is free with no watermark and no account needed.' },
    ],
    illo: { t: 'sym', s: 'extract' }, illoAlt: 'Illustration of selected pages being pulled out of a PDF into a new document',
  },

  reorder: {
    title: 'Reorder PDF Pages Online Free — EraserPro',
    desc: 'Rearrange PDF pages with drag-and-drop thumbnails, free and in your browser. Reorder pages and download the new PDF.',
    keywords: 'reorder pdf pages, rearrange pdf, organize pdf pages, sort pdf pages',
    kw: 'Reorder PDF Pages', action: 'reorder your PDF pages', cs: true,
    intro: `Pages out of sequence? <strong class="text-on-surface">Reorder PDF pages</strong> visually by dragging thumbnails into place. You may also want to ${L('merge', 'merge multiple PDFs')} first or ${L('rotate', 'rotate pages')} that are turned the wrong way.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF whose page order you want to change.' },
      { icon: 'drag_indicator', name: 'Drag to rearrange', text: 'Drag the page thumbnails into the new order you want.' },
      { icon: 'download_done', name: 'Download the new PDF', text: 'Apply your order and download the reorganized PDF.' },
    ],
    faqs: [
      { q: 'Are my pages uploaded to reorder them?', a: 'No — thumbnails render and reorder locally in your browser; nothing is uploaded.' },
      { q: 'How do I move a page?', a: 'Simply drag its thumbnail and drop it where you want it in the sequence.' },
      { q: 'Can I reorder large PDFs?', a: 'Yes, though very large documents take a moment to render all thumbnails.' },
      { q: 'Is reordering pages free?', a: 'Yes, it is entirely free and requires no sign-up.' },
    ],
    illo: { t: 'sym', s: 'reorder' }, illoAlt: 'Illustration of PDF page thumbnails being dragged into a new order',
  },

  'page-numbers': {
    title: 'Add Page Numbers to PDF Free — EraserPro',
    desc: 'Add page numbers to a PDF online for free. Choose position and style, then download — all in your browser.',
    keywords: 'add page numbers to pdf, pdf page numbering, number pdf pages',
    kw: 'Page Numbers to PDF', action: 'add page numbers to your PDF', cs: true,
    intro: `Make documents easy to reference by <strong class="text-on-surface">adding page numbers to your PDF</strong>. Choose the position and starting number in seconds. Combine it with a ${L('watermark', 'watermark')} or ${L('merge', 'merge several PDFs')} first.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Drop in the PDF you want to number, or browse to select it.' },
      { icon: 'pin', name: 'Choose position & style', text: 'Pick a corner or center, a starting number, and a style like "1" or "1 of N".' },
      { icon: 'download_done', name: 'Download the numbered PDF', text: 'Apply the numbers and download your paginated PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to add numbers?', a: 'No — numbering is applied in your browser, keeping your file private.' },
      { q: 'Where can the numbers appear?', a: 'You can place them in any corner or centered, at the top or bottom of each page.' },
      { q: 'Can I start from a specific number?', a: 'Yes, set any starting value — handy when a document continues from another.' },
      { q: 'Is adding page numbers free?', a: 'Yes, it is free with no watermark and no account needed.' },
    ],
    illo: { t: 'sym', s: 'numbers' }, illoAlt: 'Illustration of page numbers being added to the pages of a PDF document',
  },

  crop: {
    title: 'Crop PDF Online Free — EraserPro',
    desc: 'Crop PDF margins online for free. Trim white space on any side in your browser and download the cropped PDF.',
    keywords: 'crop pdf, trim pdf margins, cut pdf edges, pdf cropper online',
    kw: 'Crop PDF Pages', action: 'crop your PDF pages', cs: true,
    intro: `Trim distracting white space by <strong class="text-on-surface">cropping your PDF</strong> margins on any side. It pairs well with ${L('rotate', 'rotating pages')} or ${L('compress', 'compressing the file')} afterwards.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to crop by dragging it in or selecting it.' },
      { icon: 'crop', name: 'Set the margins', text: 'Enter how many points to trim from the top, right, bottom and left.' },
      { icon: 'download_done', name: 'Download the cropped PDF', text: 'Apply the crop and download your tidied-up PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to crop it?', a: 'No — cropping is done in your browser so your document never leaves your device.' },
      { q: 'How do I control the crop?', a: 'Enter a margin in points (72 points = 1 inch) for each side you want to trim.' },
      { q: 'Does cropping delete content?', a: 'It changes the visible page boundary rather than deleting page content permanently.' },
      { q: 'Is cropping PDFs free?', a: 'Yes, completely free with no watermarks.' },
    ],
    illo: { t: 'sym', s: 'crop' }, illoAlt: 'Illustration of PDF page margins being cropped with corner guides',
  },

  // ─────────────── Security & Signing ───────────────
  protect: {
    title: 'Password Protect PDF Free — EraserPro',
    desc: 'Add a password and 256-bit AES encryption to a PDF, free and in your browser. Secure your document, then download.',
    keywords: 'password protect pdf, encrypt pdf, add password to pdf, lock pdf',
    kw: 'Password Protect a PDF', action: 'password protect your PDF', cs: true,
    intro: `Keep sensitive documents private — <strong class="text-on-surface">password protect your PDF</strong> with strong AES encryption. Need to remove a password you already have? Use ${L('unlock', 'Unlock PDF')}. You can also ${L('watermark', 'add a watermark')} for extra deterrence.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Drop in the PDF you want to secure, or click to select it.' },
      { icon: 'password', name: 'Set a password', text: 'Type the password that will be required to open the file.' },
      { icon: 'download_done', name: 'Download the protected PDF', text: 'Encrypt and download your password-protected PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to protect it?', a: 'No — encryption runs entirely in your browser, so the file and password never leave your device.' },
      { q: 'What encryption is used?', a: 'Your PDF is secured with 256-bit AES encryption, the modern standard for document security.' },
      { q: 'What if I forget the password?', a: 'There is no recovery — only someone with the password can open the file, so store it safely.' },
      { q: 'Is protecting a PDF free?', a: 'Yes, adding a password is free with no watermark.' },
    ],
    illo: { t: 'sym', s: 'lock' }, illoAlt: 'Illustration of a PDF document secured with a padlock and password',
  },

  unlock: {
    title: 'Unlock PDF Online Free — EraserPro',
    desc: 'Remove a password from a PDF you can open, free and in your browser. Unlock the file and download it without a password.',
    keywords: 'unlock pdf, remove pdf password, decrypt pdf, pdf password remover',
    kw: 'Unlock a PDF', action: 'unlock your PDF', cs: true,
    intro: `Tired of typing a password every time? <strong class="text-on-surface">Unlock your PDF</strong> to remove protection from a file you can already open. Want to add security instead? See ${L('protect', 'Protect PDF')}, or ${L('compress', 'compress the file')} once unlocked.`,
    steps: [
      { icon: 'upload_file', name: 'Upload the locked PDF', text: 'Add the password-protected PDF you want to unlock.' },
      { icon: 'lock_open', name: 'Enter the password', text: 'Type the current password so the file can be decrypted.' },
      { icon: 'download_done', name: 'Download the unlocked PDF', text: 'Remove the password and download a freely openable PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to unlock it?', a: 'No — decryption happens in your browser, so your file and password stay on your device.' },
      { q: 'Do I need the password to unlock?', a: 'Yes. This tool removes protection only from PDFs you can already open with the correct password.' },
      { q: 'Can it crack an unknown password?', a: 'No — that would be unethical. You must provide the correct password to remove it.' },
      { q: 'Is unlocking a PDF free?', a: 'Yes, it is free with no watermark or sign-up.' },
    ],
    illo: { t: 'sym', s: 'unlock' }, illoAlt: 'Illustration of a PDF document being unlocked with an open padlock',
  },

  esign: {
    title: 'eSign PDF Online Free — EraserPro',
    desc: 'Sign a PDF electronically for free. Draw your signature, place it on any page, and download — all in your browser.',
    keywords: 'esign pdf, sign pdf online, electronic signature pdf, digital signature',
    kw: 'eSign a PDF', action: 'sign your PDF', cs: true,
    intro: `Sign contracts without printing — <strong class="text-on-surface">eSign your PDF</strong> by drawing your signature and placing it anywhere. For added security you can ${L('protect', 'password protect')} the signed file or ${L('watermark', 'watermark it')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the document you need to sign by dragging it in or selecting it.' },
      { icon: 'draw', name: 'Draw your signature', text: 'Sign in the signature pad, then choose the page and position for it.' },
      { icon: 'download_done', name: 'Download the signed PDF', text: 'Place your signature and download the signed document.' },
    ],
    faqs: [
      { q: 'Is my document uploaded to sign it?', a: 'No — signing happens in your browser, so your PDF and signature never leave your device.' },
      { q: 'How do I create the signature?', a: 'Draw it with your mouse or finger on the built-in signature pad — no scanning needed.' },
      { q: 'Where can I place my signature?', a: 'Choose any page and a corner or centered position before applying it.' },
      { q: 'Is eSigning free?', a: 'Yes, signing PDFs is free with no watermark or account.' },
    ],
    illo: { t: 'sym', s: 'sign' }, illoAlt: 'Illustration of a handwritten signature being added to a PDF document',
  },

  watermark: {
    title: 'Add Watermark to PDF Free — EraserPro',
    desc: 'Add a text watermark to a PDF online for free. Set opacity, angle and size, then download — in your browser.',
    keywords: 'watermark pdf, add watermark to pdf, pdf watermark, stamp pdf',
    kw: 'Watermark a PDF', action: 'watermark your PDF', cs: true,
    intro: `Protect your work by <strong class="text-on-surface">adding a watermark to your PDF</strong> — stamp text like "CONFIDENTIAL" across every page. Combine it with ${L('protect', 'password protection')} or ${L('esign', 'an eSignature')} for stronger control.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to stamp by dragging it in or selecting it.' },
      { icon: 'branding_watermark', name: 'Customize the watermark', text: 'Enter your text and adjust opacity, angle and font size.' },
      { icon: 'download_done', name: 'Download the watermarked PDF', text: 'Apply the watermark and download your branded PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to watermark it?', a: 'No — the watermark is applied in your browser, so your file stays private.' },
      { q: 'Can I control how the watermark looks?', a: 'Yes — set the text, opacity, rotation angle and font size to taste.' },
      { q: 'Does it watermark every page?', a: 'Yes, your text is stamped across all pages of the document.' },
      { q: 'Is watermarking free?', a: 'Yes, it is completely free with no sign-up.' },
    ],
    illo: { t: 'sym', s: 'watermark' }, illoAlt: 'Illustration of a diagonal text watermark stamped across a PDF page',
  },

  redact: {
    title: 'Redact PDF Online Free — EraserPro',
    desc: 'Black out sensitive content in a PDF online for free. Draw redaction boxes in your browser and download the file.',
    keywords: 'redact pdf, black out pdf, hide pdf text, pdf redaction tool',
    kw: 'Redact a PDF', action: 'redact your PDF', cs: true,
    intro: `Hide confidential details before sharing — <strong class="text-on-surface">redact your PDF</strong> by drawing black boxes over sensitive areas. For full document security, also consider ${L('protect', 'password protection')} or ${L('flatten', 'flattening the PDF')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF containing information you want to hide.' },
      { icon: 'ink_highlighter', name: 'Draw redaction boxes', text: 'Drag to place solid black boxes over any text or areas you want covered.' },
      { icon: 'download_done', name: 'Download the redacted PDF', text: 'Apply the boxes and download your redacted document.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to redact it?', a: 'No — redaction boxes are applied in your browser, so the file never leaves your device.' },
      { q: 'How secure is this redaction?', a: 'It covers content with solid boxes, which hides it visually. For permanent, forensic-grade redaction, use a dedicated professional tool.' },
      { q: 'Can I redact multiple pages?', a: 'Yes — draw boxes on any page, and all of them are applied at once.' },
      { q: 'Is redacting PDFs free?', a: 'Yes, it is free with no watermark or account.' },
    ],
    illo: { t: 'sym', s: 'redact' }, illoAlt: 'Illustration of sensitive text being blacked out with redaction boxes on a PDF',
  },

  flatten: {
    title: 'Flatten PDF Online Free — EraserPro',
    desc: 'Flatten PDF form fields and annotations online for free. Lock content into the page in your browser and download.',
    keywords: 'flatten pdf, flatten pdf form, lock pdf fields, merge pdf layers',
    kw: 'Flatten a PDF', action: 'flatten your PDF', cs: true,
    intro: `Stop form fields and annotations from being edited — <strong class="text-on-surface">flatten your PDF</strong> to bake them into the page. It works nicely alongside ${L('watermark', 'watermarking')} or ${L('protect', 'password protection')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF with form fields or annotations you want to lock down.' },
      { icon: 'layers_clear', name: 'Flatten the content', text: 'EraserPro merges interactive fields and annotations into the page content.' },
      { icon: 'download_done', name: 'Download the flattened PDF', text: 'Download a PDF whose fields can no longer be edited.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to flatten it?', a: 'No — flattening runs in your browser, so your document stays private.' },
      { q: 'What does flattening do?', a: 'It converts interactive form fields and annotations into static page content that cannot be edited.' },
      { q: 'Why flatten a PDF?', a: 'To preserve a filled form exactly as it looks and prevent further changes before sharing.' },
      { q: 'Is flattening free?', a: 'Yes, it is free with no watermark.' },
    ],
    illo: { t: 'sym', s: 'flatten' }, illoAlt: 'Illustration of layered PDF form fields being flattened into a single page',
  },

  repair: {
    title: 'Repair PDF Online Free — EraserPro',
    desc: 'Repair a damaged or corrupt PDF online for free. Attempt a best-effort recovery in your browser and download the result.',
    keywords: 'repair pdf, fix corrupt pdf, recover pdf, damaged pdf repair',
    kw: 'Repair a PDF', action: 'repair your PDF', cs: true,
    intro: `Getting errors opening a file? <strong class="text-on-surface">Repair your PDF</strong> with a best-effort recovery that fixes minor structural issues. Once recovered, you can ${L('compress', 'compress it')} or ${L('merge', 'merge it')} with other PDFs.`,
    steps: [
      { icon: 'upload_file', name: 'Upload the damaged PDF', text: 'Add the PDF that is failing to open or behaving oddly.' },
      { icon: 'build', name: 'Attempt recovery', text: 'EraserPro rebuilds and normalizes the PDF structure to fix minor corruption.' },
      { icon: 'download_done', name: 'Download the repaired PDF', text: 'Download the recovered file — many minor issues are resolved automatically.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to repair it?', a: 'No — the repair attempt runs in your browser, so nothing is uploaded.' },
      { q: 'Can it fix any broken PDF?', a: 'It resolves minor structural problems. Severely corrupted files may need a desktop tool like qpdf or Ghostscript.' },
      { q: 'Will my content stay intact?', a: 'Yes — recovery re-saves your existing content; it does not remove pages or data.' },
      { q: 'Is repairing PDFs free?', a: 'Yes, it is free with no watermark or sign-up.' },
    ],
    illo: { t: 'sym', s: 'repair' }, illoAlt: 'Illustration of a damaged PDF being repaired with a wrench',
  },

  // ─────────────── Convert to PDF ───────────────
  'jpg-to-pdf': {
    title: 'JPG to PDF Converter Online Free — EraserPro',
    desc: 'Convert JPG images to PDF online for free. Combine photos into one PDF in your browser and download instantly.',
    keywords: 'jpg to pdf, convert jpg to pdf, image to pdf, jpeg to pdf converter',
    kw: 'JPG to PDF', action: 'convert JPG images to PDF', cs: true,
    intro: `Turn photos into a document — <strong class="text-on-surface">convert JPG to PDF</strong> and combine multiple images into one file. Prefer transparency? Try ${L('png-to-pdf', 'PNG to PDF')}. Going the other way? Use ${L('pdf-to-jpg', 'PDF to JPG')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your JPGs', text: 'Drag in one or more JPG images, or click to select them.' },
      { icon: 'reorder', name: 'Arrange the images', text: 'Reorder the photos so they appear in the sequence you want in the PDF.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Create the PDF and download your images as a single document.' },
    ],
    faqs: [
      { q: 'Are my images uploaded to convert them?', a: 'No — the conversion happens in your browser, so your photos never leave your device.' },
      { q: 'Can I combine several JPGs into one PDF?', a: 'Yes — add multiple images and each becomes a page in one combined PDF.' },
      { q: 'Will image quality be preserved?', a: 'Yes, your JPGs are embedded at full quality into the PDF.' },
      { q: 'Is JPG to PDF free?', a: 'Yes, it is free with no watermark and no sign-up.' },
    ],
    illo: { t: 'conv', a: 'JPG', b: 'PDF' }, illoAlt: 'Illustration showing a JPG image being converted into a PDF document',
  },

  'png-to-pdf': {
    title: 'PNG to PDF Converter Online Free — EraserPro',
    desc: 'Convert PNG images to PDF online for free. Turn transparent PNGs into a clean PDF in your browser and download.',
    keywords: 'png to pdf, convert png to pdf, image to pdf, png to pdf converter',
    kw: 'PNG to PDF', action: 'convert PNG images to PDF', cs: true,
    intro: `Have PNG graphics or screenshots? <strong class="text-on-surface">Convert PNG to PDF</strong> and merge them into a single file. For photos, ${L('jpg-to-pdf', 'JPG to PDF')} is ideal; to reverse it, use ${L('pdf-to-png', 'PDF to PNG')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PNGs', text: 'Add one or more PNG images by dragging them in or selecting them.' },
      { icon: 'reorder', name: 'Order the images', text: 'Arrange the PNGs so they appear in the right order in your PDF.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Generate and download your images as one clean PDF.' },
    ],
    faqs: [
      { q: 'Are my PNGs uploaded to convert them?', a: 'No — conversion runs in your browser, keeping your images private.' },
      { q: 'Can I convert multiple PNGs at once?', a: 'Yes — every PNG you add becomes a page in the resulting PDF.' },
      { q: 'What happens to transparency?', a: 'Transparent areas are rendered onto the PDF page background for a clean result.' },
      { q: 'Is PNG to PDF free?', a: 'Yes, it is completely free with no watermark.' },
    ],
    illo: { t: 'conv', a: 'PNG', b: 'PDF' }, illoAlt: 'Illustration showing a PNG image being converted into a PDF document',
  },

  'text-to-pdf': {
    title: 'Text to PDF Converter Online Free — EraserPro',
    desc: 'Convert TXT or plain text to PDF online for free. Turn text into a formatted PDF in your browser and download.',
    keywords: 'text to pdf, txt to pdf, convert text to pdf, plain text to pdf',
    kw: 'Text to PDF', action: 'convert text to PDF', cs: true,
    intro: `Have notes or a .txt file? <strong class="text-on-surface">Convert text to PDF</strong> to get a clean, shareable document. Working with richer documents? See ${L('word-to-pdf', 'Word to PDF')}, or reverse it with ${L('pdf-to-text', 'PDF to Text')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload or paste text', text: 'Add a .txt file, or paste your text directly into the editor.' },
      { icon: 'format_size', name: 'Pick a font size', text: 'Choose a comfortable font size for your PDF output.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Generate the PDF and download your neatly paginated document.' },
    ],
    faqs: [
      { q: 'Is my text uploaded to convert it?', a: 'No — the PDF is built in your browser, so your text never leaves your device.' },
      { q: 'Can I edit the text before converting?', a: 'Yes — the text loads into an editor where you can tweak it before generating the PDF.' },
      { q: 'Does it handle long text?', a: 'Yes, the text automatically wraps and paginates across as many pages as needed.' },
      { q: 'Is text to PDF free?', a: 'Yes, it is free with no watermark or sign-up.' },
    ],
    illo: { t: 'conv', a: 'TXT', b: 'PDF' }, illoAlt: 'Illustration showing plain text being converted into a PDF document',
  },

  'html-to-pdf': {
    title: 'HTML to PDF Converter Online Free — EraserPro',
    desc: 'Convert an HTML file to PDF online for free. Render your web page to a PDF in your browser and download it.',
    keywords: 'html to pdf, convert html to pdf, webpage to pdf, html file to pdf',
    kw: 'HTML to PDF', action: 'convert HTML to PDF', cs: true,
    intro: `Save a web page or template as a document — <strong class="text-on-surface">convert HTML to PDF</strong> right in your browser. Need the reverse? Use ${L('pdf-to-html', 'PDF to HTML')}. For documents, ${L('word-to-pdf', 'Word to PDF')} may fit better.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your HTML file', text: 'Add the .html file you want to turn into a PDF.' },
      { icon: 'html', name: 'Render the page', text: 'EraserPro renders your HTML content to a printable layout.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Download your web page as a shareable PDF document.' },
    ],
    faqs: [
      { q: 'Is my HTML uploaded to convert it?', a: 'No — the page renders in your browser, so your file never leaves your device.' },
      { q: 'Do external images and CSS load?', a: 'Resources referenced by absolute URLs may load; assets relative to the original site may not. Scripts are ignored for safety.' },
      { q: 'Is the PDF text selectable?', a: 'The page is rendered to a high-quality image-based PDF, ideal for faithful visual output.' },
      { q: 'Is HTML to PDF free?', a: 'Yes, it is free with no watermark.' },
    ],
    illo: { t: 'conv', a: 'HTML', b: 'PDF' }, illoAlt: 'Illustration showing an HTML web page being converted into a PDF document',
  },

  // ─────────────── Convert from PDF ───────────────
  'pdf-to-jpg': {
    title: 'PDF to JPG Converter Online Free — EraserPro',
    desc: 'Convert PDF to JPG images online for free. Turn every page into a JPG in your browser and download them as a ZIP.',
    keywords: 'pdf to jpg, convert pdf to jpg, pdf to image, pdf to jpeg converter',
    kw: 'PDF to JPG', action: 'convert PDF to JPG', cs: true,
    intro: `Need images from a document? <strong class="text-on-surface">Convert PDF to JPG</strong> and get one image per page. Want lossless output? Use ${L('pdf-to-png', 'PDF to PNG')}. Going back the other way? Try ${L('jpg-to-pdf', 'JPG to PDF')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to turn into images.' },
      { icon: 'tune', name: 'Choose quality', text: 'Pick a rendering quality — higher settings produce sharper JPGs.' },
      { icon: 'folder_zip', name: 'Download the images', text: 'Convert and download every page as a JPG, packaged in a ZIP.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to convert it?', a: 'No — pages are rendered to JPG in your browser, so your file stays on your device.' },
      { q: 'How are the images delivered?', a: 'Each page becomes a separate JPG, bundled together in one downloadable ZIP.' },
      { q: 'Can I control the resolution?', a: 'Yes — choose standard, high or very high quality before converting.' },
      { q: 'Is PDF to JPG free?', a: 'Yes, it is free with no watermark or sign-up.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'JPG' }, illoAlt: 'Illustration showing a PDF document being converted into JPG images',
  },

  'pdf-to-png': {
    title: 'PDF to PNG Converter Online Free — EraserPro',
    desc: 'Convert PDF to PNG images online for free. Render each page to a crisp PNG in your browser and download as a ZIP.',
    keywords: 'pdf to png, convert pdf to png, pdf to image, pdf page to png',
    kw: 'PDF to PNG', action: 'convert PDF to PNG', cs: true,
    intro: `Want lossless page images? <strong class="text-on-surface">Convert PDF to PNG</strong> for crisp, high-quality output. For smaller photo-style files, ${L('pdf-to-jpg', 'PDF to JPG')} works well; to reverse, use ${L('png-to-pdf', 'PNG to PDF')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to render into images.' },
      { icon: 'tune', name: 'Choose quality', text: 'Select a rendering quality for the resulting PNG images.' },
      { icon: 'folder_zip', name: 'Download the PNGs', text: 'Convert and download each page as a PNG in a single ZIP.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to convert it?', a: 'No — rendering happens in your browser, keeping your document private.' },
      { q: 'Why choose PNG over JPG?', a: 'PNG is lossless and handles sharp text and graphics crisply, at a larger file size than JPG.' },
      { q: 'How do I get the images?', a: 'Each page is exported as a PNG and delivered together in one ZIP download.' },
      { q: 'Is PDF to PNG free?', a: 'Yes, it is completely free with no watermark.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'PNG' }, illoAlt: 'Illustration showing a PDF document being converted into PNG images',
  },

  'pdf-to-text': {
    title: 'PDF to Text Converter Online Free — EraserPro',
    desc: 'Extract text from a PDF online for free. Pull selectable text (with optional OCR) in your browser and download a TXT.',
    keywords: 'pdf to text, extract text from pdf, pdf to txt, pdf text extractor ocr',
    kw: 'PDF to Text', action: 'extract text from your PDF', cs: true,
    intro: `Need the words out of a document? <strong class="text-on-surface">Convert PDF to text</strong> and even OCR scanned pages. To go the other way, use ${L('text-to-pdf', 'Text to PDF')}; for layout, try ${L('pdf-to-word', 'PDF to Word')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to extract text from.' },
      { icon: 'document_scanner', name: 'Enable OCR if needed', text: 'For scanned or image-only PDFs, turn on OCR to recognize the text.' },
      { icon: 'download_done', name: 'Download the text', text: 'Extract the text and download it as a plain .txt file.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to extract text?', a: 'No — text extraction and OCR both run in your browser, so your file never leaves your device.' },
      { q: 'Can it read scanned PDFs?', a: 'Yes — enable OCR and the tool recognizes text from scanned or image-based pages.' },
      { q: 'What format is the output?', a: 'A plain .txt file containing the extracted text, separated by page.' },
      { q: 'Is PDF to text free?', a: 'Yes, it is free with no watermark or account.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'TXT' }, illoAlt: 'Illustration showing text being extracted from a PDF document into a text file',
  },

  'pdf-to-html': {
    title: 'PDF to HTML Converter Online Free — EraserPro',
    desc: 'Convert PDF to HTML online for free. Turn each page into clean HTML in your browser and download the file.',
    keywords: 'pdf to html, convert pdf to html, pdf to web page, pdf to html online',
    kw: 'PDF to HTML', action: 'convert PDF to HTML', cs: true,
    intro: `Republish a document on the web — <strong class="text-on-surface">convert PDF to HTML</strong> to get clean, structured markup. Need the reverse? Use ${L('html-to-pdf', 'HTML to PDF')}; for raw content, try ${L('pdf-to-text', 'PDF to Text')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to convert into a web page.' },
      { icon: 'code', name: 'Extract the content', text: 'EraserPro pulls each page’s text into a clean HTML structure.' },
      { icon: 'download_done', name: 'Download the HTML', text: 'Download a ready-to-use .html document of your PDF.' },
    ],
    faqs: [
      { q: 'Is my PDF uploaded to convert it?', a: 'No — conversion runs in your browser, so your document stays private.' },
      { q: 'Does it keep the exact layout?', a: 'It extracts text into clean, readable HTML. Complex visual layouts are simplified for the web.' },
      { q: 'What do I get?', a: 'A single .html file with each page as a titled section you can style or publish.' },
      { q: 'Is PDF to HTML free?', a: 'Yes, it is free with no watermark.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'HTML' }, illoAlt: 'Illustration showing a PDF document being converted into an HTML web page',
  },

  // ─────────────── Office conversions (CloudConvert, server-side) ───────────────
  'word-to-pdf': {
    title: 'Word to PDF Converter Online — EraserPro',
    desc: 'Convert Word documents (DOC, DOCX) to PDF online while preserving formatting. Fast, high-fidelity conversion.',
    keywords: 'word to pdf, docx to pdf, convert word to pdf, doc to pdf converter',
    kw: 'Word to PDF', action: 'convert Word documents to PDF', cs: false,
    intro: `Share documents that look identical everywhere — <strong class="text-on-surface">convert Word to PDF</strong> with formatting preserved. Need to edit a PDF back into Word? Use ${L('pdf-to-word', 'PDF to Word')}. For spreadsheets, see ${L('excel-to-pdf', 'Excel to PDF')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your Word file', text: 'Add your .doc or .docx document by dragging it in or selecting it.' },
      { icon: 'sync', name: 'Convert to PDF', text: 'Your document is converted on our secure engine with layout and fonts intact.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Download a pixel-faithful PDF of your Word document.' },
    ],
    faqs: [
      { q: 'How is my document handled?', a: 'It is sent over an encrypted connection to our conversion service and deleted automatically right after processing.' },
      { q: 'Will my formatting be preserved?', a: 'Yes — fonts, images, tables and layout are retained for a faithful PDF.' },
      { q: 'Which Word formats are supported?', a: 'Both legacy .doc and modern .docx files are supported.' },
      { q: 'How many credits does it cost?', a: 'Word to PDF uses 2 credits per conversion. Sign in to see your balance.' },
    ],
    illo: { t: 'conv', a: 'DOC', b: 'PDF' }, illoAlt: 'Illustration showing a Word document being converted into a PDF file',
  },

  'ppt-to-pdf': {
    title: 'PowerPoint to PDF Online — EraserPro',
    desc: 'Convert PowerPoint (PPT, PPTX) slides to PDF online with layouts preserved. Share decks anyone can open.',
    keywords: 'powerpoint to pdf, ppt to pdf, pptx to pdf, convert slides to pdf',
    kw: 'PowerPoint to PDF', action: 'convert PowerPoint slides to PDF', cs: false,
    intro: `Turn a slide deck into a portable file — <strong class="text-on-surface">convert PowerPoint to PDF</strong> so anyone can view it without PowerPoint. To edit slides from a PDF, use ${L('pdf-to-ppt', 'PDF to PowerPoint')}; for documents, see ${L('word-to-pdf', 'Word to PDF')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your slides', text: 'Add your .ppt or .pptx presentation to convert.' },
      { icon: 'sync', name: 'Convert to PDF', text: 'Each slide is rendered to a PDF page on our secure conversion engine.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Download your deck as a shareable, print-ready PDF.' },
    ],
    faqs: [
      { q: 'How is my presentation handled?', a: 'It is uploaded over an encrypted connection to our conversion service and deleted immediately after processing.' },
      { q: 'Are animations included?', a: 'PDFs are static, so each slide becomes a page; animations and transitions are not preserved.' },
      { q: 'Which formats work?', a: 'Both .ppt and .pptx presentations are supported.' },
      { q: 'How many credits does it cost?', a: 'PowerPoint to PDF uses 2 credits per conversion.' },
    ],
    illo: { t: 'conv', a: 'PPT', b: 'PDF' }, illoAlt: 'Illustration showing a PowerPoint presentation being converted into a PDF file',
  },

  'excel-to-pdf': {
    title: 'Excel to PDF Converter Online — EraserPro',
    desc: 'Convert Excel spreadsheets (XLS, XLSX) to PDF online with tables intact. Share reports anyone can open.',
    keywords: 'excel to pdf, xlsx to pdf, convert spreadsheet to pdf, xls to pdf',
    kw: 'Excel to PDF', action: 'convert Excel spreadsheets to PDF', cs: false,
    intro: `Share reports without breaking the layout — <strong class="text-on-surface">convert Excel to PDF</strong> and keep your tables tidy. Need editable data back from a PDF? Use ${L('pdf-to-excel', 'PDF to Excel')}. For documents, try ${L('word-to-pdf', 'Word to PDF')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your spreadsheet', text: 'Add your .xls or .xlsx file by dragging it in or selecting it.' },
      { icon: 'sync', name: 'Convert to PDF', text: 'Your sheets are rendered to PDF pages with tables and formatting preserved.' },
      { icon: 'download_done', name: 'Download the PDF', text: 'Download a clean, shareable PDF of your spreadsheet.' },
    ],
    faqs: [
      { q: 'How is my spreadsheet handled?', a: 'It is sent over an encrypted connection to our conversion engine and deleted right after processing.' },
      { q: 'Will my tables stay aligned?', a: 'Yes — cell formatting, borders and layout are preserved in the PDF.' },
      { q: 'Which Excel formats are supported?', a: 'Both .xls and .xlsx spreadsheets are supported.' },
      { q: 'How many credits does it cost?', a: 'Excel to PDF uses 2 credits per conversion.' },
    ],
    illo: { t: 'conv', a: 'XLS', b: 'PDF' }, illoAlt: 'Illustration showing an Excel spreadsheet being converted into a PDF file',
  },

  'pdf-to-word': {
    title: 'PDF to Word Converter Online — EraserPro',
    desc: 'Convert PDF to editable Word (DOCX) online with layout preserved. Turn PDFs back into editable documents.',
    keywords: 'pdf to word, pdf to docx, convert pdf to word, pdf to editable word',
    kw: 'PDF to Word', action: 'convert PDF to Word', cs: false,
    intro: `Need to edit a PDF? <strong class="text-on-surface">Convert PDF to Word</strong> and get an editable .docx with the layout intact. To go back, use ${L('word-to-pdf', 'Word to PDF')}; for spreadsheets, see ${L('pdf-to-excel', 'PDF to Excel')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to make editable.' },
      { icon: 'sync', name: 'Convert to Word', text: 'Our engine reconstructs the text and layout into an editable Word document.' },
      { icon: 'download_done', name: 'Download the DOCX', text: 'Download an editable .docx you can open in Word.' },
    ],
    faqs: [
      { q: 'How is my PDF handled?', a: 'It is uploaded over an encrypted connection to our conversion service and deleted immediately after processing.' },
      { q: 'How accurate is the conversion?', a: 'Reconstructing an editable layout from a PDF is inherently approximate, but modern engines retain most formatting.' },
      { q: 'What if my PDF is scanned?', a: 'Scanned, image-only PDFs convert best when they contain a recognizable text layer.' },
      { q: 'How many credits does it cost?', a: 'PDF to Word uses 4 credits per conversion.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'DOC' }, illoAlt: 'Illustration showing a PDF being converted into an editable Word document',
  },

  'pdf-to-ppt': {
    title: 'PDF to PowerPoint Online — EraserPro',
    desc: 'Convert PDF to editable PowerPoint (PPTX) online. Turn a PDF back into slides you can edit and present.',
    keywords: 'pdf to powerpoint, pdf to pptx, convert pdf to slides, pdf to ppt',
    kw: 'PDF to PowerPoint', action: 'convert PDF to PowerPoint', cs: false,
    intro: `Rebuild a deck from a document — <strong class="text-on-surface">convert PDF to PowerPoint</strong> and get editable slides. To export slides as PDF, use ${L('ppt-to-pdf', 'PowerPoint to PDF')}; for text, see ${L('pdf-to-word', 'PDF to Word')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF you want to turn into a presentation.' },
      { icon: 'sync', name: 'Convert to slides', text: 'Each page is converted into an editable PowerPoint slide.' },
      { icon: 'download_done', name: 'Download the PPTX', text: 'Download an editable .pptx you can open in PowerPoint.' },
    ],
    faqs: [
      { q: 'How is my PDF handled?', a: 'It is sent over an encrypted connection to our conversion engine and deleted right after processing.' },
      { q: 'How editable are the slides?', a: 'Pages are reconstructed into slides; results vary with how the original PDF was created.' },
      { q: 'Does one page equal one slide?', a: 'Generally yes — each PDF page maps to a slide in the presentation.' },
      { q: 'How many credits does it cost?', a: 'PDF to PowerPoint uses 4 credits per conversion.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'PPT' }, illoAlt: 'Illustration showing a PDF being converted into editable PowerPoint slides',
  },

  'pdf-to-excel': {
    title: 'PDF to Excel Converter Online — EraserPro',
    desc: 'Convert PDF tables to editable Excel (XLSX) online. Extract data from a PDF into a spreadsheet you can edit.',
    keywords: 'pdf to excel, pdf to xlsx, convert pdf to spreadsheet, extract pdf tables',
    kw: 'PDF to Excel', action: 'convert PDF to Excel', cs: false,
    intro: `Get your data back into cells — <strong class="text-on-surface">convert PDF to Excel</strong> and extract tables into an editable spreadsheet. To export a sheet as PDF, use ${L('excel-to-pdf', 'Excel to PDF')}; for documents, see ${L('pdf-to-word', 'PDF to Word')}.`,
    steps: [
      { icon: 'upload_file', name: 'Upload your PDF', text: 'Add the PDF containing the tables you want to extract.' },
      { icon: 'sync', name: 'Convert to Excel', text: 'Our engine detects tables and rebuilds them into spreadsheet cells.' },
      { icon: 'download_done', name: 'Download the XLSX', text: 'Download an editable .xlsx you can open in Excel.' },
    ],
    faqs: [
      { q: 'How is my PDF handled?', a: 'It is uploaded over an encrypted connection to our conversion service and deleted immediately after processing.' },
      { q: 'How well are tables detected?', a: 'Clearly structured tables convert best; complex or borderless layouts may need minor cleanup.' },
      { q: 'What format do I get?', a: 'An editable .xlsx spreadsheet with your data laid out in rows and columns.' },
      { q: 'How many credits does it cost?', a: 'PDF to Excel uses 4 credits per conversion.' },
    ],
    illo: { t: 'conv', a: 'PDF', b: 'XLS' }, illoAlt: 'Illustration showing a PDF table being converted into an editable Excel spreadsheet',
  },
};
