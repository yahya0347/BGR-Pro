/**
 * Vercel Serverless Function: Office ⇆ PDF conversion via CloudConvert.
 *
 * Same auth/credit model as api/inpaint.js:
 *   - Bearer Firebase ID token → verifyIdToken → users/{uid}.credits
 *   - Credits are deducted atomically ONLY after a successful conversion.
 *
 * Two-step flow (keeps large Office files off Vercel's request-body limit —
 * the browser uploads the file straight to CloudConvert):
 *   1) action:"create"   → precheck credits, create a CloudConvert job
 *                          (import/upload → convert → export/url), return the
 *                          upload form so the client uploads directly.
 *   2) action:"finalize" → poll the job; on success deduct credits and return
 *                          the download URL. Returns {pending:true} if the job
 *                          is still running (client retries) so we stay within
 *                          the serverless time limit.
 *
 * Requires CLOUDCONVERT_API_KEY and FIREBASE_SERVICE_ACCOUNT env vars.
 */

import admin from 'firebase-admin';

// Server-authoritative conversion table (never trust the client for cost).
const CONVERSIONS = {
  'word-to-pdf':  { output: 'pdf',  cost: 2 },
  'ppt-to-pdf':   { output: 'pdf',  cost: 2 },
  'excel-to-pdf': { output: 'pdf',  cost: 2 },
  'pdf-to-word':  { output: 'docx', cost: 4 },
  'pdf-to-ppt':   { output: 'pptx', cost: 4 },
  'pdf-to-excel': { output: 'xlsx', cost: 4 },
};

const CC_BASE = 'https://api.cloudconvert.com/v2';

// ── Rate limiter (per-instance) ───────────────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const hits = {};
function isRateLimited(ip) {
  const now = Date.now();
  if (!hits[ip]) hits[ip] = [];
  hits[ip] = hits[ip].filter((ts) => now - ts < RATE_WINDOW_MS);
  if (hits[ip].length >= RATE_MAX) return true;
  hits[ip].push(now);
  return false;
}

function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const s = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!s) throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not configured.');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(s)) });
  }
}
function clientIP(req) {
  return req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}
function getBearerToken(req) {
  const h = req.headers['authorization'];
  if (!h) return null;
  const p = h.split(' ');
  return p.length === 2 && p[0].toLowerCase() === 'bearer' ? p[1] : null;
}
async function cc(path, apiKey, init = {}) {
  const r = await fetch(CC_BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = clientIP(req);
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests, try again shortly.' });

  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Conversion service is not configured.' });

  // Parse body
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); } }
  const { action, tool, jobId } = body || {};
  const conv = CONVERSIONS[tool];
  if (!conv) return res.status(400).json({ error: 'Unknown or unsupported conversion tool.' });

  // ── Auth ────────────────────────────────────────────────────────────────
  let uid, db, userRef;
  try {
    initFirebaseAdmin();
    const idToken = getBearerToken(req);
    if (!idToken) return res.status(401).json({ error: 'UNAUTHORIZED', details: 'ID token is required' });
    uid = (await admin.auth().verifyIdToken(idToken)).uid;
    db = admin.firestore();
    userRef = db.collection('users').doc(uid);
  } catch (err) {
    console.error('Auth failed:', err);
    if (String(err.message).includes('FIREBASE_SERVICE_ACCOUNT')) return res.status(503).json({ error: 'Authentication service not configured.' });
    return res.status(401).json({ error: 'UNAUTHORIZED', details: err.message });
  }

  try {
    // ── CREATE ────────────────────────────────────────────────────────────
    if (action === 'create') {
      // Precheck credits (final charge happens in finalize).
      const snap = await userRef.get();
      const credits = snap.exists ? (snap.data().credits || 0) : 0;
      if (credits < conv.cost) return res.status(402).json({ error: 'NO_CREDITS', needed: conv.cost, have: credits });

      const jobBody = {
        tag: `eraserpro:${uid}:${tool}`,
        tasks: {
          'import-file': { operation: 'import/upload' },
          'convert-file': { operation: 'convert', input: 'import-file', output_format: conv.output },
          'export-file': { operation: 'export/url', input: 'convert-file' },
        },
      };
      const { ok, json } = await cc('/jobs', apiKey, { method: 'POST', body: JSON.stringify(jobBody) });
      if (!ok) { console.error('CloudConvert job create failed:', json); return res.status(502).json({ error: 'Conversion service error creating job.' }); }
      const jid = json.data?.id;
      let form = (json.data?.tasks || []).find((t) => t.name === 'import-file')?.result?.form;
      if (!form?.url && jid) { // some responses omit the form until tasks are included
        const g = await cc(`/jobs/${jid}?include=tasks`, apiKey, { method: 'GET' });
        form = (g.json.data?.tasks || []).find((t) => t.name === 'import-file')?.result?.form;
      }
      if (!form?.url) { console.error('No upload form in job:', json); return res.status(502).json({ error: 'Conversion service did not return an upload target.' }); }
      return res.status(200).json({ jobId: jid, upload: form, cost: conv.cost });
    }

    // ── FINALIZE ──────────────────────────────────────────────────────────
    if (action === 'finalize') {
      if (!jobId) return res.status(400).json({ error: 'jobId required' });
      // Poll within a short window; if not done, tell the client to retry.
      const deadline = Date.now() + 7000;
      let job = null;
      do {
        const { ok, json } = await cc(`/jobs/${jobId}?include=tasks`, apiKey, { method: 'GET' });
        if (!ok) return res.status(502).json({ error: 'Conversion service error checking job.' });
        job = json.data;
        if (job.status === 'finished' || job.status === 'error') break;
        await new Promise((r) => setTimeout(r, 1200));
      } while (Date.now() < deadline);

      if (!job) return res.status(502).json({ error: 'No job status.' });
      if (job.status === 'error') {
        const failed = (job.tasks || []).find((t) => t.status === 'error');
        return res.status(502).json({ error: 'Conversion failed: ' + (failed?.message || 'unsupported or corrupt file.') });
      }
      if (job.status !== 'finished') return res.status(202).json({ pending: true, jobId });

      const exportTask = (job.tasks || []).find((t) => t.name === 'export-file');
      const file = exportTask?.result?.files?.[0];
      if (!file?.url) return res.status(502).json({ error: 'Conversion finished but produced no file.' });

      // Charge credits atomically now that we have a result.
      try {
        await db.runTransaction(async (tx) => {
          const s = await tx.get(userRef);
          const c = s.exists ? (s.data().credits || 0) : 0;
          if (c < conv.cost) throw new Error('NO_CREDITS');
          tx.update(userRef, { credits: c - conv.cost });
        });
      } catch (txErr) {
        if (txErr.message === 'NO_CREDITS') return res.status(402).json({ error: 'NO_CREDITS' });
        throw txErr;
      }
      return res.status(200).json({ url: file.url, filename: file.filename, charged: conv.cost });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('convert function error:', error);
    return res.status(500).json({ error: error.message });
  }
}
