// ============================================================
// services/notifications.service.js
// Owner : Alyaa Mohamed (BE-4)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

// ============================================================
const notificationModel = require('../models/notification.model');
const AppError = require('../utils/app-error');

// Valid notification types — mirrors DB enum and spec
const VALID_TYPES = ['follow', 'like', 'repost', 'comment', 'new_post_by_followed'];

const toOptionalBoolean = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return null;
};

// ============================================================
//centralized notification creation logic for all types of notifications
//=============================================================
exports.createNotification = async ({
  userId,
  actionUserId,
  type,
  referenceId = null,
  referenceType = null,
}) => {
  // ── 1. Never notify yourself ─────────────────────────────
  if (userId === actionUserId) return null;

  // ── 2. Deduplication — check cooldown window ─────────────
  const duplicate = await notificationModel.findRecentDuplicate(
    userId,
    actionUserId,
    type,
    referenceId
  );
  if (duplicate) return null;

  // ── 3. Preference gate ────────────────────────────────────
  const prefs = await notificationModel.findOrCreatePreferences(userId);

  const PREF_KEYS = {
    follow: {
      in_app: 'new_follower_in_app',
      push: 'new_follower_push',
      email: 'new_follower_email',
    },
    like: {
      in_app: 'likes_and_plays_in_app',
      push: 'likes_and_plays_push',
      email: 'likes_and_plays_email',
    },
    repost: {
      in_app: 'repost_of_your_post_in_app',
      push: 'repost_of_your_post_push',
      email: 'repost_of_your_post_email',
    },
    comment: {
      in_app: 'comment_on_post_in_app',
      push: 'comment_on_post_push',
      email: 'comment_on_post_email',
    },
    new_post_by_followed: {
      in_app: 'new_post_by_followed_in_app',
      push: 'new_post_by_followed_push',
      email: 'new_post_by_followed_email',
    },
  };

  const prefKeys = PREF_KEYS[type];
  const inAppOn = prefKeys ? prefs[prefKeys.in_app] !== false : true;
  const pushOn = prefKeys ? prefs[prefKeys.push] === true : false;
  const emailOn = prefKeys ? prefs[prefKeys.email] === true : false;

  // ── 4. In-app notification ────────────────────────────────
  let created = null;
  if (inAppOn) {
    created = await notificationModel.createNotification({
      userId,
      actionUserId,
      type,
      referenceId,
      referenceType,
    });

    // ── 5. Socket.IO real-time emit ───────────────────────
    // notificationModel.createNotification already calls
    // emitNotificationCreated internally — no duplicate emit needed
  }

  // ── 6. Email notification ─────────────────────────────────
  if (emailOn) {
    const emailNotificationsService = require('./email-notifications.service');
    await emailNotificationsService
      .sendGeneralNotificationEmailIfEligible({
        recipientUserId: userId,
        actionUserId,
        type,
      })
      .catch((err) => {
        // Email failure must never break the notification flow
        console.error('[Notifications] Email send failed silently:', err.message);
      });
  }

  // ── 7. Push notification ──────────────────────────────────
  // Push is already handled inside notificationModel.createNotification
  // via pushNotificationsService — no duplicate call needed here
  if (pushOn) {
    // Already fired inside the model — nothing to do here
    // [TODO: if you want to decouple push from model, move it here later]
    console.log(`[Notifications] Push handled in model layer. userId=${userId} type=${type}`);
  }

  return created;
};

// ------------------------------------------------------------
// Helper: format a raw notification row into the spec shape
// ------------------------------------------------------------
const formatNotification = (row) => ({
  id: row.id,
  type: row.type,
  actor: {
    id: row.actor_id,
    username: row.actor_username,
    display_name: row.actor_display_name,
    avatar: row.actor_avatar || null,
  },
  resource_type: row.resource_type || null,
  resource_id: row.resource_id || null,
  // Map conditional joins into one field
  resource_details: row.track_title
    ? { title: row.track_title }
    : row.playlist_title
      ? { title: row.playlist_title }
      : row.comment_content
        ? { content: row.comment_content }
        : null,
  is_read: row.is_read,
  created_at: row.created_at,
});

// ============================================================
// ENDPOINT 1 — GET /notifications
// ============================================================

/**
 * Returns paginated notification feed for the authenticated user.
 *
 * Params:
 * - unread_only: boolean — only return unread notifications
 * - type: string — filter by type (follow/like/repost/comment/new_post_by_followed) [UI extension]
 * - page: int
 * - limit: int (max 50)
 */
exports.getNotifications = async ({ userId, unreadOnly, type, page, limit }) => {
  // Sanitize pagination
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const safePage = Math.max(1, parseInt(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  // Validate type if provided
  if (type && !VALID_TYPES.includes(type)) {
    throw new AppError(
      `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  // tri-state:
  // - true  => only unread
  // - false => only read
  // - null  => no read-state filter
  const safeUnreadOnly = toOptionalBoolean(unreadOnly);

  const [rows, total] = await Promise.all([
    notificationModel.findNotifications(userId, {
      unreadOnly: safeUnreadOnly,
      type,
      limit: safeLimit,
      offset,
    }),
    notificationModel.countNotifications(userId, {
      unreadOnly: safeUnreadOnly,
      type,
    }),
  ]);

  // Also fetch the global unread count for the badge
  // This is always the total unread regardless of current filter
  const unreadCount = await notificationModel.countUnread(userId);

  const totalPages = Math.ceil(total / safeLimit);

  return {
    items: rows.map(formatNotification),
    unread_count: unreadCount,
    pagination: {
      page: safePage,
      per_page: safeLimit,
      total_items: total,
      total_pages: totalPages,
      has_next: safePage < totalPages,
      has_prev: safePage > 1,
    },
  };
};

exports.getUnreadCount = async ({ userId }) => {
  const unreadCount = await notificationModel.countUnread(userId);

  return {
    unread_count: unreadCount,
  };
};

// ============================================================
// ENDPOINT 3 — PATCH /notifications/:notification_id/read
// ============================================================

/**
 * Marks a single notification as read.
 * - Verifies notification exists → 404 if not
 * - Verifies the notification belongs to the requesting user → 403
 * - If already read, still returns 200 (idempotent — safe to call twice)
 */
exports.markNotificationRead = async ({ notificationId, userId }) => {
  // 1. Fetch notification
  const notification = await notificationModel.findNotificationById(notificationId);

  if (!notification) {
    throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
  }

  // 2. Ownership check — users can only mark their own notifications
  if (notification.user_id !== userId) {
    throw new AppError('You are not allowed to modify this notification.', 403, 'FORBIDDEN');
  }

  // 3. Idempotent — if already read, return early without hitting DB again
  if (notification.is_read) {
    return { success: true };
  }

  // 4. Mark as read
  await notificationModel.markAsRead(notificationId);

  return { success: true };
};

// ============================================================
// ENDPOINT 4 — GET /notifications/preferences
// ============================================================

/**
 * Returns the authenticated user's full notification preferences.
 * Auto-creates a row with defaults if it doesn't exist yet.
 */
exports.getPreferences = async ({ userId }) => {
  const prefs = await notificationModel.findOrCreatePreferences(userId);

  return {
    user_id: prefs.user_id,
    messages_from: prefs.messages_from,
    // Push fields
    new_follower_push: prefs.new_follower_push,
    repost_of_your_post_push: prefs.repost_of_your_post_push,
    new_post_by_followed_push: prefs.new_post_by_followed_push,
    likes_and_plays_push: prefs.likes_and_plays_push,
    comment_on_post_push: prefs.comment_on_post_push,
    recommended_content_push: prefs.recommended_content_push,
    new_message_push: prefs.new_message_push,
    feature_updates_push: prefs.feature_updates_push,
    surveys_and_feedback_push: prefs.surveys_and_feedback_push,
    promotional_content_push: prefs.promotional_content_push,
    // Email fields
    new_follower_email: prefs.new_follower_email,
    repost_of_your_post_email: prefs.repost_of_your_post_email,
    new_post_by_followed_email: prefs.new_post_by_followed_email,
    likes_and_plays_email: prefs.likes_and_plays_email,
    comment_on_post_email: prefs.comment_on_post_email,
    recommended_content_email: prefs.recommended_content_email,
    new_message_email: prefs.new_message_email,
    feature_updates_email: prefs.feature_updates_email,
    surveys_and_feedback_email: prefs.surveys_and_feedback_email,
    promotional_content_email: prefs.promotional_content_email,
    newsletter_email: prefs.newsletter_email,
  };
};

// ============================================================
// ENDPOINT 5 — PATCH /notifications/preferences
// ============================================================

/**
 * Partially updates notification preferences.
 * - Only fields present in the request body are updated
 * - All boolean fields must be actual booleans
 * - messages_from must be 'everyone' or 'followers_only'
 * - Unknown fields are rejected with 400
 */
exports.updatePreferences = async ({ userId, updates }) => {
  const { PREFERENCE_BOOLEAN_FIELDS, MESSAGES_FROM_VALUES } = notificationModel;

  const inAppFields = [
    'new_follower_in_app',
    'repost_of_your_post_in_app',
    'new_post_by_followed_in_app',
    'likes_and_plays_in_app',
    'comment_on_post_in_app',
    'recommended_content_in_app',
    'new_message_in_app',
  ];
  inAppFields.forEach((key) => delete updates[key]);

  const validFields = [...PREFERENCE_BOOLEAN_FIELDS, 'messages_from'];
  const unknownFields = Object.keys(updates).filter((k) => !validFields.includes(k));

  // Reject unknown fields
  if (unknownFields.length > 0) {
    throw new AppError(
      `Unknown preference field(s): ${unknownFields.join(', ')}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  // Nothing to update
  if (Object.keys(updates).length === 0) {
    throw new AppError('At least one preference field must be provided.', 400, 'VALIDATION_FAILED');
  }

  // Validate each field value
  const sanitized = {};

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'messages_from') {
      // Enum field — must be 'everyone' or 'followers_only'
      if (!MESSAGES_FROM_VALUES.includes(value)) {
        throw new AppError(
          `messages_from must be one of: ${MESSAGES_FROM_VALUES.join(', ')}.`,
          400,
          'VALIDATION_FAILED'
        );
      }
      sanitized[key] = value;
    } else {
      // All other fields must be boolean
      if (typeof value !== 'boolean') {
        throw new AppError(
          `Field '${key}' must be a boolean value (true or false).`,
          400,
          'VALIDATION_FAILED'
        );
      }
      sanitized[key] = value;
    }
  }

  // Ensure row exists; create with defaults if needed.
  await notificationModel.findOrCreatePreferences(userId);

  const updated = await notificationModel.updatePreferences(userId, sanitized);
  return this.getPreferences({ userId });
};
