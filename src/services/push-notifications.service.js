// ============================================================
// services/push-notifications.service.js
// ============================================================
const pushTokenModel = require('../models/push-token.model');
const AppError = require('../utils/app-error');

const VALID_PLATFORMS = ['android', 'ios', 'web'];

// Map API platform names to internal DB values
const PLATFORM_MAP = {
  android: 'fcm',
  ios: 'apns',
  web: 'fcm',
};

const TYPE_TO_PUSH_PREF = {
  follow: 'new_follower_push',
  like: 'likes_and_plays_push',
  repost: 'repost_of_your_post_push',
  comment: 'comment_on_post_push',
  new_post_by_followed: 'new_post_by_followed_push',
  recommended_content: 'recommended_content_push',
  new_message: 'new_message_push',
  feature_update: 'feature_updates_push',
  feature_updates: 'feature_updates_push',
  survey_feedback: 'surveys_and_feedback_push',
  surveys_and_feedback: 'surveys_and_feedback_push',
  promotional_content: 'promotional_content_push',
};

const shouldSendByPreference = (prefs, notificationType) => {
  if (!notificationType) return true;

  const prefField = TYPE_TO_PUSH_PREF[notificationType];
  if (!prefField) return true;

  // If no preferences row exists yet, keep legacy behavior (send).
  if (!prefs) return true;

  return prefs[prefField] !== false;
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
    const notificationType = typeof data?.type === 'string' ? data.type : null;
    const prefs = await pushTokenModel.getPushPreferencesByUserId(userId);
    if (!shouldSendByPreference(prefs, notificationType)) return;

    const tokens = await pushTokenModel.getTokensByUserId(userId);
    if (!tokens.length) return;

    const { sendPushNotification } = require('../utils/fcm');

    await Promise.allSettled(
      tokens.map(({ token }) => sendPushNotification({ token, title, body, data }))
    );
  } catch (err) {
    console.error('[Push] sendPushToUser failed:', err?.message);
  }
};

/**
 * Send a push notification for a new direct message (fire and forget).
 * Includes the message payload: the body text or "embed attached" if there's an embed.
 */
exports.sendDirectMessagePushIfEligible = async ({
  conversationId,
  senderId,
  recipientId,
  messageBody,
  embedType,
}) => {
  try {
    const notificationModel = require('../models/notification.model');
    const conversationActivity = require('../utils/conversation-activity');

    // Check if user has push notifications enabled for new messages
    const recipientPrefs = await pushTokenModel.getPushPreferencesByUserId(recipientId);
    const shouldSendPush = recipientPrefs?.new_message_push !== false;
    if (!shouldSendPush) return;

    // HTTP-only: if recipient fetched/updated this conversation very recently, skip push.
    if (conversationActivity.isRecentlyActive({ userId: recipientId, conversationId })) return;

    // Get sender info for title
    const sender = await notificationModel.getUserEmailIdentity(senderId);
    if (!sender) return;

    const senderName = sender.display_name || sender.username || 'Someone';

    // Build message preview
    let messagePreview = '';
    if (messageBody) {
      // Truncate long messages
      messagePreview =
        messageBody.length > 100 ? messageBody.substring(0, 97) + '...' : messageBody;
    } else if (embedType) {
      messagePreview = '📎 embed attached';
    } else {
      messagePreview = 'New message';
    }

    await exports
      .sendPushToUser({
        userId: recipientId,
        title: `Message from ${senderName}`,
        body: messagePreview,
        data: { type: 'new_message', conversationId },
      })
      .catch((err) => console.error('[Push] Direct message push failed:', err?.message));
  } catch (err) {
    console.error('Direct message push notification skipped:', err?.message || err);
  }
};
