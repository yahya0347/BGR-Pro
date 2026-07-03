/* pdf-convert.js — client for the Office⇆PDF tools (Phase 3).
 * Talks to /api/convert (CloudConvert), gated by the same Firebase auth +
 * credit system as the main app. Loaded only on the 6 Office pages, alongside
 * the Firebase compat SDK. Reuses the shared page DOM (#pdfDropWrap etc.).
 */
(function () {
  const slug = document.body.getAttribute('data-tool');
  const stage = document.getElementById('pdfToolStage');
  const input = document.getElementById('pdfFileInput');
  const dropWrap = document.getElementById('pdfDropWrap');
  const dropzone = document.getElementById('pdfDropzone');
  if (!slug || !stage || !input || !dropWrap) return;

  const COST = { 'word-to-pdf': 2, 'ppt-to-pdf': 2, 'excel-to-pdf': 2, 'pdf-to-word': 4, 'pdf-to-ppt': 4, 'pdf-to-excel': 4 };
  const cost = COST[slug];
  if (cost == null) return;

  // ── Firebase (compat) — shares the signed-in session from the main app ──
  const firebaseConfig = window.firebaseConfig || {
    apiKey: 'AIzaSyByiFnvrKM2W8mfd6GJmjyAuSGqF0MPEsQ',
    authDomain: 'bg-eraser-pro-64137.firebaseapp.com',
    projectId: 'bg-eraser-pro-64137',
    storageBucket: 'bg-eraser-pro-64137.firebasestorage.app',
    messagingSenderId: '881998487714',
    appId: '1:881998487714:web:a1b39d4784ef2c8ff8b7fb',
  };
  let authUser = null, authReady;
  if (window.firebase && firebase.auth) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    authReady = new Promise((res) => auth.onAuthStateChanged((u) => { authUser = u; res(u); }));
  } else {
    authReady = Promise.resolve(null); // SDK missing → treated as signed-out
  }

  // ── tiny DOM helper ─────────────────────────────────────────────────────
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) n.setAttribute(k, v);
    }
    kids.forEach((c) => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  };
  const card = (...k) => el('div', { class: 'glass-card rounded-xl p-6 flex flex-col items-center gap-4 text-center' }, ...k);
  const clear = () => { stage.innerHTML = ''; };

  let file = null;
  input.addEventListener('change', () => { if (input.files[0]) start(input.files[0]); });
  ['dragover', 'dragenter'].forEach((e) => dropzone.addEventListener(e, (ev) => { ev.preventDefault(); dropzone.classList.add('ring-2', 'ring-primary'); }));
  ['dragleave', 'drop'].forEach((e) => dropzone.addEventListener(e, (ev) => { ev.preventDefault(); dropzone.classList.remove('ring-2', 'ring-primary'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.[0]) start(e.dataTransfer.files[0]); });

  function spinner(msg) {
    dropWrap.style.display = 'none'; clear();
    stage.append(card(el('div', { class: 'pdf-spinner' }),
      el('p', { class: 'font-headline-sm text-headline-sm text-on-surface' }, msg || 'Converting…'),
      el('p', { class: 'text-body-md text-on-surface-variant' }, 'This runs on our secure conversion service.')));
  }
  function error(msg, extra) {
    dropWrap.style.display = 'none'; clear();
    stage.append(card(
      el('span', { class: 'material-symbols-outlined text-error text-[36px]' }, 'error'),
      el('p', { class: 'text-body-md text-on-surface' }, msg),
      extra || null,
      el('button', { class: 'mt-2 text-primary font-label-md text-label-md inline-flex items-center gap-1', onclick: reset },
        el('span', { class: 'material-symbols-outlined text-[18px]' }, 'restart_alt'), 'Try another file')));
  }
  function success(filename) {
    clear();
    stage.append(card(
      el('div', { class: 'w-14 h-14 rounded-full bg-primary-container/20 border border-primary-container/30 flex items-center justify-center' },
        el('span', { class: 'material-symbols-outlined text-primary text-[30px]', style: "font-variation-settings:'FILL' 1;" }, 'task_alt')),
      el('p', { class: 'font-headline-sm text-headline-sm text-on-surface' }, 'Done!'),
      el('p', { class: 'text-body-md text-on-surface-variant' }, `"${filename}" was downloaded. ${cost} credits used.`),
      el('button', { class: 'mt-2 text-primary font-label-md text-label-md inline-flex items-center gap-1', onclick: reset },
        el('span', { class: 'material-symbols-outlined text-[18px]' }, 'restart_alt'), 'Convert another file')));
  }
  function reset() { file = null; input.value = ''; dropWrap.style.display = ''; clear(); }

  async function start(f) {
    file = f;
    spinner('Preparing…');
    await authReady;
    if (!authUser) {
      return error('Please sign in to use conversion tools — it uses your credits.',
        el('a', { class: 'mt-1 bg-gradient-to-r from-primary to-secondary text-on-primary px-5 py-2 rounded-full font-label-md text-label-md', href: '../index.html' }, 'Go to sign in'));
    }
    try {
      const token = await authUser.getIdToken();
      // 1) create job
      spinner('Uploading…');
      const created = await api('create', token, {});
      if (created.error) return apiError(created);
      // 2) upload the file directly to CloudConvert
      const fd = new FormData();
      Object.entries(created.upload.parameters || {}).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      const up = await fetch(created.upload.url, { method: 'POST', body: fd });
      if (!up.ok && up.status !== 201 && up.status !== 204) return error('Upload failed — please try again.');
      // 3) finalize (poll)
      spinner('Converting…');
      const result = await finalize(token, created.jobId);
      if (result.error) return apiError(result);
      // 4) download
      await downloadUrl(result.url, result.filename);
      success(result.filename);
    } catch (e) {
      console.error(e);
      error('Something went wrong: ' + (e.message || 'unknown error'));
    }
  }

  async function api(action, token, extra) {
    const r = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action, tool: slug, ...extra }),
    });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, ...json };
  }
  async function finalize(token, jobId) {
    const overall = Date.now() + 120000; // up to 2 min
    while (Date.now() < overall) {
      const res = await api('finalize', token, { jobId });
      if (res.pending) { await new Promise((r) => setTimeout(r, 2000)); continue; }
      return res;
    }
    return { error: 'Conversion timed out. Please try again.' };
  }
  function apiError(res) {
    if (res.status === 401) return error('Please sign in again to continue.',
      el('a', { class: 'mt-1 bg-gradient-to-r from-primary to-secondary text-on-primary px-5 py-2 rounded-full font-label-md text-label-md', href: '../index.html' }, 'Go to sign in'));
    if (res.status === 402 || res.error === 'NO_CREDITS') return error(`You need ${cost} credits for this conversion. Top up on the home page.`,
      el('a', { class: 'mt-1 bg-gradient-to-r from-primary to-secondary text-on-primary px-5 py-2 rounded-full font-label-md text-label-md', href: '../index.html' }, 'Get credits'));
    if (res.status === 503) return error('Conversion service isn\'t configured yet. Please try again later.');
    return error(res.error || 'Conversion failed. Please try again.');
  }
  async function downloadUrl(url, filename) {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = el('a', { href: u, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) {
      // Cross-origin fetch blocked → open directly (CloudConvert serves as attachment)
      window.open(url, '_blank');
    }
  }

  // small hint under the dropzone about the credit cost
  window.addEventListener('DOMContentLoaded', () => {
    const note = document.querySelector('#pdfDropWrap .text-outline');
    if (note) note.append(el('span', {}, ` · costs ${cost} credits`));
  });

  const style = el('style');
  style.textContent = '.pdf-spinner{width:42px;height:42px;border-radius:50%;border:4px solid rgba(99,14,212,.15);border-top-color:#630ed4;animation:pdfspin .8s linear infinite}@keyframes pdfspin{to{transform:rotate(360deg)}}';
  document.head.append(style);
})();
