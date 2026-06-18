/**
 * Netlify Serverless Function: LaMa AI Inpainting via Replicate
 *
 * Proxies watermark-erasure requests to Replicate's twn39/lama model.
 * Rate-limited to 10 requests per IP per minute.
 * Requires REPLICATE_API_TOKEN environment variable.
 */

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

// ── Helpers ──────────────────────────────────────────────────────────────
function clientIP(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  );
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

  // Rate-limit check
  const ip = clientIP(event);
  if (isRateLimited(ip)) {
    return respond(429, { error: 'Too many requests, try again shortly.' });
  }

  // Check for API token
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return respond(503, { error: 'AI inpainting service is not configured.' });
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

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultBase64 })
    };

  } catch (error) {
    console.error('inpaint-lama function error:', error);
    return respond(500, { error: error.message });
  }
};

// ── Utilities ────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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
