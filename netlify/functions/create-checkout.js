const admin = require('firebase-admin');
const stripeLib = require('stripe');

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function respond(status, body) {
  return {
    statusCode: status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
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

  // Check Stripe configuration
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return respond(503, { error: 'Stripe payments service is not configured.' });
  }
  const stripe = stripeLib(stripeSecretKey);

  // Verify Auth token
  let uid;
  try {
    initFirebaseAdmin();
    const token = getBearerToken(event.headers);
    if (!token) {
      return respond(401, { error: 'UNAUTHORIZED', details: 'ID token is required' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    uid = decodedToken.uid;
  } catch (err) {
    console.error('Auth verification failed:', err);
    return respond(401, { error: 'UNAUTHORIZED', details: err.message });
  }

  try {
    const { type, quantity } = JSON.parse(event.body || '{}');
    if (!type) {
      return respond(400, { error: 'Payment type (pack150 or payg) is required.' });
    }

    let line_items = [];
    let creditsToGrant = 0;

    if (type === 'pack150') {
      creditsToGrant = 150;
      line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: '150 Credits Pack',
            description: 'One-time credit pack for EraserPro AI (credits never expire)'
          },
          unit_amount: 799 // $7.99
        },
        quantity: 1
      }];
    } else if (type === 'payg') {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 1) {
        return respond(400, { error: 'Valid pay-as-you-go quantity is required.' });
      }
      creditsToGrant = qty;
      line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${qty} Pay-As-You-Go Credits`,
            description: 'Individual credits for EraserPro AI'
          },
          unit_amount: 50 // $0.50 per credit
        },
        quantity: qty
      }];
    } else {
      return respond(400, { error: 'Invalid purchase type.' });
    }

    // Determine return origin dynamically
    const origin = event.headers.origin || event.headers.referer || 'http://localhost:8080';
    const cleanOrigin = origin.split('?')[0].replace(/\/$/, '');
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: line_items,
      metadata: {
        uid: uid,
        credits: String(creditsToGrant)
      },
      success_url: `${cleanOrigin}/?checkout_success=true`,
      cancel_url: `${cleanOrigin}/`
    });

    return respond(200, { url: session.url });

  } catch (error) {
    console.error('create-checkout error:', error);
    return respond(500, { error: error.message });
  }
};
