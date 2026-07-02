// Single source of truth for every PDF Hub tool page.
// scripts/generate-pdf-pages.mjs consumes this to emit pdf/<slug>.html.
// Fields per tool: slug, category, name, icon (Material Symbol), description
// (one-liner matching the home cards' tone), formatNote (dropzone hint),
// accept (file-input MIME/ext list for the hidden picker).

export const pdfTools = [
  // ---- Convert to PDF -----------------------------------------------------
  { slug: 'jpg-to-pdf',   category: 'Convert to PDF', name: 'JPG to PDF',        icon: 'image',        description: 'Convert JPG images into a single, shareable PDF document.',      formatNote: 'JPG images only, max 10MB per file',            accept: 'image/jpeg' },
  { slug: 'png-to-pdf',   category: 'Convert to PDF', name: 'PNG to PDF',        icon: 'photo_library', description: 'Turn PNG images into a clean, high-quality PDF file.',           formatNote: 'PNG images only, max 10MB per file',            accept: 'image/png' },
  { slug: 'word-to-pdf',  category: 'Convert to PDF', name: 'Word to PDF',       icon: 'description',  description: 'Convert Word documents to PDF while preserving formatting.',      formatNote: 'Word files (.doc, .docx) only, max 10MB',       accept: '.doc,.docx' },
  { slug: 'ppt-to-pdf',   category: 'Convert to PDF', name: 'PowerPoint to PDF', icon: 'slideshow',    description: 'Turn PowerPoint slides into a portable PDF deck.',                formatNote: 'PowerPoint files (.ppt, .pptx) only, max 10MB', accept: '.ppt,.pptx' },
  { slug: 'excel-to-pdf', category: 'Convert to PDF', name: 'Excel to PDF',      icon: 'table_chart',  description: 'Convert Excel spreadsheets into tidy PDF documents.',             formatNote: 'Excel files (.xls, .xlsx) only, max 10MB',      accept: '.xls,.xlsx' },
  { slug: 'html-to-pdf',  category: 'Convert to PDF', name: 'HTML to PDF',       icon: 'code',         description: 'Save any HTML page as a pixel-accurate PDF.',                     formatNote: 'HTML files only, max 10MB',                     accept: 'text/html,.html,.htm' },
  { slug: 'text-to-pdf',  category: 'Convert to PDF', name: 'Text to PDF',       icon: 'text_fields',  description: 'Convert plain text files into formatted PDF documents.',          formatNote: 'Text files (.txt) only, max 10MB',              accept: 'text/plain,.txt' },

  // ---- Convert from PDF ---------------------------------------------------
  { slug: 'pdf-to-jpg',   category: 'Convert from PDF', name: 'PDF to JPG',        icon: 'picture_as_pdf', description: 'Extract every PDF page as a high-resolution JPG image.',   formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'pdf-to-png',   category: 'Convert from PDF', name: 'PDF to PNG',        icon: 'image',          description: 'Convert PDF pages into crisp, transparent-ready PNGs.',    formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'pdf-to-word',  category: 'Convert from PDF', name: 'PDF to Word',       icon: 'description',    description: 'Turn PDFs into editable Word documents with layout intact.', formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'pdf-to-ppt',   category: 'Convert from PDF', name: 'PDF to PowerPoint', icon: 'slideshow',      description: 'Convert PDF pages into editable PowerPoint slides.',       formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'pdf-to-excel', category: 'Convert from PDF', name: 'PDF to Excel',      icon: 'table_chart',    description: 'Extract tables from PDFs straight into Excel sheets.',     formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'pdf-to-text',  category: 'Convert from PDF', name: 'PDF to Text',       icon: 'text_snippet',   description: 'Pull clean, editable text out of any PDF file.',           formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'pdf-to-html',  category: 'Convert from PDF', name: 'PDF to HTML',       icon: 'code',           description: 'Convert PDF documents into responsive HTML pages.',        formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },

  // ---- Organize & Edit ----------------------------------------------------
  { slug: 'merge',         category: 'Organize & Edit', name: 'Merge PDF',      icon: 'merge',        description: 'Combine multiple PDF files into one organized document.', formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'split',         category: 'Organize & Edit', name: 'Split PDF',      icon: 'call_split',   description: 'Split a PDF into separate files or page ranges.',         formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'compress',      category: 'Organize & Edit', name: 'Compress PDF',   icon: 'compress',     description: 'Shrink PDF file size without losing visible quality.',    formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'rotate',        category: 'Organize & Edit', name: 'Rotate PDF',     icon: 'rotate_right', description: 'Rotate PDF pages to the correct orientation in seconds.', formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'delete-pages',  category: 'Organize & Edit', name: 'Delete Pages',   icon: 'delete_sweep', description: 'Remove unwanted pages from your PDF instantly.',          formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'extract-pages', category: 'Organize & Edit', name: 'Extract Pages',  icon: 'content_copy', description: 'Pull selected pages out into a brand-new PDF.',           formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'reorder',       category: 'Organize & Edit', name: 'Reorder Pages',  icon: 'reorder',      description: 'Drag and drop to reorder pages exactly how you want.',    formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'page-numbers',  category: 'Organize & Edit', name: 'Add Page Numbers', icon: 'pin',        description: 'Insert clean, customizable page numbers into any PDF.',   formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'crop',          category: 'Organize & Edit', name: 'Crop PDF',       icon: 'crop',         description: 'Trim margins and crop PDF pages to size.',                formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },

  // ---- Security & Signing -------------------------------------------------
  { slug: 'protect',   category: 'Security & Signing', name: 'Protect PDF',   icon: 'lock',              description: 'Add a password and encryption to secure your PDF.',       formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'unlock',    category: 'Security & Signing', name: 'Unlock PDF',    icon: 'lock_open',         description: 'Remove passwords from PDFs you have the rights to.',      formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'esign',     category: 'Security & Signing', name: 'eSign PDF',     icon: 'draw',              description: 'Sign PDFs electronically with a legally binding signature.', formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'watermark', category: 'Security & Signing', name: 'Watermark PDF', icon: 'branding_watermark', description: 'Stamp text or image watermarks across your PDF.',        formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'redact',    category: 'Security & Signing', name: 'Redact PDF',    icon: 'ink_highlighter',   description: 'Permanently black out sensitive text and information.',   formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'flatten',   category: 'Security & Signing', name: 'Flatten PDF',   icon: 'layers',            description: 'Flatten form fields and annotations into the page.',      formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
  { slug: 'repair',    category: 'Security & Signing', name: 'Repair PDF',    icon: 'build',             description: 'Recover and repair damaged or corrupted PDF files.',      formatNote: 'PDF files only, max 10MB per file', accept: 'application/pdf' },
];
