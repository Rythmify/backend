// ============================================================
// tests/user/services/followers.service.test.js
// ============================================================
const service = require('../../../src/services/followers.service');
const followModel = require('../../../src/models/follow.model');
const followRequestModel = require('../../../src/models/follow-request.model');
const userModel = require('../../../src/models/user.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/follow.model');
jest.mock('../../../src/models/follow-request.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/notifications.service');

describe('Followers Service', () => {
  const userId = 'user-1';
  const targetId = 'user-2';

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('getFollowing', () => {
    it('returns following list', async () => {
      userModel.findById.mockResolvedValue({ id: userId });
      followModel.getFollowing.mockResolvedValue([]);
      await service.getFollowing(userId, 10, 0);
      expect(followModel.getFollowing).toHaveBeenCalledWith(userId, 10, 0);
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.getFollowing(userId)).rejects.toThrow('User not found');
    });

    it('throws 404 if user is deleted', async () => {
      userModel.findById.mockResolvedValue({ id: userId, deleted_at: 'now' });
      await expect(service.getFollowing(userId)).rejects.toThrow('User not found');
    });
  });

  describe('getFollowers', () => {
    it('returns followers list', async () => {
      userModel.findById.mockResolvedValue({ id: userId });
      followModel.getFollowers.mockResolvedValue([]);
      await service.getFollowers(userId, 10, 0);
      expect(followModel.getFollowers).toHaveBeenCalledWith(userId, 10, 0);
    });

    it('throws 404 if user is deleted', async () => {
      userModel.findById.mockResolvedValue({ id: userId, deleted_at: 'now' });
      await expect(service.getFollowers(userId)).rejects.toThrow('User not found');
    });
  });

  describe('searchMyFollowing', () => {
    it('returns search results', async () => {
      userModel.findById.mockResolvedValue({ id: userId });
      followModel.searchMyFollowing.mockResolvedValue([]);
      await service.searchMyFollowing(userId, 'test', 10, 0);
      expect(followModel.searchMyFollowing).toHaveBeenCalledWith(userId, 'test', 10, 0);
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.searchMyFollowing(userId, 'test')).rejects.toThrow('User not found');
    });

    it('throws 400 if query is empty', async () => {
      userModel.findById.mockResolvedValue({ id: userId });
      await expect(service.searchMyFollowing(userId, ' ')).rejects.toThrow('Search query cannot be empty');
    });
  });

  describe('getSuggestedUsersToFollow', () => {
    it('returns suggested users', async () => {
      userModel.findById.mockResolvedValue({ id: userId });
      followModel.getSuggestedUsers.mockResolvedValue([]);
      const res = await service.getSuggestedUsersToFollow(userId, 10, 0);
      expect(res).toEqual([]);
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.getSuggestedUsersToFollow(userId)).rejects.toThrow('User not found');
    });
  });

  describe('getFollowStatus', () => {
    it('returns follow status', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId })
        .mockResolvedValueOnce({ id: targetId });
      followModel.getFollowStatus.mockResolvedValue({ following: true });
      const res = await service.getFollowStatus(userId, targetId);
      expect(res.following).toBe(true);
    });

    it('throws 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.getFollowStatus(userId, targetId)).rejects.toThrow('User not found');
    });

    it('throws 404 if target user not found', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId })
        .mockResolvedValueOnce(null);
      await expect(service.getFollowStatus(userId, targetId)).rejects.toThrow('Target user not found');
    });
  });

  describe('followUser', () => {
    it('performs direct follow for public account', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce({ id: targetId, is_private: false });
      followModel.followUser.mockResolvedValue({ alreadyFollowing: false });

      const result = await service.followUser(userId, targetId);

      expect(result.isRequest).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(notificationsService.createNotification).toHaveBeenCalled();
    });

    it('handles notification error gracefully', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce({ id: targetId, is_private: false });
      followModel.followUser.mockResolvedValue({ alreadyFollowing: false });
      notificationsService.createNotification.mockRejectedValue(new Error('fail'));

      await service.followUser(userId, targetId);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(console.error).toHaveBeenCalled();
    });

    it('creates follow request for private account', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce({ id: targetId, is_private: true });
      followRequestModel.createFollowRequest.mockResolvedValue({ id: 'req-1' });

      const result = await service.followUser(userId, targetId);

      expect(result.isRequest).toBe(true);
      expect(followModel.followUser).not.toHaveBeenCalled();
    });

    it('throws 404 if follower not found', async () => {
      userModel.findById.mockResolvedValueOnce(null);
      await expect(service.followUser(userId, targetId)).rejects.toThrow('User not found');
    });

    it('throws 403 if follower is suspended', async () => {
      userModel.findById.mockResolvedValueOnce({ id: userId, is_suspended: true });
      await expect(service.followUser(userId, targetId)).rejects.toThrow('Suspended users cannot perform this action');
    });

    it('throws 404 if target user not found', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce(null);
      await expect(service.followUser(userId, targetId)).rejects.toThrow('Target user not found');
    });

    it('throws 404 if target user deleted', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce({ id: targetId, deleted_at: 'now' });
      await expect(service.followUser(userId, targetId)).rejects.toThrow('Target user not found');
    });
  });

  describe('unfollowUser', () => {
    it('unfollows user', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce({ id: targetId });
      followModel.unfollowUser.mockResolvedValue(true);

      const result = await service.unfollowUser(userId, targetId);
      expect(result).toBe(true);
    });

    it('throws 404 if follower not found', async () => {
      userModel.findById.mockResolvedValueOnce(null);
      await expect(service.unfollowUser(userId, targetId)).rejects.toThrow('User not found');
    });

    it('throws 403 if follower suspended', async () => {
      userModel.findById.mockResolvedValueOnce({ id: userId, is_suspended: true });
      await expect(service.unfollowUser(userId, targetId)).rejects.toThrow('Suspended users cannot perform this action');
    });

    it('throws 404 if target user not found', async () => {
      userModel.findById
        .mockResolvedValueOnce({ id: userId, is_suspended: false })
        .mockResolvedValueOnce(null);
      await expect(service.unfollowUser(userId, targetId)).rejects.toThrow('Target user not found');
    });
  });
});
