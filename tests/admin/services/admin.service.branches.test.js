// ============================================================
// tests/admin/services/admin.service.branches.test.js
// Coverage Target: 100%
// ============================================================

const adminService = require('../../../src/services/admin.service');
const userModel = require('../../../src/models/user.model');
const reportModel = require('../../../src/models/report.model');
const appealModel = require('../../../src/models/appeal.model');
const warningModel = require('../../../src/models/warning.model');

jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/report.model');
jest.mock('../../../src/models/appeal.model');
jest.mock('../../../src/models/warning.model');
jest.mock('../../../src/models/track.model');
jest.mock('../../../src/models/admin-track.model');
jest.mock('../../../src/models/audit-log.model');
jest.mock('../../../src/models/refresh-token.model');
jest.mock('../../../src/sockets/admin-notifications.socket');

describe('Admin Service - Branch Coverage Expansion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAdminUser Branches', () => {
    it('throws if user is not an admin', async () => {
        const adminId = '11111111-1111-4111-8111-111111111111';
        userModel.findById.mockResolvedValue({ id: adminId, role: 'listener' });
        await expect(adminService.getTracksUploadedToday({ adminUser: adminId }))
            .rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws if user not found', async () => {
        const adminId = '11111111-1111-4111-8111-111111111111';
        userModel.findById.mockResolvedValue(null);
        await expect(adminService.getTracksUploadedToday({ adminUser: adminId }))
            .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    });
  });

  describe('submitReport Branches', () => {
    it('throws if impersonation reason used for track', async () => {
        await expect(adminService.submitReport('u1', 'track', 't1', 'impersonation'))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('throws if copyright reason used for user', async () => {
        await expect(adminService.submitReport('u1', 'user', 'u2', 'copyright'))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('throws if description too long', async () => {
        await expect(adminService.submitReport('u1', 'track', 't1', 'spam', 'a'.repeat(1001)))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('warnUser Branches', () => {
    it('throws if trying to warn an admin', async () => {
        userModel.findById.mockResolvedValue({ id: 'u2', role: 'admin' });
        await expect(adminService.warnUser('u2', 'admin1', 'spam'))
            .rejects.toMatchObject({ code: 'CANNOT_WARN_ADMIN' });
    });

    it('throws if message too long', async () => {
        userModel.findById.mockResolvedValue({ id: 'u2', role: 'listener' });
        await expect(adminService.warnUser('u2', 'admin1', 'spam', 'a'.repeat(501)))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('Appeal Branches', () => {
    it('throws if appealing pending report', async () => {
        reportModel.getReportById.mockResolvedValue({ id: 'r1', reporter_id: 'u1', status: 'pending' });
        await expect(adminService.submitAppeal('r1', 'reason', 'u1'))
            .rejects.toMatchObject({ code: 'INVALID_APPEAL' });
    });

    it('throws if appeal reason too long', async () => {
        await expect(adminService.submitAppeal('r1', 'a'.repeat(1001), 'u1'))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('throws if reviewing non-pending appeal', async () => {
        appealModel.getAppealById.mockResolvedValue({ id: 'a1', status: 'upheld' });
        await expect(adminService.reviewAppeal('a1', 'overturned', 'notes', 'admin1'))
            .rejects.toMatchObject({ code: 'APPEAL_ALREADY_REVIEWED' });
    });
  });

  describe('User Status Branches', () => {
    it('throws if reinstating non-suspended user', async () => {
        userModel.findById.mockResolvedValue({ id: 'u1', status: 'active' });
        await expect(adminService.reinstateUser('u1', 'admin1'))
            .rejects.toMatchObject({ code: 'USER_NOT_SUSPENDED' });
    });
  });
});
