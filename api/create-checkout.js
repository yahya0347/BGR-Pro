import admin from 'firebase-admin';
import stripeLib from 'stripe';

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
function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

// ── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  // Check Stripe configuration
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(503).json({ error: 'Stripe payments service is not configured.' });
  }
  const stripe = stripeLib(stripeSecretKey);

  // Verify Auth token
  let uid;
  try {
    initFirebaseAdmin();
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', details: 'ID token is required' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    uid = decodedToken.uid;
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(401).json({ error: 'UNAUTHORIZED', details: err.message });
  }

  try {
    const { type, quantity } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Payment type (pack150 or payg) is required.' });
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
        return res.status(400).json({ error: 'Valid pay-as-you-go quantity is required.' });
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
      return res.status(400).json({ error: 'Invalid purchase type.' });
    }

    // Determine return origin dynamically
    const origin = req.headers.origin || req.headers.referer || 'http://localhost:8080';
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

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('create-checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
