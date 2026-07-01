/**
 * Vercel Serverless Function: LaMa AI Inpainting via Replicate
 *
 * Proxies watermark-erasure requests to Replicate's twn39/lama model.
 * Gated behind user authentication and credit balances.
 * Rate-limited to 10 requests per IP per minute.
 * Requires REPLICATE_API_TOKEN and FIREBASE_SERVICE_ACCOUNT environment variables.
 */

import admin from 'firebase-admin';

// ── In-memory rate limiter (per-instance; resets on cold-start) ──────────
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX       = 10;     // max requests per window per IP
const hits = {};               // { ip: [timestamp, ...] }

function isRateLimited(ip) {
  const now = Date.now();
  if (!hits[ip]) hits[ip] = [];
  hits[ip] = hits[ip].filter(ts => now - ts < RATE_WINDOW_MS);
  if (hits[ip].length >= RATE_MAX) return true;
  hits[ip].push(now);
  return false;
}

// ── Initialize Firebase Admin SDK ─────────────────────────────────────────
function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountStr) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not configured.');
    }
    const serviceAccount = JSON.parse(serviceAccountStr);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function clientIP(req) {
  return (
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

// ── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  // Rate-limit check (IP level)
  const ip = clientIP(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, try again shortly.' });
  }

  // Check for Replicate API token
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'AI inpainting service is not configured.' });
  }

  // Verify Auth and Credits
  let uid;
  let db;
  let userRef;
  
  try {
    initFirebaseAdmin();
    const idToken = getBearerToken(req);
    if (!idToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED', details: 'ID token is required' });
    }
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
    
    db = admin.firestore();
    userRef = db.collection('users').doc(uid);
    
    const docSnap = await userRef.get();
    const credits = docSnap.exists ? (docSnap.data().credits || 0) : 0;
    
    if (credits < 1) {
      return res.status(402).json({ error: 'NO_CREDITS' });
    }
  } catch (err) {
    console.error('Auth / Credit check failed:', err);
    if (err.message === 'FIREBASE_SERVICE_ACCOUNT environment variable is not configured.') {
      return res.status(503).json({ error: 'Authentication service not configured.' });
    }
    return res.status(401).json({ error: 'UNAUTHORIZED', details: err.message });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    const { image, mask } = body;
    if (!image || !mask) {
      return res.status(400).json({ error: 'image and mask required' });
    }

    // ── 1) Call LaMa via the model endpoint with Prefer: wait (synchronous) ──
    let r = await fetch('https://api.replicate.com/v1/models/twn39/lama/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input: { image, mask } })
    });
    let pred = await r.json();

    if (!r.ok) {
      console.error('Replicate API returned non-OK:', pred);
      return res.status(502).json({ error: 'Replicate API error: ' + (pred.detail || JSON.stringify(pred)) });
    }

    if (pred.error) {
      console.error('Replicate model error:', pred.error);
      return res.status(502).json({ error: 'Model error: ' + pred.error });
    }

    // ── 2) If not finished within the wait window, poll until done ────────
    let guard = 0;
    while (pred.status && pred.status !== 'succeeded' && pred.status !== 'failed' && guard < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!pred.urls || !pred.urls.get) {
        console.error('Replicate prediction missing urls.get:', pred);
        return res.status(502).json({ error: 'Inpainting failed, unexpected response from AI provider' });
      }
      const pr = await fetch(pred.urls.get, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      pred = await pr.json();
      guard++;
    }
    if (pred.status === 'failed') {
      console.error('Replicate prediction failed:', pred.error);
      return res.status(502).json({ error: 'Inpainting failed' });
    }

    // ── 3) Output is a URL. Fetch server-side and return as base64 data URI ──
    const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!outputUrl) {
      return res.status(502).json({ error: 'No output produced' });
    }

    const imgResp = await fetch(outputUrl);
    if (!imgResp.ok) {
      return res.status(502).json({ error: 'Failed to fetch inpainted image from AI service.' });
    }

    const buf = Buffer.from(await imgResp.arrayBuffer());
    const resultBase64 = 'data:image/png;base64,' + buf.toString('base64');

    // ── 4) Deduct 1 credit atomically on success ──────────────────────────
    try {
      await db.runTransaction(async (transaction) => {
        const dSnap = await transaction.get(userRef);
        const currentCredits = dSnap.exists ? (dSnap.data().credits || 0) : 0;
        if (currentCredits < 1) {
          throw new Error('NO_CREDITS');
        }
        transaction.update(userRef, { credits: currentCredits - 1 });
      });
    } catch (txError) {
      console.error('Credit deduction transaction failed:', txError.message);
      if (txError.message === 'NO_CREDITS') {
        return res.status(402).json({ error: 'NO_CREDITS' });
      }
      throw txError;
    }

    return res.status(200).json({ resultBase64 });

  } catch (error) {
    console.error('inpaint function error:', error);
    return res.status(500).json({ error: error.message });
  }
}
