// ============================================================
// services/notifications.service.js
// Owner : Alyaa Mohamed (BE-4)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

// ============================================================
const notificationModel = require('../models/notification.model');
const AppError          = require('../utils/app-error');

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
  id:            row.id,
  type:          row.type,
  actor: {
    id:           row.actor_id,
    username:     row.actor_username,
    display_name: row.actor_display_name,
    avatar:       row.actor_avatar || null,
  },
  resource_type: row.resource_type || null,
  resource_id:   row.resource_id   || null,
  is_read:       row.is_read,
  created_at:    row.created_at,
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
  const safeLimit  = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const safePage   = Math.max(1, parseInt(page) || 1);
  const offset     = (safePage - 1) * safeLimit;

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
      limit:  safeLimit,
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
    items:        rows.map(formatNotification),
    unread_count: unreadCount,
    pagination: {
      page:        safePage,
      per_page:    safeLimit,
      total_items: total,
      total_pages: totalPages,
      has_next:    safePage < totalPages,
      has_prev:    safePage > 1,
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
    throw new AppError(
      'Notification not found.',
      404,
      'NOTIFICATION_NOT_FOUND'
    );
  }

  // 2. Ownership check — users can only mark their own notifications
  if (notification.user_id !== userId) {
    throw new AppError(
      'You are not allowed to modify this notification.',
      403,
      'FORBIDDEN'
    );
  }

  // 3. Idempotent — if already read, return early without hitting DB again
  if (notification.is_read) {
    return { success: true };
  }

  // 4. Mark as read
  await notificationModel.markAsRead(notificationId);

  return { success: true };
};