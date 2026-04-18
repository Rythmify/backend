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
const VALID_TYPES = ['follow', 'like', 'repost', 'comment'];

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
 * - type: string — filter by type (follow/like/repost/comment) [UI extension]
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
  return formatPreferences(prefs);
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
  return formatPreferences(updated);
};

// ── Private helper ────────────────────────────────────────────

/**
 * Strip internal DB fields (id, user_id, created_at, updated_at)
 * and return only the preference flags — matches NotificationPreferences schema.
 */
const formatPreferences = (row) => ({
  new_follower_in_app: row.new_follower_in_app,
  new_follower_push: row.new_follower_push,
  new_follower_email: row.new_follower_email,

  repost_of_your_post_in_app: row.repost_of_your_post_in_app,
  repost_of_your_post_push: row.repost_of_your_post_push,
  repost_of_your_post_email: row.repost_of_your_post_email,

  new_post_by_followed_in_app: row.new_post_by_followed_in_app,
  new_post_by_followed_push: row.new_post_by_followed_push,
  new_post_by_followed_email: row.new_post_by_followed_email,

  likes_and_plays_in_app: row.likes_and_plays_in_app,
  likes_and_plays_push: row.likes_and_plays_push,
  likes_and_plays_email: row.likes_and_plays_email,

  comment_on_post_in_app: row.comment_on_post_in_app,
  comment_on_post_push: row.comment_on_post_push,
  comment_on_post_email: row.comment_on_post_email,

  recommended_content_in_app: row.recommended_content_in_app,
  recommended_content_push: row.recommended_content_push,
  recommended_content_email: row.recommended_content_email,

  new_message_in_app: row.new_message_in_app,
  new_message_push: row.new_message_push,
  // [NOTE] messages_from is a DB-only field not in spec schema
  // but included for completeness — FE needs it for messaging settings
  messages_from: row.messages_from,

  feature_updates_push: row.feature_updates_push,
  feature_updates_email: row.feature_updates_email,

  surveys_and_feedback_push: row.surveys_and_feedback_push,
  surveys_and_feedback_email: row.surveys_and_feedback_email,

  promotional_content_push: row.promotional_content_push,
  promotional_content_email: row.promotional_content_email,

  newsletter_email: row.newsletter_email,
});
