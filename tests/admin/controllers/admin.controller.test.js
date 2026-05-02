const controller = require('../../../src/controllers/admin.controller');
const adminService = require('../../../src/services/admin.service');
const { success } = require('../../../src/utils/api-response');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/admin.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

describe('Admin Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 'admin1', role: 'admin' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('submitReport', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.submitReport(req, res)).rejects.toThrow(AppError);
    });

    it('submits report successfully', async () => {
      req.body = { resource_type: 'track', resource_id: 't1', reason: 'spam', description: 'desc' };
      adminService.submitReport.mockResolvedValue({ id: 1 });
      await controller.submitReport(req, res);
      expect(adminService.submitReport).toHaveBeenCalledWith('admin1', 'track', 't1', 'spam', 'desc');
      expect(success).toHaveBeenCalledWith(res, { id: 1 }, 'Report submitted successfully', 201);
    });
  });

  describe('listReports', () => {
    it('lists reports successfully', async () => {
      req.query = { status: 'pending', reason: 'spam', limit: '10', offset: '5' };
      adminService.listReports.mockResolvedValue({ data: [], pagination: {} });
      await controller.listReports(req, res);
      expect(adminService.listReports).toHaveBeenCalledWith({ status: 'pending', reason: 'spam', limit: 10, offset: 5 });
      expect(success).toHaveBeenCalledWith(res, [], 'Reports fetched successfully', 200, {});
    });
  });

  describe('getReport', () => {
    it('gets report successfully', async () => {
      req.params = { id: 1 };
      adminService.getReport.mockResolvedValue({ id: 1 });
      await controller.getReport(req, res);
      expect(adminService.getReport).toHaveBeenCalledWith(1);
      expect(success).toHaveBeenCalledWith(res, { id: 1 }, 'Report fetched successfully', 200);
    });
  });

  describe('resolveReport', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.resolveReport(req, res)).rejects.toThrow(AppError);
    });

    it('resolves report successfully', async () => {
      req.params = { id: 1 };
      req.body = { status: 'resolved', admin_note: 'ok' };
      adminService.resolveReport.mockResolvedValue({ id: 1 });
      await controller.resolveReport(req, res);
      expect(adminService.resolveReport).toHaveBeenCalledWith(1, 'resolved', 'ok', 'admin1');
      expect(success).toHaveBeenCalledWith(res, { id: 1 }, 'Report resolved successfully', 200);
    });
  });

  describe('warnUser', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.warnUser(req, res)).rejects.toThrow(AppError);
    });

    it('warns user successfully', async () => {
      req.params = { id: 'u1' };
      req.body = { reason: 'spam', message: 'stop' };
      adminService.warnUser.mockResolvedValue({ user_id: 'u1', warning_count: 1, created_at: 'now' });
      await controller.warnUser(req, res);
      expect(adminService.warnUser).toHaveBeenCalledWith('u1', 'admin1', 'spam', 'stop');
      expect(success).toHaveBeenCalledWith(res, { user_id: 'u1', warning_count: 1, warned_at: 'now' }, 'Warning issued successfully', 200);
    });
  });

  describe('submitAppeal', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.submitAppeal(req, res)).rejects.toThrow(AppError);
    });

    it('submits appeal successfully', async () => {
      req.params = { id: 1 };
      req.body = { appeal_reason: 'mistake' };
      adminService.submitAppeal.mockResolvedValue({ id: 1 });
      await controller.submitAppeal(req, res);
      expect(adminService.submitAppeal).toHaveBeenCalledWith(1, 'mistake', 'admin1');
      expect(success).toHaveBeenCalledWith(res, { id: 1 }, 'Appeal submitted successfully', 200);
    });
  });

  describe('listAppeals', () => {
    it('lists appeals successfully', async () => {
      req.query = {};
      adminService.listAppeals.mockResolvedValue({ data: [], pagination: {} });
      await controller.listAppeals(req, res);
      expect(adminService.listAppeals).toHaveBeenCalledWith({ status: 'pending', limit: 20, offset: 0 });
      expect(success).toHaveBeenCalledWith(res, [], 'Appeals fetched successfully', 200, {});
    });
  });

  describe('getAppeal', () => {
    it('gets appeal successfully', async () => {
      req.params = { id: 1 };
      adminService.getAppeal.mockResolvedValue({ id: 1 });
      await controller.getAppeal(req, res);
      expect(adminService.getAppeal).toHaveBeenCalledWith(1);
      expect(success).toHaveBeenCalledWith(res, { id: 1 }, 'Appeal fetched successfully', 200);
    });
  });

  describe('reviewAppeal', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.reviewAppeal(req, res)).rejects.toThrow(AppError);
    });

    it('reviews appeal successfully', async () => {
      req.params = { id: 1 };
      req.body = { decision: 'approved', admin_notes: 'ok' };
      adminService.reviewAppeal.mockResolvedValue({ id: 1 });
      await controller.reviewAppeal(req, res);
      expect(adminService.reviewAppeal).toHaveBeenCalledWith(1, 'approved', 'ok', 'admin1');
      expect(success).toHaveBeenCalledWith(res, { id: 1 }, 'Appeal reviewed successfully', 200);
    });
  });

  describe('deleteTrack', () => {
    it('deletes track successfully', async () => {
      req.params = { id: 't1' };
      await controller.deleteTrack(req, res);
      expect(adminService.deleteTrack).toHaveBeenCalledWith({ adminUser: req.user, trackId: 't1', reason: 'Track deleted by admin' });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('toggleTrackVisibility', () => {
    it('toggles visibility successfully', async () => {
      req.params = { id: 't1' };
      req.body = { is_hidden: true, reason: 'spam' };
      adminService.toggleTrackVisibility.mockResolvedValue({ id: 't1', is_hidden: true });
      await controller.toggleTrackVisibility(req, res);
      expect(adminService.toggleTrackVisibility).toHaveBeenCalledWith({ adminUser: req.user, trackId: 't1', isHidden: true, reason: 'spam' });
      expect(success).toHaveBeenCalledWith(res, { track_id: 't1', is_hidden: true }, 'Track visibility updated successfully', 200);
    });
  });

  describe('hideTrack', () => {
    it('hides track successfully', async () => {
      req.params = { id: 't1' };
      req.body = { reason: 'spam' };
      adminService.hideTrack.mockResolvedValue({ id: 't1', is_hidden: true });
      await controller.hideTrack(req, res);
      expect(adminService.hideTrack).toHaveBeenCalledWith({ adminUser: req.user, trackId: 't1', reason: 'spam' });
      expect(success).toHaveBeenCalledWith(res, { track_id: 't1', is_hidden: true }, 'Track hidden successfully', 200);
    });
  });

  describe('unhideTrack', () => {
    it('unhides track successfully', async () => {
      req.params = { id: 't1' };
      req.body = { reason: 'mistake' };
      adminService.unhideTrack.mockResolvedValue({ id: 't1', is_hidden: false });
      await controller.unhideTrack(req, res);
      expect(adminService.unhideTrack).toHaveBeenCalledWith({ adminUser: req.user, trackId: 't1', reason: 'mistake' });
      expect(success).toHaveBeenCalledWith(res, { track_id: 't1', is_hidden: false }, 'Track unhidden successfully', 200);
    });
  });

  describe('suspendUser', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.suspendUser(req, res)).rejects.toThrow(AppError);
    });

    it('suspends user successfully', async () => {
      req.params = { id: 'u1' };
      req.body = { reason: 'spam' };
      adminService.suspendUser.mockResolvedValue({ id: 'u1', status: 'suspended', suspension_reason: 'spam', suspended_at: 'now' });
      await controller.suspendUser(req, res);
      expect(adminService.suspendUser).toHaveBeenCalledWith('u1', 'spam', 'admin1');
      expect(success).toHaveBeenCalledWith(res, { id: 'u1', status: 'suspended', reason: 'spam', suspended_at: 'now' }, 'User suspended successfully', 200);
    });
  });

  describe('reinstateUser', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.reinstateUser(req, res)).rejects.toThrow(AppError);
    });

    it('reinstates user successfully', async () => {
      req.params = { id: 'u1' };
      adminService.reinstateUser.mockResolvedValue({ id: 'u1', status: 'active', updated_at: 'now' });
      await controller.reinstateUser(req, res);
      expect(adminService.reinstateUser).toHaveBeenCalledWith('u1', 'admin1');
      expect(success).toHaveBeenCalledWith(res, { id: 'u1', status: 'active', reinstated_at: 'now' }, 'User reinstated successfully', 200);
    });
  });

  describe('getAnalytics', () => {
    it('gets analytics successfully', async () => {
      req.query = { period: 'week' };
      adminService.getPlatformAnalytics.mockResolvedValue({ stats: {} });
      await controller.getAnalytics(req, res);
      expect(adminService.getPlatformAnalytics).toHaveBeenCalledWith('week');
      expect(success).toHaveBeenCalledWith(res, { stats: {} }, 'Analytics fetched successfully', 200);
    });
  });

  describe('getTracksUploadedToday', () => {
    it('gets daily analytics successfully', async () => {
      adminService.getTracksUploadedToday.mockResolvedValue({ count: 5 });
      await controller.getTracksUploadedToday(req, res);
      expect(adminService.getTracksUploadedToday).toHaveBeenCalledWith({ adminUser: req.user });
      expect(success).toHaveBeenCalledWith(res, { count: 5 }, 'Daily upload analytics fetched successfully', 200);
    });
  });
});
