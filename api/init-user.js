import admin from 'firebase-admin';

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

  try {
    initFirebaseAdmin();
  } catch (err) {
    console.error('Firebase Admin init error:', err.message);
    return res.status(503).json({ error: 'Authentication service configuration error.' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', details: 'Missing ID token' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(userRef);
      
      if (!docSnap.exists) {
        // Initialize doc with 3 credits
        transaction.set(userRef, {
          email: email || '',
          credits: 3,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, credits: 3, created: true };
      } else {
        // Existing user doc, just return current credits
        return { success: true, credits: docSnap.data().credits || 0, created: false };
      }
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('init-user error:', error);
    return res.status(500).json({ error: error.message });
  }
}
