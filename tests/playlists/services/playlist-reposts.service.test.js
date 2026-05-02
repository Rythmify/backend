// ============================================================
// tests/playlists/services/playlist-reposts.service.test.js
// ============================================================
const service = require('../../../src/services/playlist-reposts.service');
const model = require('../../../src/models/playlist-repost.model');
const notificationModel = require('../../../src/models/notification.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/playlist-repost.model');
jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/services/notifications.service');

describe('Playlist Reposts Service', () => {
  const userId = 'user-1';
  const playlistId = 'playlist-1';

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn(); // Mock console.error for notify catch block
  });

  describe('getPlaylistReposters', () => {
    it('returns reposters successfully', async () => {
      model.getPlaylistReposters.mockResolvedValue([]);
      await service.getPlaylistReposters(playlistId, 10, 0);
      expect(model.getPlaylistReposters).toHaveBeenCalledWith(playlistId, 10, 0);
    });

    it('handles invalid limit/offset', async () => {
      model.getPlaylistReposters.mockResolvedValue([]);
      await service.getPlaylistReposters(playlistId, 0, -1);
      expect(model.getPlaylistReposters).toHaveBeenCalledWith(playlistId, 20, 0);
    });

    it('throws if playlistId missing', async () => {
      await expect(service.getPlaylistReposters('')).rejects.toThrow('Playlist ID is required');
    });
  });

  describe('repostPlaylist', () => {
    it('reposts and notifies owner', async () => {
      model.getPlaylistOwner.mockResolvedValue('owner-2');
      model.repostPlaylist.mockResolvedValue({
        created: true,
        repost: { id: 'r1', user_id: userId, playlist_id: playlistId, created_at: 'now' }
      });
      notificationModel.getPlaylistOwnerId.mockResolvedValue('owner-2');

      const result = await service.repostPlaylist(userId, playlistId);

      expect(result.isNew).toBe(true);
      // Wait a bit for the fire-and-forget notification
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(notificationsService.createNotification).toHaveBeenCalled();
    });

    it('throws if trying to repost own playlist', async () => {
      model.getPlaylistOwner.mockResolvedValue(userId);
      await expect(service.repostPlaylist(userId, playlistId)).rejects.toThrow('Cannot repost your own playlist');
    });

    it('throws if userId or playlistId missing', async () => {
      await expect(service.repostPlaylist('', playlistId)).rejects.toThrow('User ID is required');
      await expect(service.repostPlaylist(userId, ' ')).rejects.toThrow('Playlist ID is required');
    });

    it('handles notification error gracefully', async () => {
      model.getPlaylistOwner.mockResolvedValue('owner-2');
      model.repostPlaylist.mockResolvedValue({
        created: true,
        repost: { id: 'r1', user_id: userId, playlist_id: playlistId }
      });
      notificationModel.getPlaylistOwnerId.mockRejectedValue(new Error('Notification failed'));

      await service.repostPlaylist(userId, playlistId);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('removeRepost', () => {
    it('removes repost', async () => {
      model.removeRepost.mockResolvedValue(true);
      const res = await service.removeRepost(userId, playlistId);
      expect(res).toBe(true);
    });

    it('throws 404 if not found', async () => {
      model.removeRepost.mockResolvedValue(false);
      await expect(service.removeRepost(userId, playlistId)).rejects.toThrow('Repost not found');
    });

    it('throws if userId or playlistId missing', async () => {
      await expect(service.removeRepost('', playlistId)).rejects.toThrow('User ID is required');
      await expect(service.removeRepost(userId, ' ')).rejects.toThrow('Playlist ID is required');
    });
  });

  describe('getUserRepostedPlaylists', () => {
    it('returns reposted playlists', async () => {
      model.getUserRepostedPlaylists.mockResolvedValue([]);
      await service.getUserRepostedPlaylists(userId, 10, 5);
      expect(model.getUserRepostedPlaylists).toHaveBeenCalledWith(userId, 10, 5);
    });

    it('handles invalid limit/offset', async () => {
      model.getUserRepostedPlaylists.mockResolvedValue([]);
      await service.getUserRepostedPlaylists(userId, 150, -1);
      expect(model.getUserRepostedPlaylists).toHaveBeenCalledWith(userId, 20, 0);
    });

    it('throws if userId missing', async () => {
      await expect(service.getUserRepostedPlaylists('')).rejects.toThrow('User ID is required');
    });
  });

  describe('isPlaylistRepostedByUser', () => {
    it('returns result from model', async () => {
      model.isPlaylistRepostedByUser.mockResolvedValue(true);
      expect(await service.isPlaylistRepostedByUser(userId, playlistId)).toBe(true);
    });
    it('returns false if no userId', async () => {
      expect(await service.isPlaylistRepostedByUser(null, playlistId)).toBe(false);
    });
  });

  describe('getPlaylistRepostCount', () => {
    it('returns result from model', async () => {
      model.getPlaylistRepostCount.mockResolvedValue(3);
      expect(await service.getPlaylistRepostCount(playlistId)).toBe(3);
    });
    it('returns 0 if no playlistId', async () => {
      expect(await service.getPlaylistRepostCount(null)).toBe(0);
    });
  });
});
