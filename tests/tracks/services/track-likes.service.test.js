const trackLikesService = require('../../../src/services/track-likes.service');
const trackLikeModel = require('../../../src/models/track-like.model');
const notificationModel = require('../../../src/models/notification.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/track-like.model');
jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/services/notifications.service');

describe('Track Likes Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrackLikers', () => {
    it('throws if trackId is missing', async () => {
      await expect(trackLikesService.getTrackLikers('')).rejects.toThrow(AppError);
    });

    it('returns likers with default pagination', async () => {
      trackLikeModel.getTrackLikers.mockResolvedValue([]);
      await trackLikesService.getTrackLikers('t1');
      expect(trackLikeModel.getTrackLikers).toHaveBeenCalledWith('t1', 20, 0);
    });

    it('returns likers with bounds checked pagination', async () => {
      trackLikeModel.getTrackLikers.mockResolvedValue([]);
      await trackLikesService.getTrackLikers('t1', 200, -5);
      expect(trackLikeModel.getTrackLikers).toHaveBeenCalledWith('t1', 20, 0);
    });
  });

  describe('likeTrack', () => {
    it('throws if userId is missing', async () => {
      await expect(trackLikesService.likeTrack('', 't1')).rejects.toThrow(AppError);
    });

    it('throws if trackId is missing', async () => {
      await expect(trackLikesService.likeTrack('u1', '')).rejects.toThrow(AppError);
    });

    it('likes track and does not notify if not newly created', async () => {
      trackLikeModel.likeTrack.mockResolvedValue({ created: false, like: { id: 'l1', user_id: 'u1', track_id: 't1', created_at: 'now' } });
      const res = await trackLikesService.likeTrack('u1', 't1');
      expect(res).toEqual({ likeId: 'l1', userId: 'u1', trackId: 't1', createdAt: 'now', isNew: false });
      expect(notificationModel.getTrackOwnerId).not.toHaveBeenCalled();
    });

    it('likes track and notifies owner if newly created', async () => {
      trackLikeModel.likeTrack.mockResolvedValue({ created: true, like: { id: 'l1', user_id: 'u1', track_id: 't1', created_at: 'now' } });
      notificationModel.getTrackOwnerId.mockResolvedValue('owner1');
      const res = await trackLikesService.likeTrack('u1', 't1');
      expect(res).toEqual({ likeId: 'l1', userId: 'u1', trackId: 't1', createdAt: 'now', isNew: true });
      
      // Wait for async background task to complete in tests
      await new Promise(process.nextTick);
      
      expect(notificationsService.createNotification).toHaveBeenCalledWith({
        userId: 'owner1',
        actionUserId: 'u1',
        type: 'like',
        referenceId: 't1',
        referenceType: 'track'
      });
    });
    
    it('likes track but does not notify if owner is the user', async () => {
      trackLikeModel.likeTrack.mockResolvedValue({ created: true, like: { id: 'l1' } });
      notificationModel.getTrackOwnerId.mockResolvedValue('u1');
      await trackLikesService.likeTrack('u1', 't1');
      await new Promise(process.nextTick);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
    
    it('catches notification error', async () => {
      trackLikeModel.likeTrack.mockResolvedValue({ created: true, like: { id: 'l1' } });
      notificationModel.getTrackOwnerId.mockResolvedValue('owner1');
      notificationsService.createNotification.mockRejectedValue(new Error('fail'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await trackLikesService.likeTrack('u1', 't1');
      await new Promise(process.nextTick);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('unlikeTrack', () => {
    it('throws if userId is missing', async () => {
      await expect(trackLikesService.unlikeTrack('', 't1')).rejects.toThrow(AppError);
    });

    it('throws if trackId is missing', async () => {
      await expect(trackLikesService.unlikeTrack('u1', '')).rejects.toThrow(AppError);
    });

    it('throws 404 if like not found', async () => {
      trackLikeModel.unlikeTrack.mockResolvedValue(false);
      await expect(trackLikesService.unlikeTrack('u1', 't1')).rejects.toThrow(AppError);
    });

    it('unlikes track successfully', async () => {
      trackLikeModel.unlikeTrack.mockResolvedValue(true);
      await expect(trackLikesService.unlikeTrack('u1', 't1')).resolves.toBe(true);
    });
  });

  describe('getUserLikedTracks', () => {
    it('throws if userId is missing', async () => {
      await expect(trackLikesService.getUserLikedTracks('')).rejects.toThrow(AppError);
    });

    it('returns normalized tracks with default pagination', async () => {
      trackLikeModel.getUserLikedTracks.mockResolvedValue({
        items: [{ id: 't1', is_liked_by_me: 1, is_reposted_by_me: 0 }]
      });
      const res = await trackLikesService.getUserLikedTracks('u1');
      expect(trackLikeModel.getUserLikedTracks).toHaveBeenCalledWith('u1', 20, 0);
      expect(res.items[0]).toEqual({
        id: 't1',
        is_liked_by_me: true,
        is_reposted_by_me: false,
        is_artist_followed_by_me: false,
      });
    });

    it('handles null track items', async () => {
      trackLikeModel.getUserLikedTracks.mockResolvedValue({ items: [null] });
      const res = await trackLikesService.getUserLikedTracks('u1');
      expect(res.items).toEqual([null]);
    });

    it('returns liked tracks with bounds checked pagination', async () => {
      trackLikeModel.getUserLikedTracks.mockResolvedValue({ items: [] });
      await trackLikesService.getUserLikedTracks('u1', 200, -5);
      expect(trackLikeModel.getUserLikedTracks).toHaveBeenCalledWith('u1', 20, 0);
    });
  });

  describe('isTrackLikedByUser', () => {
    it('returns false if userId is missing', async () => {
      await expect(trackLikesService.isTrackLikedByUser(null, 't1')).resolves.toBe(false);
    });

    it('checks if track is liked', async () => {
      trackLikeModel.isTrackLikedByUser.mockResolvedValue(true);
      await expect(trackLikesService.isTrackLikedByUser('u1', 't1')).resolves.toBe(true);
    });
  });

  describe('getTrackLikeCount', () => {
    it('returns 0 if trackId is missing', async () => {
      await expect(trackLikesService.getTrackLikeCount(null)).resolves.toBe(0);
    });

    it('gets track like count', async () => {
      trackLikeModel.getTrackLikeCount.mockResolvedValue(5);
      await expect(trackLikesService.getTrackLikeCount('t1')).resolves.toBe(5);
    });
  });
});
