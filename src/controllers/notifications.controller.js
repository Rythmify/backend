// ============================================================
// controllers/notifications.controller.js
// Owner : Alyaa Mohamed (BE-4)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const notificationsService = require('../services/notifications.service');
const { success, error } = require('../utils/api-response');
// ============================================================
// ENDPOINT 1 — GET /notifications
// ============================================================
exports.getNotifications = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { page, limit, unread_only, unread, unreadOnly, type } = req.query;
  const unreadParam = unread_only ?? unread ?? unreadOnly;

  const data = await notificationsService.getNotifications({
    userId,
    unreadOnly: unreadParam,
    type,
    page,
    limit,
  });

  return success(res, data, 'Notifications fetched successfully.');
};

// ============================================================
// ENDPOINT 2 — GET /notifications/unread-count
// ============================================================

exports.getUnreadNotificationCount = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const data = await notificationsService.getUnreadCount({ userId });

  return success(res, data, 'Unread notification count fetched successfully.');
};

// ============================================================
// ENDPOINT 3 — PATCH /notifications/:notification_id/read
// ============================================================
exports.markNotificationRead = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { notification_id } = req.params;

  // Basic UUID format check
  const { validate: isUuid } = require('uuid');
  if (!isUuid(notification_id)) {
    return error(res, 'VALIDATION_FAILED', 'notification_id must be a valid UUID.', 400);
  }

  const data = await notificationsService.markNotificationRead({
    notificationId: notification_id,
    userId,
  });

  return success(res, data, 'Notification marked as read.');
};
