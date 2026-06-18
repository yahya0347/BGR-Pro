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
    const emailVerified = decodedToken.email_verified;

    if (!emailVerified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', details: 'Please verify your email address to claim free credits.' });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(userRef);
      
      let data = docSnap.exists ? docSnap.data() : null;
      if (!data || !data.freeGranted) {
        const newCredits = (data?.credits || 0) + 3;
        transaction.set(userRef, {
          email: email || '',
          credits: newCredits,
          freeGranted: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        return { success: true, credits: newCredits, message: 'Granted 3 free signup credits.' };
      } else {
        return { success: false, credits: data.credits, message: 'Free credits already claimed.' };
      }
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('grant-free-credits error:', error);
    return res.status(500).json({ error: error.message });
  }
}
