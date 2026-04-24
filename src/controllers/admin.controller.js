// ============================================================
// controllers/admin.controller.js
// Owner : Omar Hamza (BE-5) — Module 11
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const AppError = require('../utils/app-error');
const { success } = require('../utils/api-response');
const adminService = require('../services/admin.service');

// ============================================================
// REPORTING ENDPOINTS
// ============================================================

/**
 * POST /reports
 * Submit a content report (user-facing, rate limited at middleware)
 */
exports.submitReport = async (req, res) => {
  const { resource_type, resource_id, reason, description } = req.body;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'AUTH_REQUIRED');
  }

  const report = await adminService.submitReport(
    userId,
    resource_type,
    resource_id,
    reason,
    description
  );

  return success(res, report, 'Report submitted successfully', 201);
};

/**
 * GET /admin/reports
 * List all reports with optional filters (admin only)
 */
exports.listReports = async (req, res) => {
  const { status, reason, limit = 20, offset = 0 } = req.query;

  const result = await adminService.listReports({
    status: status || null,
    reason: reason || null,
    limit: Math.min(parseInt(limit, 10) || 20, 100),
    offset: Math.max(parseInt(offset, 10) || 0, 0),
  });

  return success(res, result.data, 'Reports fetched successfully', 200, result.pagination);
};

/**
 * GET /admin/reports/:id
 * Get a single report by ID (admin only)
 */
exports.getReport = async (req, res) => {
  const { id } = req.params;

  const report = await adminService.getReport(id);

  return success(res, report, 'Report fetched successfully', 200);
};

/**
 * PATCH /admin/reports/:id
 * Resolve or dismiss a report (admin only)
 */
exports.resolveReport = async (req, res) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  const report = await adminService.resolveReport(id, status, admin_note, adminId);

  return success(res, report, 'Report resolved successfully', 200);
};

// ============================================================
// WARNING ENDPOINTS
// ============================================================

/**
 * POST /admin/users/:id/warn
 * Issue a warning to a user (admin only)
 */
exports.warnUser = async (req, res) => {
  const { id } = req.params;
  const { reason, message } = req.body;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  const warning = await adminService.warnUser(id, adminId, reason, message);

  return success(
    res,
    {
      user_id: warning.user_id,
      warning_count: warning.warning_count,
      warned_at: warning.created_at,
    },
    'Warning issued successfully',
    200
  );
};

// ============================================================
// APPEAL ENDPOINTS
// ============================================================

/**
 * POST /admin/reports/:id/appeal
 * Submit an appeal for a report decision (user initiated)
 */
exports.submitAppeal = async (req, res) => {
  const { id } = req.params;
  const { appeal_reason } = req.body;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'AUTH_REQUIRED');
  }

  const appeal = await adminService.submitAppeal(id, appeal_reason, userId);

  return success(res, appeal, 'Appeal submitted successfully', 200);
};

/**
 * GET /admin/appeals
 * List all appeals with optional filters (admin only)
 */
exports.listAppeals = async (req, res) => {
  const { status = 'pending', limit = 20, offset = 0 } = req.query;

  const result = await adminService.listAppeals({
    status: status || 'pending',
    limit: Math.min(parseInt(limit, 10) || 20, 100),
    offset: Math.max(parseInt(offset, 10) || 0, 0),
  });

  return success(res, result.data, 'Appeals fetched successfully', 200, result.pagination);
};

/**
 * GET /admin/appeals/:id
 * Get a single appeal by ID (admin only)
 */
exports.getAppeal = async (req, res) => {
  const { id } = req.params;

  const appeal = await adminService.getAppeal(id);

  return success(res, appeal, 'Appeal fetched successfully', 200);
};

/**
 * PATCH /admin/appeals/:id
 * Review and decide on an appeal (admin only)
 */
exports.reviewAppeal = async (req, res) => {
  const { id } = req.params;
  const { decision, admin_notes } = req.body;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  const appeal = await adminService.reviewAppeal(id, decision, admin_notes, adminId);

  return success(res, appeal, 'Appeal reviewed successfully', 200);
};

// ============================================================
// CONTENT MODERATION ENDPOINTS
// ============================================================

/**
 * DELETE /admin/tracks/:id
 * Delete a track permanently (admin only)
 */
exports.deleteTrack = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  await adminService.deleteTrack(id, adminId, 'Track deleted by admin');

  return res.status(204).send();
};

/**
 * PATCH /admin/tracks/:id
 * Hide or unhide a track (admin only)
 */
exports.toggleTrackVisibility = async (req, res) => {
  const { id } = req.params;
  const { is_hidden, reason } = req.body;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  const track = await adminService.toggleTrackVisibility(id, is_hidden, reason, adminId);

  return success(
    res,
    {
      track_id: track.id,
      is_hidden: track.is_hidden,
    },
    'Track visibility updated successfully',
    200
  );
};

/**
 * PATCH /admin/users/:id/suspend
 * Suspend a user account (admin only)
 */
exports.suspendUser = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  const user = await adminService.suspendUser(id, reason, adminId);

  return success(
    res,
    {
      id: user.id,
      status: user.status,
      reason: user.suspension_reason,
      suspended_at: user.suspended_at,
    },
    'User suspended successfully',
    200
  );
};

/**
 * PATCH /admin/users/:id/reinstate
 * Reinstate a suspended user (admin only)
 */
exports.reinstateUser = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!adminId) {
    throw new AppError('Admin not authenticated', 401, 'AUTH_REQUIRED');
  }

  const user = await adminService.reinstateUser(id, adminId);

  return success(
    res,
    {
      id: user.id,
      status: user.status,
      reinstated_at: user.updated_at,
    },
    'User reinstated successfully',
    200
  );
};

// ============================================================
// ANALYTICS ENDPOINTS
// ============================================================

/**
 * GET /admin/analytics
 * Get platform analytics (admin only)
 */
exports.getAnalytics = async (req, res) => {
  const { period = 'month' } = req.query;

  const analytics = await adminService.getPlatformAnalytics(period);

  return success(res, analytics, 'Analytics fetched successfully', 200);
};
