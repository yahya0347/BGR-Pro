/* pdf-tools.js — Phase 1 client-side PDF processing (pdf-lib + JSZip).
 * Runs 100% in the browser: no upload, no backend, no cost. Activated per page
 * by document.body[data-tool]. Non-Phase-1 tools are left as UI shells.
 *
 * DOM contract (see generate-pdf-pages.mjs):
 *   body[data-tool="<slug>"]
 *   #pdfDropWrap   — wrapper around the dropzone (hidden once files are chosen)
 *   #pdfDropzone   — the <label> dropzone (drag/drop target)
 *   #pdfFileInput  — the <input type=file> inside it
 *   #pdfToolStage  — empty container where options/processing/result render
 */
(function () {
  const slug = document.body.getAttribute('data-tool');
  const stage = document.getElementById('pdfToolStage');
  const input = document.getElementById('pdfFileInput');
  const dropWrap = document.getElementById('pdfDropWrap');
  const dropzone = document.getElementById('pdfDropzone');
  if (!slug || !stage || !input || !dropWrap) return;
  if (!window.PDFLib) return; // library missing → leave shell untouched

  const { PDFDocument, StandardFonts, degrees, rgb } = window.PDFLib;

  // ---- helpers ----------------------------------------------------------
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };
  const fmtBytes = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

  function download(data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Parse "1,3-5" into ordered 1-based page numbers, validated against total.
  function parsePages(str, total, { ordered = false } = {}) {
    if (!str || !str.trim()) throw new Error('Please enter at least one page (e.g. 1, 3-5).');
    const out = [];
    for (const part of str.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a < 1 || b < 1 || a > total || b > total) throw new Error(`Pages must be between 1 and ${total}.`);
        const step = a <= b ? 1 : -1;
        for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i);
      } else if (/^\d+$/.test(p)) {
        const n = +p;
        if (n < 1 || n > total) throw new Error(`Page ${n} is out of range (1–${total}).`);
        out.push(n);
      } else {
        throw new Error(`"${p}" isn't a valid page or range.`);
      }
    }
    if (!out.length) throw new Error('No valid pages found.');
    return ordered ? out : [...new Set(out)].sort((a, b) => a - b);
  }

  async function loadPdf(file) {
    const buf = await file.arrayBuffer();
    try {
      return await PDFDocument.load(buf);
    } catch (e) {
      if (/encrypt/i.test(e.message || '')) throw new Error('This PDF is password-protected. Use the Unlock tool first.');
      throw new Error('Couldn\'t read this PDF — it may be corrupted or not a valid PDF.');
    }
  }

  // ---- tool definitions -------------------------------------------------
  // Each: { multiple, title(btn), options(ctx)->node, run(ctx)->{data,filename,mime,note} }
  const TOOLS = {
    merge: {
      multiple: true, btn: 'Merge & Download',
      options: (ctx) => renderFileList(ctx),
      run: async ({ files }) => {
        if (files.length < 2) throw new Error('Add at least two PDF files to merge.');
        const out = await PDFDocument.create();
        for (const f of files) {
          const src = await loadPdf(f);
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        }
        return { data: await out.save(), filename: 'merged.pdf' };
      },
    },

    split: {
      btn: 'Split & Download (ZIP)',
      options: (ctx) => {
        const mode = el('select', { id: 'optSplitMode', class: selCls });
        mode.append(el('option', { value: 'each' }, 'Every page → separate PDFs'),
                    el('option', { value: 'ranges' }, 'Custom ranges (each range → one PDF)'));
        const ranges = el('input', { id: 'optRanges', class: inpCls, placeholder: 'e.g. 1-3, 4-6, 7' });
        const rangeRow = field('Ranges', ranges);
        rangeRow.style.display = 'none';
        mode.addEventListener('change', () => { rangeRow.style.display = mode.value === 'ranges' ? '' : 'none'; });
        return wrap(field('Split mode', mode), rangeRow);
      },
      run: async ({ files }) => {
        const src = await loadPdf(files[0]);
        const total = src.getPageCount();
        const mode = document.getElementById('optSplitMode').value;
        const zip = new JSZip();
        const base = files[0].name.replace(/\.pdf$/i, '');
        if (mode === 'each') {
          for (let i = 0; i < total; i++) {
            const d = await PDFDocument.create();
            const [pg] = await d.copyPages(src, [i]);
            d.addPage(pg);
            zip.file(`${base}_page_${i + 1}.pdf`, await d.save());
          }
        } else {
          const str = document.getElementById('optRanges').value;
          const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
          if (!parts.length) throw new Error('Enter at least one range, e.g. 1-3, 4-6.');
          let idx = 1;
          for (const part of parts) {
            const nums = parsePages(part, total, { ordered: true });
            const d = await PDFDocument.create();
            const pgs = await d.copyPages(src, nums.map((n) => n - 1));
            pgs.forEach((p) => d.addPage(p));
            zip.file(`${base}_part_${idx++}.pdf`, await d.save());
          }
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        return { data: blob, filename: `${base}_split.zip`, mime: 'application/zip' };
      },
    },

    rotate: {
      btn: 'Rotate & Download',
      options: () => {
        const angle = el('select', { id: 'optAngle', class: selCls });
        angle.append(el('option', { value: '90' }, '90° clockwise'),
                     el('option', { value: '180' }, '180°'),
                     el('option', { value: '270' }, '270° (90° counter-clockwise)'));
        const pages = el('input', { id: 'optPages', class: inpCls, placeholder: 'Leave blank for all pages, or e.g. 1,3-5' });
        return wrap(field('Rotation', angle), field('Pages', pages));
      },
      run: async ({ files }) => {
        const doc = await loadPdf(files[0]);
        const total = doc.getPageCount();
        const add = +document.getElementById('optAngle').value;
        const spec = document.getElementById('optPages').value.trim();
        const targets = spec ? parsePages(spec, total) : Array.from({ length: total }, (_, i) => i + 1);
        for (const n of targets) {
          const page = doc.getPage(n - 1);
          const cur = page.getRotation().angle || 0;
          page.setRotation(degrees((cur + add) % 360));
        }
        return { data: await doc.save(), filename: files[0].name.replace(/\.pdf$/i, '') + '_rotated.pdf' };
      },
    },

    'delete-pages': {
      btn: 'Delete Pages & Download',
      options: () => wrap(field('Pages to delete', el('input', { id: 'optPages', class: inpCls, placeholder: 'e.g. 2, 4-6' }))),
      run: async ({ files }) => {
        const doc = await loadPdf(files[0]);
        const total = doc.getPageCount();
        const del = parsePages(document.getElementById('optPages').value, total);
        if (del.length >= total) throw new Error('You can\'t delete every page — at least one must remain.');
        [...del].sort((a, b) => b - a).forEach((n) => doc.removePage(n - 1));
        return { data: await doc.save(), filename: files[0].name.replace(/\.pdf$/i, '') + '_edited.pdf' };
      },
    },

    'extract-pages': {
      btn: 'Extract & Download',
      options: () => wrap(field('Pages to extract (in order)', el('input', { id: 'optPages', class: inpCls, placeholder: 'e.g. 1,3,5-7' }))),
      run: async ({ files }) => {
        const src = await loadPdf(files[0]);
        const total = src.getPageCount();
        const nums = parsePages(document.getElementById('optPages').value, total, { ordered: true });
        const out = await PDFDocument.create();
        const pgs = await out.copyPages(src, nums.map((n) => n - 1));
        pgs.forEach((p) => out.addPage(p));
        return { data: await out.save(), filename: files[0].name.replace(/\.pdf$/i, '') + '_extracted.pdf' };
      },
    },

    reorder: {
      btn: 'Apply Order & Download',
      options: (ctx) => renderReorder(ctx),
      run: async ({ files, order }) => {
        if (!order || !order.length) throw new Error('Waiting for page thumbnails to load — try again in a moment.');
        const src = await loadPdf(files[0]);
        const out = await PDFDocument.create();
        const pgs = await out.copyPages(src, order.map((n) => n - 1));
        pgs.forEach((p) => out.addPage(p));
        return { data: await out.save(), filename: files[0].name.replace(/\.pdf$/i, '') + '_reordered.pdf' };
      },
    },

    'page-numbers': {
      btn: 'Add Numbers & Download',
      options: () => {
        const pos = el('select', { id: 'optPos', class: selCls });
        [['bc', 'Bottom center'], ['br', 'Bottom right'], ['bl', 'Bottom left'],
         ['tc', 'Top center'], ['tr', 'Top right'], ['tl', 'Top left']]
          .forEach(([v, t]) => pos.append(el('option', { value: v }, t)));
        const start = el('input', { id: 'optStart', class: inpCls, type: 'number', value: '1', min: '0' });
        const fmt = el('select', { id: 'optFmt', class: selCls });
        fmt.append(el('option', { value: 'n' }, '1'), el('option', { value: 'nofN' }, '1 of N'), el('option', { value: 'pageN' }, 'Page 1'));
        return wrap(field('Position', pos), field('Start at', start), field('Style', fmt));
      },
      run: async ({ files }) => {
        const doc = await loadPdf(files[0]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pos = document.getElementById('optPos').value;
        const start = parseInt(document.getElementById('optStart').value, 10) || 0;
        const fmt = document.getElementById('optFmt').value;
        const pages = doc.getPages();
        const total = pages.length;
        const size = 11, margin = 28;
        pages.forEach((page, i) => {
          const num = start + i;
          const text = fmt === 'nofN' ? `${num} of ${start + total - 1}` : fmt === 'pageN' ? `Page ${num}` : `${num}`;
          const { width, height } = page.getSize();
          const tw = font.widthOfTextAtSize(text, size);
          let x = margin, y = margin;
          if (pos[1] === 'c') x = (width - tw) / 2;
          if (pos[1] === 'r') x = width - tw - margin;
          if (pos[0] === 't') y = height - margin;
          page.drawText(text, { x, y, size, font, color: rgb(0.29, 0.27, 0.33) });
        });
        return { data: await doc.save(), filename: files[0].name.replace(/\.pdf$/i, '') + '_numbered.pdf' };
      },
    },

    crop: {
      btn: 'Crop & Download',
      options: () => {
        const mk = (id) => el('input', { id, class: inpCls, type: 'number', value: '0', min: '0' });
        return wrap(
          el('p', { class: 'text-body-md text-on-surface-variant mb-1' }, 'Trim margins in points (72 pt = 1 inch).'),
          el('div', { class: 'grid grid-cols-2 gap-3' },
            field('Top', mk('optTop')), field('Right', mk('optRight')),
            field('Bottom', mk('optBottom')), field('Left', mk('optLeft'))),
        );
      },
      run: async ({ files }) => {
        const doc = await loadPdf(files[0]);
        const g = (id) => Math.max(0, parseFloat(document.getElementById(id).value) || 0);
        const t = g('optTop'), r = g('optRight'), b = g('optBottom'), l = g('optLeft');
        if (!(t || r || b || l)) throw new Error('Enter a margin on at least one side.');
        for (const page of doc.getPages()) {
          const box = page.getMediaBox ? page.getMediaBox() : { x: 0, y: 0, ...page.getSize() };
          const w = box.width - l - r, h = box.height - t - b;
          if (w <= 0 || h <= 0) throw new Error('Margins are larger than the page. Use smaller values.');
          page.setCropBox(box.x + l, box.y + b, w, h);
        }
        return { data: await doc.save(), filename: files[0].name.replace(/\.pdf$/i, '') + '_cropped.pdf' };
      },
    },

    compress: {
      btn: 'Compress & Download',
      options: () => wrap(el('p', { class: 'text-body-md text-on-surface-variant' },
        'Optimizes the PDF structure (object streams). Best for PDFs heavy on form/vector data; image-heavy scans compress little.')),
      run: async ({ files }) => {
        const before = files[0].size;
        const doc = await loadPdf(files[0]);
        const out = await doc.save({ useObjectStreams: true });
        const after = out.byteLength;
        const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
        const note = pct > 0
          ? `Reduced ${fmtBytes(before)} → ${fmtBytes(after)} (${pct}% smaller).`
          : `This PDF was already well optimized (${fmtBytes(before)} → ${fmtBytes(after)}).`;
        return { data: out, filename: files[0].name.replace(/\.pdf$/i, '') + '_compressed.pdf', note };
      },
    },
  };

  const tool = TOOLS[slug];
  if (!tool) return; // Phase 2/3 tool → leave the UI shell as-is

  // ---- shared UI styles (Tailwind classes already in the page) ----------
  const inpCls = 'w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
  const selCls = inpCls + ' appearance-none';
  const btnCls = 'bg-gradient-to-r from-primary to-secondary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md shadow-md hover:scale-105 active:scale-95 transition-transform inline-flex items-center gap-2';
  function field(label, control) {
    return el('label', { class: 'flex flex-col gap-1 text-left' },
      el('span', { class: 'font-label-md text-label-md text-on-surface-variant uppercase tracking-wide' }, label), control);
  }
  function wrap(...kids) { return el('div', { class: 'flex flex-col gap-4' }, ...kids); }

  // ---- state machine ----------------------------------------------------
  const ctx = { files: [], order: null };

  function collect(fileList) {
    const arr = Array.from(fileList).filter(isPdf);
    if (!arr.length) { showError('Please choose a PDF file.'); return; }
    ctx.files = tool.multiple ? ctx.files.concat(arr) : [arr[0]];
    showOptions();
  }

  input.addEventListener('change', () => { if (input.files.length) collect(input.files); });
  ['dragover', 'dragenter'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('ring-2', 'ring-primary'); }));
  ['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('ring-2', 'ring-primary'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) collect(e.dataTransfer.files); });

  function clearStage() { stage.innerHTML = ''; }
  function showError(msg, keepStage) {
    if (!keepStage) clearStage();
    const box = el('div', { class: 'glass-card rounded-xl p-4 flex items-start gap-3 border border-error/30 text-left' },
      el('span', { class: 'material-symbols-outlined text-error' }, 'error'),
      el('p', { class: 'text-body-md text-on-surface' }, msg));
    stage.prepend(box);
  }

  function showOptions() {
    dropWrap.style.display = 'none';
    clearStage();
    const card = el('div', { class: 'glass-card rounded-xl p-6 flex flex-col gap-5 text-left' });
    card.append(tool.options(ctx));
    const actions = el('div', { class: 'flex items-center justify-between gap-3 pt-1' },
      el('button', { class: 'text-on-surface-variant hover:text-primary font-label-md text-label-md inline-flex items-center gap-1', onclick: reset },
        el('span', { class: 'material-symbols-outlined text-[18px]' }, 'restart_alt'), 'Start over'),
      el('button', { id: 'pdfProcessBtn', class: btnCls, onclick: process }, tool.btn));
    card.append(actions);
    stage.append(card);
  }

  function showProcessing() {
    // Hide (don't destroy) the options so tool.run can still read its inputs.
    [...stage.children].forEach((c) => { c.style.display = 'none'; });
    stage.append(el('div', { class: 'glass-card rounded-xl p-10 flex flex-col items-center gap-4' },
      el('div', { class: 'pdf-spinner' }),
      el('p', { class: 'font-headline-sm text-headline-sm text-on-surface' }, 'Working on your PDF…'),
      el('p', { class: 'text-body-md text-on-surface-variant' }, 'Everything runs privately in your browser.')));
  }

  function showResult({ filename, note }) {
    clearStage();
    stage.append(el('div', { class: 'glass-card rounded-xl p-8 flex flex-col items-center gap-4 text-center' },
      el('div', { class: 'w-14 h-14 rounded-full bg-primary-container/20 border border-primary-container/30 flex items-center justify-center' },
        el('span', { class: 'material-symbols-outlined text-primary text-[30px]', style: "font-variation-settings:'FILL' 1;" }, 'task_alt')),
      el('p', { class: 'font-headline-sm text-headline-sm text-on-surface' }, 'Done!'),
      note ? el('p', { class: 'text-body-md text-on-surface-variant' }, note) : null,
      el('p', { class: 'text-body-md text-on-surface-variant' }, 'Your file "' + filename + '" was downloaded.'),
      el('button', { class: 'mt-2 text-primary font-label-md text-label-md inline-flex items-center gap-1', onclick: reset },
        el('span', { class: 'material-symbols-outlined text-[18px]' }, 'restart_alt'), 'Process another file')));
  }

  async function process() {
    showProcessing();
    try {
      const result = await tool.run(ctx);
      download(result.data, result.filename, result.mime);
      showResult(result);
    } catch (e) {
      console.error(e);
      showError(e.message || 'Something went wrong while processing your PDF.');
      const retry = el('button', { class: 'mt-3 ' + btnCls, onclick: showOptions }, 'Back to options');
      stage.append(retry);
    }
  }

  function reset() {
    ctx.files = []; ctx.order = null; input.value = '';
    dropWrap.style.display = '';
    clearStage();
  }

  // ---- merge: reorderable file list ------------------------------------
  function renderFileList(context) {
    const list = el('div', { class: 'flex flex-col gap-2' });
    const rerender = () => {
      list.innerHTML = '';
      context.files.forEach((f, i) => {
        list.append(el('div', { class: 'flex items-center gap-3 bg-surface-container-low rounded-lg p-3 border border-outline-variant/30' },
          el('span', { class: 'material-symbols-outlined text-error' }, 'picture_as_pdf'),
          el('div', { class: 'flex-1 min-w-0' },
            el('p', { class: 'text-body-md font-medium truncate' }, f.name),
            el('p', { class: 'font-label-md text-label-md text-on-surface-variant' }, fmtBytes(f.size))),
          iconBtn('arrow_upward', i === 0, () => { swap(i, i - 1); rerender(); }),
          iconBtn('arrow_downward', i === context.files.length - 1, () => { swap(i, i + 1); rerender(); }),
          iconBtn('close', false, () => { context.files.splice(i, 1); rerender(); })));
      });
      const add = el('button', { class: 'text-primary font-label-md text-label-md inline-flex items-center gap-1 mt-1', onclick: () => input.click() },
        el('span', { class: 'material-symbols-outlined text-[18px]' }, 'add'), 'Add more PDFs');
      list.append(add);
    };
    const swap = (a, b) => { const t = context.files[a]; context.files[a] = context.files[b]; context.files[b] = t; };
    rerender();
    // keep list live as user adds more
    input.addEventListener('change', rerender);
    return wrap(el('p', { class: 'text-body-md text-on-surface-variant' }, 'Files merge in this order — use the arrows to rearrange.'), list);
  }
  function iconBtn(icon, disabled, onclick) {
    return el('button', { class: 'p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high disabled:opacity-30', disabled: disabled || false, onclick },
      el('span', { class: 'material-symbols-outlined text-[20px]' }, icon));
  }

  // ---- reorder: drag-and-drop thumbnails (pdf.js) ----------------------
  function renderReorder(context) {
    const holder = el('div', { class: 'flex flex-col gap-3' });
    const grid = el('div', { class: 'grid grid-cols-3 sm:grid-cols-4 gap-3' });
    holder.append(el('p', { class: 'text-body-md text-on-surface-variant' }, 'Drag the page thumbnails to reorder, then download.'), grid);
    context.order = [];
    if (!window.pdfjsLib) {
      grid.append(el('p', { class: 'text-body-md text-error col-span-full' }, 'Thumbnail renderer failed to load. Please refresh.'));
      return holder;
    }
    (async () => {
      try {
        const buf = await context.files[0].arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        context.order = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const vp = page.getViewport({ scale: 0.3 });
          const canvas = el('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          const tile = el('div', {
            class: 'relative rounded-lg border-2 border-outline-variant/40 bg-white overflow-hidden cursor-grab active:cursor-grabbing hover:border-primary transition-colors',
            draggable: 'true', 'data-page': String(n),
          });
          tile.append(canvas, el('span', { class: 'absolute bottom-1 right-1 bg-primary text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full' }, String(n)));
          wireDnd(tile, grid, context);
          grid.append(tile);
        }
      } catch (e) {
        grid.append(el('p', { class: 'text-body-md text-error col-span-full' }, 'Could not render this PDF\'s pages.'));
      }
    })();
    return holder;
  }
  function wireDnd(tile, grid, context) {
    tile.addEventListener('dragstart', (e) => { tile.classList.add('opacity-40'); e.dataTransfer.setData('text/plain', tile.dataset.page); });
    tile.addEventListener('dragend', () => { tile.classList.remove('opacity-40'); syncOrder(grid, context); });
    tile.addEventListener('dragover', (e) => e.preventDefault());
    tile.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragged = grid.querySelector('.opacity-40');
      if (!dragged || dragged === tile) return;
      const tiles = [...grid.children];
      if (tiles.indexOf(dragged) < tiles.indexOf(tile)) tile.after(dragged); else tile.before(dragged);
      syncOrder(grid, context);
    });
  }
  function syncOrder(grid, context) {
    context.order = [...grid.children].filter((c) => c.dataset && c.dataset.page).map((c) => +c.dataset.page);
  }

  // spinner CSS (scoped, injected once)
  const style = el('style', {}, `.pdf-spinner{width:42px;height:42px;border-radius:50%;border:4px solid rgba(99,14,212,.15);border-top-color:#630ed4;animation:pdfspin .8s linear infinite}@keyframes pdfspin{to{transform:rotate(360deg)}}`);
  document.head.append(style);
})();
