// ============================================================
// tests/playlists/services/playlist-likes.service.test.js
// ============================================================
const service = require('../../../src/services/playlist-likes.service');
const model = require('../../../src/models/playlist-like.model');
const notificationModel = require('../../../src/models/notification.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/playlist-like.model');
jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/services/notifications.service');

describe('Playlist Likes Service', () => {
  const userId = 'user-1';
  const playlistId = 'playlist-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlaylistLikers', () => {
    it('returns likers with defaults', async () => {
      model.getPlaylistLikers.mockResolvedValue([]);
      await service.getPlaylistLikers(playlistId);
      expect(model.getPlaylistLikers).toHaveBeenCalledWith(playlistId, 20, 0);
    });

    it('validates limits and offsets', async () => {
      model.getPlaylistLikers.mockResolvedValue([]);
      await service.getPlaylistLikers(playlistId, 150, -1);
      expect(model.getPlaylistLikers).toHaveBeenCalledWith(playlistId, 20, 0);
    });

    it('throws error if playlistId missing', async () => {
      await expect(service.getPlaylistLikers('')).rejects.toThrow('Playlist ID is required');
    });
  });

  describe('likePlaylist', () => {
    it('likes playlist and notifies owner', async () => {
      model.likePlaylist.mockResolvedValue({
        created: true,
        like: { id: 'l1', user_id: userId, playlist_id: playlistId, created_at: 'now' }
      });
      notificationModel.getPlaylistOwnerId.mockResolvedValue('owner-1');

      const result = await service.likePlaylist(userId, playlistId);

      expect(result.isNew).toBe(true);
      expect(notificationModel.getPlaylistOwnerId).toHaveBeenCalledWith(playlistId);
      expect(notificationsService.createNotification).toHaveBeenCalled();
    });

    it('does not notify if already liked', async () => {
      model.likePlaylist.mockResolvedValue({
        created: false,
        like: { id: 'l1', user_id: userId, playlist_id: playlistId, created_at: 'now' }
      });

      await service.likePlaylist(userId, playlistId);

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('does not notify if owner is liker', async () => {
      model.likePlaylist.mockResolvedValue({
        created: true,
        like: { id: 'l1', user_id: userId, playlist_id: playlistId, created_at: 'now' }
      });
      notificationModel.getPlaylistOwnerId.mockResolvedValue(userId);

      await service.likePlaylist(userId, playlistId);

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('throws if userId is missing', async () => {
      await expect(service.likePlaylist('', playlistId)).rejects.toThrow('User ID is required');
      await expect(service.likePlaylist(' ', playlistId)).rejects.toThrow('User ID is required');
    });

    it('throws if playlistId is missing', async () => {
      await expect(service.likePlaylist(userId, '')).rejects.toThrow('Playlist ID is required');
      await expect(service.likePlaylist(userId, ' ')).rejects.toThrow('Playlist ID is required');
    });
  });

  describe('unlikePlaylist', () => {
    it('unlikes playlist', async () => {
      model.unlikePlaylist.mockResolvedValue(true);
      const res = await service.unlikePlaylist(userId, playlistId);
      expect(res).toBe(true);
    });

    it('throws 404 if not found', async () => {
      model.unlikePlaylist.mockResolvedValue(false);
      await expect(service.unlikePlaylist(userId, playlistId)).rejects.toThrow('Like not found');
    });

    it('throws if userId or playlistId is missing', async () => {
      await expect(service.unlikePlaylist('', playlistId)).rejects.toThrow('User ID is required');
      await expect(service.unlikePlaylist(userId, ' ')).rejects.toThrow('Playlist ID is required');
    });
  });

  describe('getUserLikedPlaylists', () => {
    it('returns liked playlists', async () => {
      model.getUserLikedPlaylists.mockResolvedValue([]);
      await service.getUserLikedPlaylists(userId, 10, 5);
      expect(model.getUserLikedPlaylists).toHaveBeenCalledWith(userId, 10, 5);
    });

    it('throws if userId is missing', async () => {
      await expect(service.getUserLikedPlaylists(' ')).rejects.toThrow('User ID is required');
    });

    it('handles invalid limit/offset', async () => {
      model.getUserLikedPlaylists.mockResolvedValue([]);
      await service.getUserLikedPlaylists(userId, 0, -1);
      expect(model.getUserLikedPlaylists).toHaveBeenCalledWith(userId, 20, 0);
    });
  });

  describe('isPlaylistLikedByUser', () => {
    it('returns result from model', async () => {
      model.isPlaylistLikedByUser.mockResolvedValue(true);
      expect(await service.isPlaylistLikedByUser(userId, playlistId)).toBe(true);
    });
    it('returns false if no userId', async () => {
      expect(await service.isPlaylistLikedByUser(null, playlistId)).toBe(false);
    });
  });

  describe('getPlaylistLikeCount', () => {
    it('returns result from model', async () => {
      model.getPlaylistLikeCount.mockResolvedValue(5);
      expect(await service.getPlaylistLikeCount(playlistId)).toBe(5);
    });
    it('returns 0 if no playlistId', async () => {
      expect(await service.getPlaylistLikeCount(null)).toBe(0);
    });
  });
});
