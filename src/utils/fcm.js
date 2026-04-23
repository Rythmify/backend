// ============================================================
// utils/fcm.js — Firebase Cloud Messaging sender
// ============================================================
const admin = require('firebase-admin');
const env = require('../config/env');

// Initialize once — guard against hot-reload double init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // env vars escape \n as \\n — replace back
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * Send a push notification to a single device token.
 * Never throws — push failure must never break the main flow.
 */
const sendPushNotification = async ({ token, title, body, data = {} }) => {
  try {
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