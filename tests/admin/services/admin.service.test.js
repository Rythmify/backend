const service = require('../../../src/services/admin.service');
const reportModel = require('../../../src/models/report.model');
const warningModel = require('../../../src/models/warning.model');
const appealModel = require('../../../src/models/appeal.model');
const userModel = require('../../../src/models/user.model');
const trackModel = require('../../../src/models/track.model');
const adminTrackModel = require('../../../src/models/admin-track.model');
const auditLogModel = require('../../../src/models/audit-log.model');
const refreshTokenModel = require('../../../src/models/refresh-token.model');
const {
  emitReportReceived,
  emitReportResolved,
  emitAppealSubmitted,
  emitAppealReviewed,
  emitUserWarned,
  emitUserSuspended,
  emitAdminAuditLog,
} = require('../../../src/sockets/admin-notifications.socket');

jest.mock('../../../src/models/report.model');
jest.mock('../../../src/models/warning.model');
jest.mock('../../../src/models/appeal.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/track.model');
jest.mock('../../../src/models/admin-track.model');
jest.mock('../../../src/models/audit-log.model');
jest.mock('../../../src/models/refresh-token.model');
jest.mock('../../../src/sockets/admin-notifications.socket');

describe('Admin Service', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const adminUser = { id: validUuid, role: 'admin' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitReport', () => {
    it('throws if resourceType invalid', async () => {
      await expect(service.submitReport('u1', 'invalid', 'r1', 'spam')).rejects.toThrow('Invalid resource_type');
    });

    it('throws if reason invalid', async () => {
      await expect(service.submitReport('u1', 'track', 'r1', 'invalid')).rejects.toThrow('Invalid reason');
    });

    it('throws if impersonation for track', async () => {
      await expect(service.submitReport('u1', 'track', 'r1', 'impersonation')).rejects.toThrow('impersonation reason is only valid for users');
    });

    it('throws if copyright for user', async () => {
      await expect(service.submitReport('u1', 'user', 'r1', 'copyright')).rejects.toThrow('copyright reason is only valid for tracks');
    });

    it('throws if description too long', async () => {
      const longDesc = 'a'.repeat(1001);
      await expect(service.submitReport('u1', 'track', 'r1', 'spam', longDesc)).rejects.toThrow('description must be at most 1000 characters');
    });

    it('throws if track not found', async () => {
      adminTrackModel.getTrackById.mockResolvedValue(null);
      await expect(service.submitReport('u1', 'track', 'r1', 'spam')).rejects.toThrow('Track not found');
    });

    it('throws if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.submitReport('u1', 'user', 'r1', 'spam')).rejects.toThrow('User not found');
    });

    it('throws if already reported', async () => {
      userModel.findById.mockResolvedValue({});
      reportModel.hasUserReported.mockResolvedValue(true);
      await expect(service.submitReport('u1', 'user', 'r1', 'spam')).rejects.toThrow('You have already reported this resource');
    });

    it('throws if report creation fails', async () => {
      userModel.findById.mockResolvedValue({});
      reportModel.hasUserReported.mockResolvedValue(false);
      reportModel.createReport.mockResolvedValue(null);
      await expect(service.submitReport('u1', 'user', 'r1', 'spam')).rejects.toThrow('Failed to create report');
    });

    it('submits report successfully', async () => {
      userModel.findById.mockResolvedValue({});
      reportModel.hasUserReported.mockResolvedValue(false);
      reportModel.createReport.mockResolvedValue({ id: 1 });
      const result = await service.submitReport('u1', 'user', 'r1', 'spam');
      expect(result).toEqual({ id: 1 });
      expect(emitReportReceived).toHaveBeenCalledWith({ report: { id: 1 } });
      expect(emitAdminAuditLog).toHaveBeenCalled();
    });
  });

  describe('listReports', () => {
    it('lists reports successfully', async () => {
      reportModel.getReports.mockResolvedValue([]);
      reportModel.getReportsCount.mockResolvedValue(0);
      const res = await service.listReports({});
      expect(res.data).toEqual([]);
      expect(res.pagination.total).toBe(0);
    });
  });

  describe('getReport', () => {
    it('throws if report not found', async () => {
      reportModel.getReportById.mockResolvedValue(null);
      await expect(service.getReport(1)).rejects.toThrow('Report not found');
    });

    it('gets report successfully', async () => {
      reportModel.getReportById.mockResolvedValue({ id: 1 });
      const res = await service.getReport(1);
      expect(res.id).toBe(1);
    });
  });

  describe('resolveReport', () => {
    it('throws if status invalid', async () => {
      await expect(service.resolveReport(1, 'invalid', 'note', 'admin')).rejects.toThrow('Invalid status');
    });

    it('throws if report not found', async () => {
      reportModel.getReportById.mockResolvedValue(null);
      await expect(service.resolveReport(1, 'resolved', 'note', 'admin')).rejects.toThrow('Report not found');
    });

    it('throws if already resolved', async () => {
      reportModel.getReportById.mockResolvedValue({ status: 'resolved' });
      await expect(service.resolveReport(1, 'resolved', 'note', 'admin')).rejects.toThrow('Report already resolved');
    });

    it('resolves report successfully', async () => {
      reportModel.getReportById.mockResolvedValue({ status: 'pending' });
      reportModel.updateReportStatus.mockResolvedValue({ id: 1, reporter_id: 'u1' });
      const res = await service.resolveReport(1, 'resolved', 'note', 'admin');
      expect(res.id).toBe(1);
      expect(emitReportResolved).toHaveBeenCalled();
      expect(auditLogModel.createLog).toHaveBeenCalled();
    });
  });

  describe('warnUser', () => {
    it('throws if reason invalid', async () => {
      await expect(service.warnUser('u1', 'admin', 'invalid', 'msg')).rejects.toThrow('Invalid warning reason');
    });

    it('throws if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.warnUser('u1', 'admin', 'spam', 'msg')).rejects.toThrow('User not found');
    });

    it('throws if target is admin', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      await expect(service.warnUser('u1', 'admin', 'spam', 'msg')).rejects.toThrow('Cannot warn admin accounts');
    });

    it('throws if message too long', async () => {
      userModel.findById.mockResolvedValue({ role: 'user' });
      const longMsg = 'a'.repeat(501);
      await expect(service.warnUser('u1', 'admin', 'spam', longMsg)).rejects.toThrow('message must be at most 500 characters');
    });

    it('warns user successfully', async () => {
      userModel.findById.mockResolvedValue({ role: 'user' });
      warningModel.createWarning.mockResolvedValue({ id: 1 });
      const res = await service.warnUser('u1', 'admin', 'spam', 'msg');
      expect(res.id).toBe(1);
      expect(emitUserWarned).toHaveBeenCalled();
      expect(auditLogModel.createLog).toHaveBeenCalled();
    });
  });

  describe('getUserWarnings', () => {
    it('throws if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.getUserWarnings('u1')).rejects.toThrow('User not found');
    });

    it('gets user warnings successfully', async () => {
      userModel.findById.mockResolvedValue({ role: 'user' });
      warningModel.getWarningsByUser.mockResolvedValue([]);
      warningModel.getWarningsCount.mockResolvedValue(0);
      warningModel.getUserTotalWarningCount.mockResolvedValue(0);
      const res = await service.getUserWarnings('u1');
      expect(res.data).toEqual([]);
    });
  });

  describe('submitAppeal', () => {
    it('throws if missing reason', async () => {
      await expect(service.submitAppeal(1, '', 'u1')).rejects.toThrow('appeal_reason is required');
    });

    it('throws if reason too long', async () => {
      const longReason = 'a'.repeat(1001);
      await expect(service.submitAppeal(1, longReason, 'u1')).rejects.toThrow('appeal_reason must be at most 1000 characters');
    });

    it('throws if report not found', async () => {
      reportModel.getReportById.mockResolvedValue(null);
      await expect(service.submitAppeal(1, 'mistake', 'u1')).rejects.toThrow('Report not found');
    });

    it('throws if wrong user', async () => {
      reportModel.getReportById.mockResolvedValue({ reporter_id: 'u2' });
      await expect(service.submitAppeal(1, 'mistake', 'u1')).rejects.toThrow('Report does not belong to you');
    });

    it('throws if report is pending', async () => {
      reportModel.getReportById.mockResolvedValue({ reporter_id: 'u1', status: 'pending' });
      await expect(service.submitAppeal(1, 'mistake', 'u1')).rejects.toThrow('Can only appeal resolved or dismissed reports');
    });

    it('throws if already appealed', async () => {
      reportModel.getReportById.mockResolvedValue({ reporter_id: 'u1', status: 'resolved' });
      appealModel.reportHasAppeal.mockResolvedValue(true);
      await expect(service.submitAppeal(1, 'mistake', 'u1')).rejects.toThrow('This report already has an appeal');
    });

    it('throws if creation fails', async () => {
      reportModel.getReportById.mockResolvedValue({ reporter_id: 'u1', status: 'resolved' });
      appealModel.reportHasAppeal.mockResolvedValue(false);
      appealModel.createAppeal.mockResolvedValue(null);
      await expect(service.submitAppeal(1, 'mistake', 'u1')).rejects.toThrow('Failed to create appeal');
    });

    it('submits appeal successfully', async () => {
      reportModel.getReportById.mockResolvedValue({ reporter_id: 'u1', status: 'resolved' });
      appealModel.reportHasAppeal.mockResolvedValue(false);
      appealModel.createAppeal.mockResolvedValue({ id: 1 });
      const res = await service.submitAppeal(1, 'mistake', 'u1');
      expect(res.id).toBe(1);
      expect(emitAppealSubmitted).toHaveBeenCalled();
      expect(emitAdminAuditLog).toHaveBeenCalled();
    });
  });

  describe('listAppeals', () => {
    it('lists appeals successfully', async () => {
      appealModel.getAppeals.mockResolvedValue([]);
      appealModel.getAppealsCount.mockResolvedValue(0);
      const res = await service.listAppeals({});
      expect(res.data).toEqual([]);
    });
  });

  describe('getAppeal', () => {
    it('throws if appeal not found', async () => {
      appealModel.getAppealById.mockResolvedValue(null);
      await expect(service.getAppeal(1)).rejects.toThrow('Appeal not found');
    });

    it('gets appeal successfully', async () => {
      appealModel.getAppealById.mockResolvedValue({ id: 1 });
      const res = await service.getAppeal(1);
      expect(res.id).toBe(1);
    });
  });

  describe('reviewAppeal', () => {
    it('throws if invalid decision', async () => {
      await expect(service.reviewAppeal(1, 'invalid', 'note', 'admin')).rejects.toThrow('Invalid decision');
    });

    it('throws if notes too long', async () => {
      const longNote = 'a'.repeat(501);
      await expect(service.reviewAppeal(1, 'upheld', longNote, 'admin')).rejects.toThrow('admin_notes must be at most 500 characters');
    });

    it('throws if appeal not found', async () => {
      appealModel.getAppealById.mockResolvedValue(null);
      await expect(service.reviewAppeal(1, 'upheld', 'note', 'admin')).rejects.toThrow('Appeal not found');
    });

    it('throws if already reviewed', async () => {
      appealModel.getAppealById.mockResolvedValue({ status: 'reviewed' });
      await expect(service.reviewAppeal(1, 'upheld', 'note', 'admin')).rejects.toThrow('Appeal already reviewed');
    });

    it('reviews appeal successfully', async () => {
      appealModel.getAppealById.mockResolvedValue({ status: 'pending' });
      appealModel.updateAppealDecision.mockResolvedValue({ id: 1, user_id: 'u1' });
      const res = await service.reviewAppeal(1, 'upheld', 'note', 'admin');
      expect(res.id).toBe(1);
      expect(emitAppealReviewed).toHaveBeenCalled();
      expect(emitAdminAuditLog).toHaveBeenCalled();
    });
  });

  describe('deleteTrack', () => {
    it('throws if admin unauthenticated', async () => {
      await expect(service.deleteTrack({ adminUser: null, trackId: validUuid })).rejects.toThrow('Admin not authenticated');
    });

    it('throws if admin has no id', async () => {
      await expect(service.deleteTrack({ adminUser: {}, trackId: validUuid })).rejects.toThrow('Admin not authenticated');
    });

    it('throws if user not admin', async () => {
      userModel.findById.mockResolvedValue({ role: 'user' });
      await expect(service.deleteTrack({ adminUser, trackId: validUuid })).rejects.toThrow('Forbidden: insufficient permissions');
    });

    it('throws if track not found', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      trackModel.deleteTrackPermanently.mockResolvedValue(false);
      await expect(service.deleteTrack({ adminUser, trackId: validUuid })).rejects.toThrow('Track not found');
    });

    it('deletes track successfully with object format', async () => {
      userModel.findById.mockResolvedValue({ id: validUuid, role: 'admin' });
      trackModel.deleteTrackPermanently.mockResolvedValue(true);
      const res = await service.deleteTrack({ adminUser, trackId: validUuid, reason: 'spam' });
      expect(res.deleted).toBe(true);
    });

    it('deletes track successfully with positional args', async () => {
      userModel.findById.mockResolvedValue({ id: validUuid, role: 'admin' });
      trackModel.deleteTrackPermanently.mockResolvedValue(true);
      const res = await service.deleteTrack(validUuid, adminUser, 'spam');
      expect(res.deleted).toBe(true);
    });
  });

  describe('toggleTrackVisibility', () => {
    it('throws if invalid track_id', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      await expect(service.toggleTrackVisibility({ adminUser, trackId: 'invalid', isHidden: true })).rejects.toThrow('track_id must be a valid UUID');
    });

    it('throws if isHidden not boolean', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      await expect(service.toggleTrackVisibility({ adminUser, trackId: validUuid, isHidden: 'true' })).rejects.toThrow('is_hidden must be a boolean');
    });

    it('throws if track not found', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      trackModel.updateTrackHiddenStatus.mockResolvedValue(false);
      await expect(service.toggleTrackVisibility({ adminUser, trackId: validUuid, isHidden: true })).rejects.toThrow('Track not found');
    });

    it('toggles visibility successfully with positional args', async () => {
      userModel.findById.mockResolvedValue({ id: validUuid, role: 'admin' });
      trackModel.updateTrackHiddenStatus.mockResolvedValue(true);
      const res = await service.toggleTrackVisibility(validUuid, true, 'spam', adminUser);
      expect(res).toBe(true);
    });
  });

  describe('hideTrack', () => {
    it('hides track successfully', async () => {
      userModel.findById.mockResolvedValue({ id: validUuid, role: 'admin' });
      trackModel.updateTrackHiddenStatus.mockResolvedValue(true);
      const res = await service.hideTrack({ adminUser, trackId: validUuid });
      expect(res).toBe(true);
    });
  });

  describe('unhideTrack', () => {
    it('unhides track successfully', async () => {
      userModel.findById.mockResolvedValue({ id: validUuid, role: 'admin' });
      trackModel.updateTrackHiddenStatus.mockResolvedValue(true);
      const res = await service.unhideTrack({ adminUser, trackId: validUuid });
      expect(res).toBe(true);
    });
  });

  describe('suspendUser', () => {
    it('throws if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.suspendUser('u1', 'spam', 'admin1')).rejects.toThrow('User not found');
    });

    it('throws if target is admin', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      await expect(service.suspendUser('u1', 'spam', 'admin1')).rejects.toThrow('Cannot suspend admin accounts');
    });

    it('suspends user successfully', async () => {
      userModel.findById.mockResolvedValue({ role: 'user' });
      userModel.updateUserStatus.mockResolvedValue({ id: 'u1' });
      const res = await service.suspendUser('u1', 'spam', 'admin1');
      expect(res.id).toBe('u1');
      expect(refreshTokenModel.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(emitUserSuspended).toHaveBeenCalled();
      expect(auditLogModel.createLog).toHaveBeenCalled();
    });
  });

  describe('reinstateUser', () => {
    it('throws if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.reinstateUser('u1', 'admin1')).rejects.toThrow('User not found');
    });

    it('throws if target is admin', async () => {
      userModel.findById.mockResolvedValue({ role: 'admin' });
      await expect(service.reinstateUser('u1', 'admin1')).rejects.toThrow('Cannot reinstate admin accounts');
    });

    it('throws if user not suspended', async () => {
      userModel.findById.mockResolvedValue({ role: 'user', status: 'active' });
      await expect(service.reinstateUser('u1', 'admin1')).rejects.toThrow('User is not suspended');
    });

    it('reinstates user successfully', async () => {
      userModel.findById.mockResolvedValue({ role: 'user', status: 'suspended' });
      userModel.updateUserStatus.mockResolvedValue({ id: 'u1' });
      const res = await service.reinstateUser('u1', 'admin1');
      expect(res.id).toBe('u1');
      expect(auditLogModel.createLog).toHaveBeenCalled();
    });
  });

  describe('getPlatformAnalytics', () => {
    it('throws if invalid period', async () => {
      await expect(service.getPlatformAnalytics('invalid')).rejects.toThrow('Invalid period');
    });

    it('gets analytics successfully', async () => {
      reportModel.getPendingReportsCount.mockResolvedValue(1);
      appealModel.getPendingAppealsCount.mockResolvedValue(2);
      userModel.getSuspendedAccountsCount.mockResolvedValue(3);
      userModel.getActiveUsersCount.mockResolvedValue(4);
      userModel.getNewRegistrationsCount.mockResolvedValue(5);
      adminTrackModel.getTotalTracksCount.mockResolvedValue(6);
      trackModel.getTracksUploadedToday.mockResolvedValue(7);
      adminTrackModel.getTotalPlaysCount.mockResolvedValue(8);
      userModel.getActiveUsersToday.mockResolvedValue(9);

      const res = await service.getPlatformAnalytics('month');
      expect(res).toEqual({
        period: 'month',
        active_users: 4,
        new_registrations: 5,
        total_tracks: 6,
        tracks_uploaded_today: 7,
        total_plays: 8,
        play_through_rate: 0,
        storage_used_gb: 0,
        storage_limit_gb: 0,
        pending_reports: 1,
        pending_appeals: 2,
        suspended_accounts: 3,
        active_users_today: 9,
      });
    });
  });

  describe('getTracksUploadedToday', () => {
    it('gets tracks uploaded today successfully', async () => {
      userModel.findById.mockResolvedValue({ id: validUuid, role: 'admin' });
      trackModel.getTracksUploadedToday.mockResolvedValue(5);
      const res = await service.getTracksUploadedToday({ adminUser });
      expect(res.tracks_uploaded_today).toBe(5);
    });
  });
});
