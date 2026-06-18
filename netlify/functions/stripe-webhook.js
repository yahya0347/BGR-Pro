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

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'POST only'
    };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Stripe credentials or webhook secret missing.');
    return {
      statusCode: 503,
      body: 'Stripe webhook is not configured.'
    };
  }

  const stripe = stripeLib(stripeSecretKey);
  const sig = event.headers['stripe-signature'];

  // Decode body if base64 encoded
  let rawBody = event.body;
  if (event.isBase64Encoded) {
    rawBody = Buffer.from(event.body, 'base64').toString('utf8');
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`
    };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const uid = session.metadata?.uid;
      const creditsStr = session.metadata?.credits;

      if (!uid || !creditsStr) {
        console.warn('Webhook received checkout session completed without uid/credits metadata.');
        return {
          statusCode: 200,
          body: 'Metadata missing, skipped.'
        };
      }

      const credits = parseInt(creditsStr);
      if (isNaN(credits) || credits <= 0) {
        console.warn('Invalid credits count in metadata:', creditsStr);
        return {
          statusCode: 200,
          body: 'Invalid credits count, skipped.'
        };
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

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: `Server Error: ${error.message}`
    };
  }
};
