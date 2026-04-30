jest.mock('../src/models/report.model', () => ({
  getPendingReportsCount: jest.fn(),
}));

jest.mock('../src/models/appeal.model', () => ({
  getPendingAppealsCount: jest.fn(),
}));

jest.mock('../src/models/user.model', () => ({
  findById: jest.fn(),
  updateUserStatus: jest.fn(),
  getSuspendedAccountsCount: jest.fn(),
  getActiveUsersCount: jest.fn(),
  getNewRegistrationsCount: jest.fn(),
  getActiveUsersToday: jest.fn(),
}));

jest.mock('../src/models/track.model', () => ({
  deleteTrackPermanently: jest.fn(),
  softDeleteTrack: jest.fn(),
  getTracksUploadedToday: jest.fn(),
}));

jest.mock('../src/models/admin-track.model', () => ({
  getTotalTracksCount: jest.fn(),
  getTotalPlaysCount: jest.fn(),
}));

jest.mock('../src/models/audit-log.model', () => ({
  createLog: jest.fn(),
}));

jest.mock('../src/sockets/admin-notifications.socket', () => ({
  emitReportReceived: jest.fn(),
  emitReportResolved: jest.fn(),
  emitAppealSubmitted: jest.fn(),
  emitAppealReviewed: jest.fn(),
  emitUserWarned: jest.fn(),
  emitUserSuspended: jest.fn(),
  emitAdminAuditLog: jest.fn(),
}));

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const { requireRole } = require('../src/middleware/roles');
const adminService = require('../src/services/admin.service');
const reportModel = require('../src/models/report.model');
const appealModel = require('../src/models/appeal.model');
const userModel = require('../src/models/user.model');
const trackModel = require('../src/models/track.model');
const adminTrackModel = require('../src/models/admin-track.model');
const auditLogModel = require('../src/models/audit-log.model');
const warningModel = require('../src/models/warning.model');
const db = require('../src/config/db');

describe('Admin role guard', () => {
  it('returns 403 with FORBIDDEN code for non-admin user', async () => {
    const middleware = requireRole('admin');
    const req = { user: { role: 'user' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden: insufficient permissions',
      },
    });
  });
});

describe('Report rate limiter', () => {
  it('returns 429 after 10 report submissions in 1 hour', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const reloadedExpress = require('express');
    const reloadedRequest = require('supertest');
    const { reportRateLimiter } = require('../src/middleware/rate-limiter');

    const app = reloadedExpress();
    app.use(reloadedExpress.json());
    app.post('/reports', reportRateLimiter, (req, res) => {
      res.status(201).json({ ok: true });
    });

    for (let i = 0; i < 10; i += 1) {
      const response = await reloadedRequest(app)
        .post('/reports')
        .send({ resource_type: 'track', resource_id: 'x', reason: 'spam' });
      expect(response.status).toBe(201);
    }

    const blockedResponse = await reloadedRequest(app)
      .post('/reports')
      .send({ resource_type: 'track', resource_id: 'x', reason: 'spam' });

    expect(blockedResponse.status).toBe(429);

    process.env.NODE_ENV = previousNodeEnv;
    jest.resetModules();
  });
});

describe('getPlatformAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns analytics with active_users_today and tracks_uploaded_today', async () => {
    reportModel.getPendingReportsCount.mockResolvedValue(4);
    appealModel.getPendingAppealsCount.mockResolvedValue(2);
    userModel.getSuspendedAccountsCount.mockResolvedValue(1);
    userModel.getActiveUsersCount.mockResolvedValue(17);
    userModel.getNewRegistrationsCount.mockResolvedValue(3);
    adminTrackModel.getTotalTracksCount.mockResolvedValue(55);
    trackModel.getTracksUploadedToday.mockResolvedValue(6);
    adminTrackModel.getTotalPlaysCount.mockResolvedValue(120);
    userModel.getActiveUsersToday.mockResolvedValue(8);

    const result = await adminService.getPlatformAnalytics('month');

    expect(result.tracks_uploaded_today).toBe(6);
    expect(result.active_users_today).toBe(8);
  });
});

describe('deleteTrack service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls deleteTrackPermanently not softDeleteTrack', async () => {
    const adminId = '11111111-1111-1111-1111-111111111111';
    const trackId = '22222222-2222-2222-2222-222222222222';

    userModel.findById.mockResolvedValue({ id: adminId, role: 'admin' });
    trackModel.deleteTrackPermanently.mockResolvedValue({ id: trackId });

    await adminService.deleteTrack({
      adminUser: { id: adminId, role: 'admin' },
      trackId,
      reason: 'policy',
    });

    expect(trackModel.deleteTrackPermanently).toHaveBeenCalledWith(trackId);
    expect(trackModel.softDeleteTrack).not.toHaveBeenCalled();
  });
});

describe('createWarning model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets warning_count to previous count + 1 for user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'w1', user_id: 'u1', warning_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'w2', user_id: 'u1', warning_count: 2 }] });

    const first = await warningModel.createWarning('u1', 'a1', 'spam', 'first warning');
    const second = await warningModel.createWarning('u1', 'a1', 'spam', 'second warning');

    expect(first.warning_count).toBe(1);
    expect(second.warning_count).toBe(2);
    expect(db.query.mock.calls[1][0]).toContain(
      '(SELECT COUNT(*) + 1 FROM warnings WHERE user_id = $1)'
    );
  });
});

describe('reinstateUser service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an audit log entry after reinstatement', async () => {
    const userId = '33333333-3333-3333-3333-333333333333';
    const adminId = '44444444-4444-4444-4444-444444444444';

    userModel.findById.mockResolvedValue({ id: userId, role: 'listener', status: 'suspended' });
    userModel.updateUserStatus.mockResolvedValue({ id: userId, status: 'active' });

    await adminService.reinstateUser(userId, adminId);

    expect(auditLogModel.createLog).toHaveBeenCalledWith({
      adminId,
      action: 'user_reinstated',
      targetType: 'user',
      targetId: userId,
      metadata: null,
    });
  });
});
