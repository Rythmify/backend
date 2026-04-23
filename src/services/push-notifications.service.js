// ============================================================
// services/push-notifications.service.js
// ============================================================
const pushTokenModel = require('../models/push-token.model');
const AppError = require('../utils/app-error');

const VALID_PLATFORMS = ['android', 'ios'];

// Map API platform names to internal DB values
const PLATFORM_MAP = {
  android: 'fcm',
  ios: 'apns',
};

exports.registerToken = async ({ userId, token, platform }) => {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new AppError('token is required.', 400, 'VALIDATION_FAILED');
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new AppError(
      `platform must be one of: ${VALID_PLATFORMS.join(', ')}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  const internalPlatform = PLATFORM_MAP[platform];
  await pushTokenModel.registerToken(userId, token.trim(), internalPlatform);
};

exports.unregisterToken = async ({ userId, token }) => {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new AppError('token is required.', 400, 'VALIDATION_FAILED');
  }

  const deleted = await pushTokenModel.unregisterToken(userId, token.trim());
  if (!deleted) {
    throw new AppError('Token not found.', 404, 'TOKEN_NOT_FOUND');
  }
};

/**
 * Send a push notification to all devices of a user.
 * Checks push preference before sending.
 * Never throws — used as fire-and-forget.
 */
exports.sendPushToUser = async ({ userId, title, body, data = {} }) => {
  try {
    const tokens = await pushTokenModel.getTokensByUserId(userId);
    if (!tokens.length) return;

    const { sendPushNotification } = require('../utils/fcm');

    await Promise.allSettled(
      tokens.map(({ token }) =>
        sendPushNotification({ token, title, body, data })
      )
    );
  } catch (err) {
    console.error('[Push] sendPushToUser failed:', err?.message);
  }
};