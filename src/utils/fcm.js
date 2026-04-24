// ============================================================
// utils/fcm.js — Firebase Cloud Messaging sender
// ============================================================
const admin = require('firebase-admin');
const env = require('../config/env');

const firebaseProjectId = env.FCM_PROJECT_ID || env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = env.FCM_CLIENT_EMAIL || env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey =
  env.FCM_PRIVATE_KEY || env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const hasFirebaseConfig = Boolean(firebaseProjectId && firebaseClientEmail && firebasePrivateKey);

// Initialize once — guard against hot-reload double init
if (!admin.apps.length && hasFirebaseConfig) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  });
} else if (!hasFirebaseConfig) {
  console.warn('[FCM] Missing Firebase credentials; push delivery is disabled.');
}

/**
 * Send a push notification to a single device token.
 * Never throws — push failure must never break the main flow.
 */
const sendPushNotification = async ({ token, title, body, data = {} }) => {
  try {
    if (!hasFirebaseConfig) return;

    await admin.messaging().send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    // Token expired or invalid — log only, don't throw
    console.error('[FCM] Push delivery failed:', err?.message);
  }
};

module.exports = { sendPushNotification };
