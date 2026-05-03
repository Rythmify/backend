const trackRepostsService = require('../../../src/services/track-reposts.service');
const trackRepostModel = require('../../../src/models/track-repost.model');
const userModel = require('../../../src/models/user.model');
const followModel = require('../../../src/models/follow.model');
const notificationModel = require('../../../src/models/notification.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/track-repost.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/follow.model');
jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/services/notifications.service');

describe('Track Reposts Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrackReposters', () => {
    it('throws if trackId is missing', async () => {
      await expect(trackRepostsService.getTrackReposters('')).rejects.toThrow(AppError);
    });

    it('returns reposters with default pagination', async () => {
      trackRepostModel.getTrackReposters.mockResolvedValue([]);
      await trackRepostsService.getTrackReposters('t1');
      expect(trackRepostModel.getTrackReposters).toHaveBeenCalledWith('t1', 20, 0);
    });

    it('returns reposters with bounds checked pagination', async () => {
      trackRepostModel.getTrackReposters.mockResolvedValue([]);
      await trackRepostsService.getTrackReposters('t1', 200, -5);
      expect(trackRepostModel.getTrackReposters).toHaveBeenCalledWith('t1', 20, 0);
    });
  });

  describe('repostTrack', () => {
    it('throws if userId is missing', async () => {
      await expect(trackRepostsService.repostTrack('', 't1')).rejects.toThrow(AppError);
    });

    it('throws if trackId is missing', async () => {
      await expect(trackRepostsService.repostTrack('u1', '')).rejects.toThrow(AppError);
    });

    it('throws if user tries to repost their own track', async () => {
      trackRepostModel.getTrackOwner.mockResolvedValue('u1');
      await expect(trackRepostsService.repostTrack('u1', 't1')).rejects.toThrow(AppError);
    });

    it('reposts track and does not notify if not newly created', async () => {
      trackRepostModel.getTrackOwner.mockResolvedValue('owner1');
      trackRepostModel.repostTrack.mockResolvedValue({ created: false, repost: { id: 'r1', user_id: 'u1', track_id: 't1', created_at: 'now' } });
      const res = await trackRepostsService.repostTrack('u1', 't1');
      expect(res).toEqual({ repostId: 'r1', userId: 'u1', trackId: 't1', createdAt: 'now', isNew: false });
      expect(notificationModel.getTrackOwnerId).not.toHaveBeenCalled();
    });

    it('reposts track and notifies owner if newly created', async () => {
      trackRepostModel.getTrackOwner.mockResolvedValue('owner1');
      trackRepostModel.repostTrack.mockResolvedValue({ created: true, repost: { id: 'r1', user_id: 'u1', track_id: 't1', created_at: 'now' } });
      notificationModel.getTrackOwnerId.mockResolvedValue('owner1');
      const res = await trackRepostsService.repostTrack('u1', 't1');
      expect(res).toEqual({ repostId: 'r1', userId: 'u1', trackId: 't1', createdAt: 'now', isNew: true });
      
      await new Promise(process.nextTick);
      
      expect(notificationsService.createNotification).toHaveBeenCalledWith({
        userId: 'owner1',
        actionUserId: 'u1',
        type: 'repost',
        referenceId: 't1',
        referenceType: 'track'
      });
    });

    it('reposts track but does not notify if owner is the user', async () => {
      trackRepostModel.getTrackOwner.mockResolvedValue('owner1');
      trackRepostModel.repostTrack.mockResolvedValue({ created: true, repost: { id: 'r1' } });
      notificationModel.getTrackOwnerId.mockResolvedValue('u1');
      await trackRepostsService.repostTrack('u1', 't1');
      await new Promise(process.nextTick);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('catches notification error', async () => {
      trackRepostModel.getTrackOwner.mockResolvedValue('owner1');
      trackRepostModel.repostTrack.mockResolvedValue({ created: true, repost: { id: 'r1' } });
      notificationModel.getTrackOwnerId.mockResolvedValue('owner1');
      notificationsService.createNotification.mockRejectedValue(new Error('fail'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await trackRepostsService.repostTrack('u1', 't1');
      await new Promise(process.nextTick);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('removeRepost', () => {
    it('throws if userId is missing', async () => {
      await expect(trackRepostsService.removeRepost('', 't1')).rejects.toThrow(AppError);
    });

    it('throws if trackId is missing', async () => {
      await expect(trackRepostsService.removeRepost('u1', '')).rejects.toThrow(AppError);
    });

    it('throws 404 if repost not found', async () => {
      trackRepostModel.removeRepost.mockResolvedValue(false);
      await expect(trackRepostsService.removeRepost('u1', 't1')).rejects.toThrow(AppError);
    });

    it('removes repost successfully', async () => {
      trackRepostModel.removeRepost.mockResolvedValue(true);
      await expect(trackRepostsService.removeRepost('u1', 't1')).resolves.toBe(true);
    });
  });

  describe('getUserRepostedTracks', () => {
    it('throws if userId is missing', async () => {
      await expect(trackRepostsService.getUserRepostedTracks('')).rejects.toThrow(AppError);
    });

    it('returns normalized tracks with default pagination', async () => {
      trackRepostModel.getUserRepostedTracks.mockResolvedValue({
        items: [{ id: 't1', is_liked_by_me: 1, is_reposted_by_me: 0 }]
      });
      const res = await trackRepostsService.getUserRepostedTracks('u1');
      expect(trackRepostModel.getUserRepostedTracks).toHaveBeenCalledWith('u1', 'u1', 20, 0);
      expect(res.items[0]).toEqual({
        id: 't1',
        is_liked_by_me: true,
        is_reposted_by_me: false,
        is_artist_followed_by_me: false,
      });
    });

    it('handles null track items', async () => {
      trackRepostModel.getUserRepostedTracks.mockResolvedValue({ items: [null] });
      const res = await trackRepostsService.getUserRepostedTracks('u1');
      expect(res.items).toEqual([null]);
    });
  });

  describe('getPublicUserRepostedTracks', () => {
    it('throws if targetUserId is missing', async () => {
      await expect(trackRepostsService.getPublicUserRepostedTracks('', 'requester')).rejects.toThrow(AppError);
    });

    it('throws 404 if target user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(trackRepostsService.getPublicUserRepostedTracks('t1', 'r1')).rejects.toThrow(AppError);
    });

    it('throws 403 if target user is private and requester is null', async () => {
      userModel.findById.mockResolvedValue({ is_private: true });
      await expect(trackRepostsService.getPublicUserRepostedTracks('t1', null)).rejects.toThrow(AppError);
    });

    it('throws 403 if target user is private and requester does not follow', async () => {
      userModel.findById.mockResolvedValue({ is_private: true });
      followModel.getFollowStatus.mockResolvedValue({ is_following: false });
      await expect(trackRepostsService.getPublicUserRepostedTracks('t1', 'r1')).rejects.toThrow(AppError);
    });

    it('returns tracks if target user is private but requester follows', async () => {
      userModel.findById.mockResolvedValue({ is_private: true });
      followModel.getFollowStatus.mockResolvedValue({ is_following: true });
      trackRepostModel.getUserRepostedTracks.mockResolvedValue({ items: [{ id: 't1' }] });
      const res = await trackRepostsService.getPublicUserRepostedTracks('t1', 'r1');
      expect(res.items[0].id).toBe('t1');
      expect(trackRepostModel.getUserRepostedTracks).toHaveBeenCalledWith('t1', 'r1', 20, 0);
    });

    it('returns tracks if target user is public', async () => {
      userModel.findById.mockResolvedValue({ is_private: false });
      trackRepostModel.getUserRepostedTracks.mockResolvedValue({ items: [{ id: 't1' }] });
      const res = await trackRepostsService.getPublicUserRepostedTracks('t1', 'r1');
      expect(res.items[0].id).toBe('t1');
    });
    
    it('returns tracks if target user is private but requester is target', async () => {
      userModel.findById.mockResolvedValue({ is_private: true });
      trackRepostModel.getUserRepostedTracks.mockResolvedValue({ items: [{ id: 't1' }] });
      const res = await trackRepostsService.getPublicUserRepostedTracks('t1', 't1');
      expect(res.items[0].id).toBe('t1');
    });
  });

  describe('isTrackRepostedByUser', () => {
    it('returns false if userId is missing', async () => {
      await expect(trackRepostsService.isTrackRepostedByUser(null, 't1')).resolves.toBe(false);
    });

    it('checks if track is reposted', async () => {
      trackRepostModel.isTrackRepostedByUser.mockResolvedValue(true);
      await expect(trackRepostsService.isTrackRepostedByUser('u1', 't1')).resolves.toBe(true);
    });
  });

  describe('getTrackRepostCount', () => {
    it('returns 0 if trackId is missing', async () => {
      await expect(trackRepostsService.getTrackRepostCount(null)).resolves.toBe(0);
    });

    it('gets track repost count', async () => {
      trackRepostModel.getTrackRepostCount.mockResolvedValue(5);
      await expect(trackRepostsService.getTrackRepostCount('t1')).resolves.toBe(5);
    });
  });
});
