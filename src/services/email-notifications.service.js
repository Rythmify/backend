const env = require('../config/env');
const notificationModel = require('../models/notification.model');
const {
  sendDirectMessageNotificationEmail,
  sendGeneralNotificationEmail,
} = require('../utils/mailer');

const EMAIL_PREF_BY_NOTIFICATION_TYPE = {
  follow: 'new_follower_email',
  like: 'likes_and_plays_email',
  comment: 'comment_on_post_email',
  repost: 'repost_of_your_post_email',
};

const getDisplayName = (user) => user?.display_name || user?.username || 'there';

const isEmailEnabled = (settings) => {
  return Boolean(settings?.email);
};

const safeSend = async (sendFn) => {
  try {
    await sendFn();
  } catch (err) {
    // Delivery failures should not break core product actions.
    console.error('Email notification delivery failed:', err?.message || err);
  }
};

exports.sendDirectMessageEmailIfEligible = async ({ conversationId, senderId, recipientId }) => {
  try {
    const [recipientSettings, sender] = await Promise.all([
      notificationModel.getUserEmailNotificationSettings(recipientId),
      notificationModel.getUserEmailIdentity(senderId),
    ]);

    if (!recipientSettings || !sender) return;
    if (!isEmailEnabled(recipientSettings)) return;
    if (!recipientSettings.new_message_email) return;

    const conversationUrl = `${env.APP_URL}/messages/conversations/${conversationId}`;

    await safeSend(() =>
      sendDirectMessageNotificationEmail(recipientSettings.email, {
        recipientName: getDisplayName(recipientSettings),
        senderName: getDisplayName(sender),
        conversationUrl,
        threadKey: `dm-${conversationId}`,
      })
    );
  } catch (err) {
    console.error('Direct-message email notification skipped:', err?.message || err);
  }
};

exports.sendGeneralNotificationEmailIfEligible = async ({
  recipientUserId,
  actionUserId,
  type,
}) => {
  try {
    const preferenceKey = EMAIL_PREF_BY_NOTIFICATION_TYPE[type];
    if (!preferenceKey) return;

    const [recipientSettings, actor] = await Promise.all([
      notificationModel.getUserEmailNotificationSettings(recipientUserId),
      notificationModel.getUserEmailIdentity(actionUserId),
    ]);

    if (!recipientSettings || !actor) return;
    if (!isEmailEnabled(recipientSettings)) return;
    if (!recipientSettings[preferenceKey]) return;

    const notificationsUrl = `${env.APP_URL}/notifications`;
    const threadKey = `notif-${recipientUserId}-${type}`;
    // const dayBucket = new Date().toISOString().slice(0, 10);

    await safeSend(() =>
      sendGeneralNotificationEmail(recipientSettings.email, {
        recipientName: getDisplayName(recipientSettings),
        actorName: getDisplayName(actor),
        type,
        notificationsUrl,
        threadKey,
      })
    );
  } catch (err) {
    console.error('General email notification skipped:', err?.message || err);
  }
};
