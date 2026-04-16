// ============================================================
// routes/notifications.routes.js
// Owner : Alyaa Mohamed (BE-4)
// Modules: Module 10 — Real-Time Notifications
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/notifications.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// GET  /notifications
router.get('/', authenticate, asyncHandler(controller.getNotifications));

// GET  /notifications/unread-count
router.get('/unread-count', authenticate, asyncHandler(controller.getUnreadNotificationCount));

// PATCH /notifications/:notification_id/read
router.patch(
  '/:notification_id/read',
  authenticate,
  asyncHandler(controller.markNotificationRead)
);

module.exports = router;
