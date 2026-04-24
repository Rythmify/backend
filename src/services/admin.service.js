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
const adminTrackModel = require('../models/admin-track.model');
const {
  emitReportReceived,
  emitReportResolved,
  emitAppealSubmitted,
  emitAppealReviewed,
  emitUserWarned,
  emitUserSuspended,
  emitAdminAuditLog,
} = require('../sockets/admin-notifications.socket');

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

  if (description !== undefined && description !== null) {
    const normalizedDescription = String(description).trim();
    if (normalizedDescription.length > 1000) {
      throw new AppError('description must be at most 1000 characters', 400, 'VALIDATION_FAILED');
    }
  }

  // Check if resource exists
  if (resourceType === 'track') {
    const track = await adminTrackModel.getTrackById(resourceId);
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

  emitReportReceived({ report });

  emitAdminAuditLog({
    action: 'report_submitted',
    adminUserId: userId,
    targetType: resourceType,
    targetId: resourceId,
    metadata: {
      report_id: report.id,
      reason,
    },
  });

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

  emitReportResolved({ userId: updatedReport.reporter_id, report: updatedReport });

  emitAdminAuditLog({
    action: 'report_resolved',
    adminUserId,
    targetType: 'report',
    targetId: updatedReport.id,
    metadata: {
      status,
      reporter_id: updatedReport.reporter_id,
    },
  });

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

  // Prevent admins from taking moderation actions against other admins.
  if (user.role === 'admin') {
    throw new AppError('Cannot warn admin accounts', 422, 'CANNOT_WARN_ADMIN');
  }

  if (message !== undefined && message !== null) {
    const normalizedMessage = String(message).trim();
    if (normalizedMessage.length > 500) {
      throw new AppError('message must be at most 500 characters', 400, 'VALIDATION_FAILED');
    }
  }

  // Create warning
  const warning = await warningModel.createWarning(userId, adminId, reason, message);

  emitUserWarned({ userId, warning });

  emitAdminAuditLog({
    action: 'user_warned',
    adminUserId: adminId,
    targetType: 'user',
    targetId: userId,
    metadata: {
      warning_id: warning.id,
      reason,
    },
  });

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
  const normalizedAppealReason = String(appealReason || '').trim();
  if (!normalizedAppealReason) {
    throw new AppError('appeal_reason is required', 400, 'VALIDATION_FAILED');
  }
  if (normalizedAppealReason.length > 1000) {
    throw new AppError('appeal_reason must be at most 1000 characters', 400, 'VALIDATION_FAILED');
  }

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
  const appeal = await appealModel.createAppeal(reportId, userId, normalizedAppealReason);
  if (!appeal) {
    throw new AppError('Failed to create appeal', 500, 'INTERNAL_ERROR');
  }

  emitAppealSubmitted({ appeal });

  emitAdminAuditLog({
    action: 'appeal_submitted',
    adminUserId: userId,
    targetType: 'report',
    targetId: reportId,
    metadata: {
      appeal_id: appeal.id,
    },
  });

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

  if (adminNotes !== undefined && adminNotes !== null) {
    const normalizedNotes = String(adminNotes).trim();
    if (normalizedNotes.length > 500) {
      throw new AppError('admin_notes must be at most 500 characters', 400, 'VALIDATION_FAILED');
    }
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

  emitAppealReviewed({ userId: updatedAppeal.user_id, appeal: updatedAppeal });

  emitAdminAuditLog({
    action: 'appeal_reviewed',
    adminUserId,
    targetType: 'appeal',
    targetId: updatedAppeal.id,
    metadata: {
      decision,
      user_id: updatedAppeal.user_id,
    },
  });

  return updatedAppeal;
};

// ============================================================
// CONTENT MODERATION (TRACKS & USERS)
// ============================================================

/**
 * Delete a track permanently (admin only)
 */
exports.deleteTrack = async (trackId, adminUserId, reason) => {
  const track = await adminTrackModel.getTrackById(trackId);
  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const deleted = await adminTrackModel.softDeleteTrack(trackId);
  if (!deleted) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  emitAdminAuditLog({
    action: 'track_deleted',
    adminUserId,
    targetType: 'track',
    targetId: trackId,
    metadata: {
      reason: reason || null,
    },
  });

  return { deleted: true, track_id: trackId };
};

/**
 * Hide or unhide a track (admin only)
 */
exports.toggleTrackVisibility = async (trackId, isHidden, reason, adminUserId) => {
  const track = await adminTrackModel.getTrackById(trackId);
  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (typeof isHidden !== 'boolean') {
    throw new AppError('is_hidden must be a boolean', 400, 'VALIDATION_FAILED');
  }

  const updated = await adminTrackModel.updateTrackHiddenStatus(trackId, isHidden);
  if (!updated) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  emitAdminAuditLog({
    action: 'track_visibility_updated',
    adminUserId,
    targetType: 'track',
    targetId: trackId,
    metadata: {
      is_hidden: isHidden,
      reason: reason || null,
    },
  });

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

  emitUserSuspended({ userId, user: suspended });

  emitAdminAuditLog({
    action: 'user_suspended',
    adminUserId,
    targetType: 'user',
    targetId: userId,
    metadata: {
      reason: reason || null,
    },
  });

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

  if (user.role === 'admin') {
    throw new AppError('Cannot reinstate admin accounts', 422, 'CANNOT_REINSTATE_ADMIN');
  }

  if (user.status !== 'suspended') {
    throw new AppError('User is not suspended', 400, 'USER_NOT_SUSPENDED');
  }

  // Update user status back to active
  // TODO: Implement in users.model.js
  const reinstated = await userModel.updateUserStatus(userId, 'active', null);

  emitAdminAuditLog({
    action: 'user_reinstated',
    adminUserId,
    targetType: 'user',
    targetId: userId,
  });

  return reinstated;
};

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get platform analytics for admin dashboard
 */
exports.getPlatformAnalytics = async (period = 'month') => {
  const validPeriods = ['day', 'week', 'month'];
  if (!validPeriods.includes(period)) {
    throw new AppError('Invalid period', 400, 'VALIDATION_FAILED');
  }

  const [
    pendingReports,
    pendingAppeals,
    suspendedAccounts,
    activeUsers,
    newRegistrations,
    totalTracks,
    totalPlays,
  ] = await Promise.all([
    reportModel.getPendingReportsCount(),
    appealModel.getPendingAppealsCount(),
    userModel.getSuspendedAccountsCount(),
    userModel.getActiveUsersCount(period),
    userModel.getNewRegistrationsCount(period),
    adminTrackModel.getTotalTracksCount(period),
    adminTrackModel.getTotalPlaysCount(period),
  ]);

  return {
    period,
    active_users: activeUsers,
    new_registrations: newRegistrations,
    total_tracks: totalTracks,
    total_plays: totalPlays,
    play_through_rate: 0,
    storage_used_gb: 0,
    storage_limit_gb: 0,
    pending_reports: pendingReports,
    pending_appeals: pendingAppeals,
    suspended_accounts: suspendedAccounts,
  };
};
