// ============================================================
// tests/user/services/follow-request.service.test.js
// ============================================================
const service = require('../../../src/services/follow-request.service');
const followRequestModel = require('../../../src/models/follow-request.model');
const userModel = require('../../../src/models/user.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/follow-request.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/notifications.service');

describe('Follow Request Service', () => {
  const userId = 'user-1';
  const followerId = 'follower-2';
  const requestId = 'req-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingFollowRequests', () => {
    it('returns pending requests', async () => {
      followRequestModel.getPendingRequests.mockResolvedValue({ items: [], total: 0 });
      await service.getPendingFollowRequests(userId, 10, 0);
      expect(followRequestModel.getPendingRequests).toHaveBeenCalledWith(userId, 10, 0);
    });

    it('throws 400 on invalid pagination', async () => {
      await expect(service.getPendingFollowRequests(userId, 150, 0)).rejects.toThrow('Limit must be 1-100');
    });
  });

  describe('getRequestStatus', () => {
    it('returns status', async () => {
      followRequestModel.getRequestStatus.mockResolvedValue('pending');
      expect(await service.getRequestStatus(followerId, userId)).toBe('pending');
    });
  });

  describe('acceptFollowRequest', () => {
    it('accepts successfully and notifies', async () => {
      userModel.findById.mockResolvedValue({ id: userId, is_suspended: false });
      followRequestModel.acceptFollowRequest.mockResolvedValue({
        id: requestId,
        follower_id: followerId,
        following_id: userId,
        status: 'accepted',
        isNew: true
      });

      const res = await service.acceptFollowRequest(requestId, userId);

      expect(res.status).toBe('accepted');
      expect(notificationsService.createNotification).toHaveBeenCalled();
    });

    it('throws 403 if user suspended', async () => {
      userModel.findById.mockResolvedValue({ id: userId, is_suspended: true });
      await expect(service.acceptFollowRequest(requestId, userId)).rejects.toThrow('Suspended users cannot perform this action');
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.acceptFollowRequest(requestId, userId)).rejects.toThrow('User not found');
    });
  });

  describe('rejectFollowRequest', () => {
    it('rejects successfully', async () => {
      userModel.findById.mockResolvedValue({ id: userId, is_suspended: false });
      followRequestModel.rejectFollowRequest.mockResolvedValue({
        id: requestId,
        status: 'rejected'
      });

      const res = await service.rejectFollowRequest(requestId, userId);
      expect(res.status).toBe('rejected');
    });

    it('throws 403 if user suspended', async () => {
      userModel.findById.mockResolvedValue({ id: userId, is_suspended: true });
      await expect(service.rejectFollowRequest(requestId, userId)).rejects.toThrow('Suspended users cannot perform this action');
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.rejectFollowRequest(requestId, userId)).rejects.toThrow('User not found');
    });
  });

  describe('cancelFollowRequest', () => {
    it('cancels successfully', async () => {
      userModel.findById.mockResolvedValue({ id: followerId });
      followRequestModel.cancelFollowRequest.mockResolvedValue();

      const res = await service.cancelFollowRequest(requestId, followerId);
      expect(res.success).toBe(true);
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.cancelFollowRequest(requestId, followerId)).rejects.toThrow('User not found');
    });
  });
});
