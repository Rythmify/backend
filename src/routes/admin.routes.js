// ============================================================
// routes/admin.routes.js
// Owner : Omar Hamza (BE-5) — Module 11
// All route mappings for Moderation & Admin endpoints
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const asyncHandler = require('../utils/async-handler');
const { reportRateLimiter } = require('../middleware/rate-limiter');

// ============================================================
// MODERATION ENDPOINTS (User-facing)
// ============================================================

/**
 * POST /api/v1/reports
 * Submit a report for a track or user
 * Rate limited: 10 reports per hour per user
 * Auth: Required (any user)
 */
router.post('/reports', authenticate, reportRateLimiter, asyncHandler(controller.submitReport));

// ============================================================
// ADMIN ENDPOINTS (Admin-only)
// ============================================================

/**
 * GET /api/v1/admin/reports
 * List all reports with optional filters
 * Auth: Admin only
 */
router.get(
  '/admin/reports',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.listReports)
);

/**
 * GET /api/v1/admin/reports/:id
 * Get single report details
 * Auth: Admin only
 */
router.get(
  '/admin/reports/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.getReport)
);

/**
 * PATCH /api/v1/admin/reports/:id
 * Resolve or dismiss a report
 * Auth: Admin only
 */
router.patch(
  '/admin/reports/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.resolveReport)
);

/**
 * POST /api/v1/admin/reports/:id/appeal
 * Submit an appeal for a report decision
 * Auth: Required (any user)
 */
router.post('/admin/reports/:id/appeal', authenticate, asyncHandler(controller.submitAppeal));

/**
 * GET /api/v1/admin/appeals
 * List all appeals with optional status filter
 * Auth: Admin only
 */
router.get(
  '/admin/appeals',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.listAppeals)
);

/**
 * GET /api/v1/admin/appeals/:id
 * Get single appeal details
 * Auth: Admin only
 */
router.get(
  '/admin/appeals/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.getAppeal)
);

/**
 * PATCH /api/v1/admin/appeals/:id
 * Review appeal and decide (upheld/overturned)
 * Auth: Admin only
 */
router.patch(
  '/admin/appeals/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.reviewAppeal)
);

/**
 * POST /api/v1/admin/users/:id/warn
 * Issue a warning to a user
 * Auth: Admin only
 */
router.post(
  '/admin/users/:id/warn',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.warnUser)
);

/**
 * PATCH /api/v1/admin/tracks/:id
 * Hide or unhide a track
 * Auth: Admin only
 */
router.patch(
  '/admin/tracks/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.toggleTrackVisibility)
);

/**
 * DELETE /api/v1/admin/tracks/:id
 * Delete a track permanently
 * Auth: Admin only
 */
router.delete(
  '/admin/tracks/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.deleteTrack)
);

/**
 * PATCH /api/v1/admin/users/:id/suspend
 * Suspend a user account
 * Auth: Admin only
 */
router.patch(
  '/admin/users/:id/suspend',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.suspendUser)
);

/**
 * PATCH /api/v1/admin/users/:id/reinstate
 * Reinstate a suspended user
 * Auth: Admin only
 */
router.patch(
  '/admin/users/:id/reinstate',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.reinstateUser)
);

/**
 * GET /api/v1/admin/analytics
 * Get platform analytics
 * Auth: Admin only
 */
router.get(
  '/admin/analytics',
  authenticate,
  requireRole('admin'),
  asyncHandler(controller.getAnalytics)
);

module.exports = router;
