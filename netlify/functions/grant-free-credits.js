const admin = require('firebase-admin');

// ── Initialize Firebase Admin SDK ─────────────────────────────────────────
function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountStr) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not configured.');
    }
    
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountStr);
    } catch (e) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ' + e.message);
    }

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

function respond(status, body) {
  return {
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'POST only' });
  }

  try {
    initFirebaseAdmin();
  } catch (err) {
    console.error('Firebase Admin init error:', err.message);
    return respond(503, { error: 'Authentication service configuration error.' });
  }

  const token = getBearerToken(event.headers);
  if (!token) {
    return respond(401, { error: 'UNAUTHORIZED', details: 'Missing ID token' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const emailVerified = decodedToken.email_verified;

    if (!emailVerified) {
      return respond(403, { error: 'EMAIL_NOT_VERIFIED', details: 'Please verify your email address to claim free credits.' });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    let creditsGranted = 0;
    const result = await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(userRef);
      
      let data = docSnap.exists ? docSnap.data() : null;
      if (!data || !data.freeGranted) {
        // Grant free credits
        const newCredits = (data?.credits || 0) + 3;
        transaction.set(userRef, {
          email: email || '',
          credits: newCredits,
          freeGranted: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        creditsGranted = 3;
        return { success: true, credits: newCredits, message: 'Granted 3 free signup credits.' };
      } else {
        return { success: false, credits: data.credits, message: 'Free credits already claimed.' };
      }
    });

    return respond(200, result);

  } catch (error) {
    console.error('grant-free-credits error:', error);
    return respond(500, { error: error.message });
  }
};
