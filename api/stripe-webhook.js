import admin from 'firebase-admin';
import stripeLib from 'stripe';

// Disable Vercel's automatic body parsing so we can read the raw stream for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to extract the raw unparsed request body stream
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
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

// ── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('POST only');
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Stripe credentials or webhook secret missing.');
    return res.status(503).send('Stripe webhook is not configured.');
  }

  const stripe = stripeLib(stripeSecretKey);
  const sig = req.headers['stripe-signature'];

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('Failed to read request body:', err);
    return res.status(400).send('Error reading body');
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const uid = session.metadata?.uid;
      const creditsStr = session.metadata?.credits;

      if (!uid || !creditsStr) {
        console.warn('Webhook received checkout session completed without uid/credits metadata.');
        return res.status(200).send('Metadata missing, skipped.');
      }

      const credits = parseInt(creditsStr);
      if (isNaN(credits) || credits <= 0) {
        console.warn('Invalid credits count in metadata:', creditsStr);
        return res.status(200).send('Invalid credits count, skipped.');
      }

      initFirebaseAdmin();
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);

      // Increment credits atomically
      await userRef.set({
        credits: admin.firestore.FieldValue.increment(credits)
      }, { merge: true });

      console.log(`Atomic increment: credited ${credits} credits to user ${uid}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).send(`Server Error: ${error.message}`);
  }
}
