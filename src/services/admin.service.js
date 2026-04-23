// ============================================================
// services/admin.service.js
// Owner : Beshoy and Alyaa
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const AppError = require('../utils/app-error');
const reportModel = require('../models/report.model');
const warningModel = require('../models/warning.model');
const appealModel = require('../models/appeal.model');
const userModel = require('../models/user.model');
const tracksModel = require('../models/track.model');
const notificationModel = require('../models/notification.model');

// ============================================================
// REPORT MANAGEMENT
// ============================================================

/**
 * Submit a report for a track or user
 * Rate limited at middleware level (10/hour)
 */
exports.submitReport = async (userId, resourceType, resourceId, reason, description) => {
  // Validate resource type
  if (!['track', 'user'].includes(resourceType)) {
    throw new AppError('Invalid resource_type', 400, 'VALIDATION_FAILED');
  }

  // Validate reason
  const validReasons = ['copyright', 'inappropriate', 'spam', 'impersonation'];
  if (!validReasons.includes(reason)) {
    throw new AppError('Invalid reason', 400, 'VALIDATION_FAILED');
  }

  // Validate reason/resource_type combination
  if (resourceType === 'track' && reason === 'impersonation') {
    throw new AppError('impersonation reason is only valid for users', 400, 'VALIDATION_FAILED');
  }
  if (resourceType === 'user' && reason === 'copyright') {
    throw new AppError('copyright reason is only valid for tracks', 400, 'VALIDATION_FAILED');
  }

  // Check if resource exists
  if (resourceType === 'track') {
    const track = await tracksModel.getTrackById(resourceId, null);
    if (!track) {
      throw new AppError('Track not found', 404, 'RESOURCE_NOT_FOUND');
    }
  } else if (resourceType === 'user') {
    const user = await userModel.findById(resourceId);
    if (!user) {
      throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
    }
  }

  // Check if user already reported this
  const alreadyReported = await reportModel.hasUserReported(userId, resourceType, resourceId);
  if (alreadyReported) {
    throw new AppError('You have already reported this resource', 409, 'ALREADY_REPORTED');
  }

  // Create report
  const report = await reportModel.createReport(
    userId,
    resourceType,
    resourceId,
    reason,
    description
  );
  if (!report) {
    throw new AppError('Failed to create report', 500, 'INTERNAL_ERROR');
  }

  // TODO: Emit notification to admins via Socket.IO (report_received)
  return report;
};

/**
 * List all reports with filters (admin only)
 */
exports.listReports = async ({ status, reason, limit = 20, offset = 0 }) => {
  const reports = await reportModel.getReports({ status, reason, limit, offset });
  const total = await reportModel.getReportsCount({ status, reason });

  return {
    data: reports,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    },
  };
};

/**
 * Get single report details (admin only)
 */
exports.getReport = async (reportId) => {
  const report = await reportModel.getReportById(reportId);
  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }
  return report;
};

/**
 * Resolve or dismiss a report (admin only)
 */
exports.resolveReport = async (reportId, status, adminNote, adminUserId) => {
  // Validate status
  if (!['resolved', 'dismissed'].includes(status)) {
    throw new AppError('Invalid status', 400, 'VALIDATION_FAILED');
  }

  const report = await reportModel.getReportById(reportId);
  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  if (report.status !== 'pending') {
    throw new AppError('Report already resolved', 409, 'REPORT_ALREADY_RESOLVED');
  }

  // Update report
  const updatedReport = await reportModel.updateReportStatus(
    reportId,
    status,
    adminNote,
    adminUserId
  );

  // TODO: Emit notification to user via Socket.IO (report_resolved)
  // TODO: Emit audit log via Socket.IO

  return updatedReport;
};

// ============================================================
// WARNING MANAGEMENT
// ============================================================

/**
 * Issue a warning to a user (admin only)
 */
exports.warnUser = async (userId, adminId, reason, message) => {
  // Validate reason
  const validReasons = ['copyright_strike', 'repeated_reports', 'content_policy_violation', 'spam'];
  if (!validReasons.includes(reason)) {
    throw new AppError('Invalid warning reason', 400, 'VALIDATION_FAILED');
  }

  // Check if user exists
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Create warning
  const warning = await warningModel.createWarning(userId, adminId, reason, message);

  // TODO: Emit notification to user via Socket.IO (user_warned)
  // TODO: Emit audit log via Socket.IO

  return warning;
};

/**
 * Get warnings for a user (admin view)
 */
exports.getUserWarnings = async (userId, limit = 50, offset = 0) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const warnings = await warningModel.getWarningsByUser(userId, limit, offset);
  const total = await warningModel.getWarningsCount(userId);
  const totalCount = await warningModel.getUserTotalWarningCount(userId);

  return {
    data: warnings,
    total_warning_count: totalCount,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    },
  };
};

// ============================================================
// APPEAL MANAGEMENT
// ============================================================

/**
 * Submit an appeal for a report decision (user initiated)
 */
exports.submitAppeal = async (reportId, appealReason, userId) => {
  // Check if report exists
  const report = await reportModel.getReportById(reportId);
  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  // Check if report belongs to this user
  if (report.reporter_id !== userId) {
    throw new AppError('Report does not belong to you', 403, 'FORBIDDEN');
  }

  // Report must be resolved or dismissed
  if (report.status === 'pending') {
    throw new AppError('Can only appeal resolved or dismissed reports', 400, 'INVALID_APPEAL');
  }

  // Check if appeal already exists
  const hasAppeal = await appealModel.reportHasAppeal(reportId);
  if (hasAppeal) {
    throw new AppError('This report already has an appeal', 409, 'APPEAL_EXISTS');
  }

  // Create appeal
  const appeal = await appealModel.createAppeal(reportId, userId, appealReason);
  if (!appeal) {
    throw new AppError('Failed to create appeal', 500, 'INTERNAL_ERROR');
  }

  // TODO: Emit notification to admins via Socket.IO (appeal_submitted)

  return appeal;
};

/**
 * List all appeals (admin only)
 */
exports.listAppeals = async ({ status = 'pending', limit = 20, offset = 0 }) => {
  const appeals = await appealModel.getAppeals({ status, limit, offset });
  const total = await appealModel.getAppealsCount({ status });

  return {
    data: appeals,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    },
  };
};

/**
 * Get single appeal details (admin only)
 */
exports.getAppeal = async (appealId) => {
  const appeal = await appealModel.getAppealById(appealId);
  if (!appeal) {
    throw new AppError('Appeal not found', 404, 'APPEAL_NOT_FOUND');
  }
  return appeal;
};

/**
 * Review and decide on an appeal (admin only)
 */
exports.reviewAppeal = async (appealId, decision, adminNotes, adminUserId) => {
  // Validate decision
  if (!['upheld', 'overturned'].includes(decision)) {
    throw new AppError('Invalid decision', 400, 'VALIDATION_FAILED');
  }

  const appeal = await appealModel.getAppealById(appealId);
  if (!appeal) {
    throw new AppError('Appeal not found', 404, 'APPEAL_NOT_FOUND');
  }

  if (appeal.status !== 'pending') {
    throw new AppError('Appeal already reviewed', 409, 'APPEAL_ALREADY_REVIEWED');
  }

  // Update appeal with decision
  const updatedAppeal = await appealModel.updateAppealDecision(
    appealId,
    decision,
    adminNotes,
    adminUserId
  );

  // TODO: Emit notification to user via Socket.IO (appeal_reviewed)
  // TODO: Emit audit log via Socket.IO

  return updatedAppeal;
};

// ============================================================
// CONTENT MODERATION (TRACKS & USERS)
// ============================================================

/**
 * Delete a track permanently (admin only)
 */
exports.deleteTrack = async (trackId, adminUserId, reason) => {
  const track = await tracksModel.getTrackById(trackId, null);
  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  // Delete track (hard delete or soft delete depending on implementation)
  // TODO: Implement actual track deletion in tracks.model.js
  // For now, mark as deleted or hide
  const deleted = await tracksModel.deleteTrack(trackId);

  // TODO: Emit audit log via Socket.IO

  return { deleted: true };
};

/**
 * Hide or unhide a track (admin only)
 */
exports.toggleTrackVisibility = async (trackId, isHidden, reason, adminUserId) => {
  const track = await tracksModel.getTrackById(trackId, null);
  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  // Update track visibility
  // TODO: Implement updateTrackHiddenStatus in tracks.model.js
  const updated = await tracksModel.updateTrackHiddenStatus(trackId, isHidden);

  // TODO: Emit audit log via Socket.IO

  return updated;
};

/**
 * Suspend a user account (admin only)
 */
exports.suspendUser = async (userId, reason, adminUserId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Prevent admins from suspending other admins
  if (user.role === 'admin') {
    throw new AppError('Cannot suspend admin accounts', 422, 'CANNOT_SUSPEND_ADMIN');
  }

  // Update user status to suspended
  // TODO: Implement updateUserStatus in users.model.js
  const suspended = await userModel.updateUserStatus(userId, 'suspended', reason);

  // TODO: Emit notification to user via Socket.IO (user_suspended)
  // TODO: Emit audit log via Socket.IO

  return suspended;
};

/**
 * Reinstate a suspended user account (admin only)
 */
exports.reinstateUser = async (userId, adminUserId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (user.status !== 'suspended') {
    throw new AppError('User is not suspended', 400, 'USER_NOT_SUSPENDED');
  }

  // Update user status back to active
  // TODO: Implement in users.model.js
  const reinstated = await userModel.updateUserStatus(userId, 'active', null);

  // TODO: Emit audit log via Socket.IO

  return reinstated;
};

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get platform analytics for admin dashboard
 */
exports.getPlatformAnalytics = async (period = 'month') => {
  // TODO: Implement analytics queries in appropriate models
  // For now, return placeholder
  const validPeriods = ['day', 'week', 'month'];
  if (!validPeriods.includes(period)) {
    throw new AppError('Invalid period', 400, 'VALIDATION_FAILED');
  }

  const pendingReports = await reportModel.getPendingReportsCount();
  const pendingAppeals = await appealModel.getPendingAppealsCount();
  const suspendedAccounts = await userModel.getSuspendedAccountsCount();

  return {
    period,
    active_users: 0, // TODO: Get from users.model
    new_registrations: 0, // TODO: Get from users.model
    total_tracks: 0, // TODO: Get from tracks.model
    total_plays: 0, // TODO: Get from playback.model
    play_through_rate: 0, // TODO: Calculate
    storage_used_gb: 0, // TODO: Get from storage
    storage_limit_gb: 0, // TODO: Get from config
    pending_reports: pendingReports,
    pending_appeals: pendingAppeals,
    suspended_accounts: suspendedAccounts,
  };
};
