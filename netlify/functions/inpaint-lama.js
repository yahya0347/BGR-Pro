/**
 * Netlify Serverless Function: LaMa AI Inpainting via Replicate
 *
 * Proxies watermark-erasure requests to Replicate's twn39/lama model.
 * Gated behind user authentication and credit balances.
 * Rate-limited to 10 requests per IP per minute.
 * Requires REPLICATE_API_TOKEN and FIREBASE_SERVICE_ACCOUNT environment variables.
 */

const admin = require('firebase-admin');

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
function clientIP(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

function getBearerToken(headers) {
  const authHeader = headers['authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function respond(status, body) {
  return {
    statusCode: status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'POST only' });
  }

  // Rate-limit check (IP level)
  const ip = clientIP(event);
  if (isRateLimited(ip)) {
    return respond(429, { error: 'Too many requests, try again shortly.' });
  }

  // Check for Replicate API token
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return respond(503, { error: 'AI inpainting service is not configured.' });
  }

  // Verify Auth and Credits
  let uid;
  let db;
  let userRef;
  
  try {
    initFirebaseAdmin();
    const idToken = getBearerToken(event.headers);
    if (!idToken) {
      return respond(401, { error: 'UNAUTHORIZED', details: 'ID token is required' });
    }
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
    
    db = admin.firestore();
    userRef = db.collection('users').doc(uid);
    
    const docSnap = await userRef.get();
    const credits = docSnap.exists ? (docSnap.data().credits || 0) : 0;
    
    if (credits < 1) {
      return respond(402, { error: 'NO_CREDITS' });
    }
  } catch (err) {
    console.error('Auth / Credit check failed:', err);
    if (err.message === 'FIREBASE_SERVICE_ACCOUNT environment variable is not configured.') {
      return respond(503, { error: 'Authentication service not configured.' });
    }
    return respond(401, { error: 'UNAUTHORIZED', details: err.message });
  }

  try {
    const { image, mask } = JSON.parse(event.body || '{}');
    if (!image || !mask) {
      return respond(400, { error: 'image and mask required' });
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

    if (pred.error) {
      console.error('Replicate model error:', pred.error);
      return respond(502, { error: 'Model error: ' + pred.error });
    }

    // ── 2) If not finished within the wait window, poll until done ────────
    let guard = 0;
    while (pred.status && pred.status !== 'succeeded' && pred.status !== 'failed' && guard < 30) {
      await sleep(1000);
      const pr = await fetch(pred.urls.get, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      pred = await pr.json();
      guard++;
    }
    if (pred.status === 'failed') {
      console.error('Replicate prediction failed:', pred.error);
      return respond(502, { error: 'Inpainting failed' });
    }

    // ── 3) Output is a URL. Fetch server-side and return as base64 data URI ──
    const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!outputUrl) {
      return respond(502, { error: 'No output produced' });
    }

    const imgResp = await fetch(outputUrl);
    if (!imgResp.ok) {
      return respond(502, { error: 'Failed to fetch inpainted image from AI service.' });
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
        return respond(402, { error: 'NO_CREDITS' });
      }
      throw txError;
    }

    return respond(200, { resultBase64 });

  } catch (error) {
    console.error('inpaint-lama function error:', error);
    return respond(500, { error: error.message });
  }
};
