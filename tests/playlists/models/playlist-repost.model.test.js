// ============================================================
// tests/playlists/models/playlist-repost.model.test.js
// ============================================================
const model = require('../../../src/models/playlist-repost.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Playlist Repost Model', () => {
  const userId = 'user-1';
  const playlistId = 'play-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlaylistReposters', () => {
    it('returns reposters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ id: userId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getPlaylistReposters(playlistId, 10, 0);
      expect(res.items).toHaveLength(1);
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getPlaylistReposters(playlistId, 10, 0)).rejects.toThrow('Playlist not found');
    });
  });

  describe('checkPlaylistRepost', () => {
    it('returns id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      expect(await model.checkPlaylistRepost(userId, playlistId)).toBe('r1');
    });
  });

  describe('getPlaylistOwner', () => {
    it('returns owner id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 'owner-1' }] });
      expect(await model.getPlaylistOwner(playlistId)).toBe('owner-1');
    });
    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getPlaylistOwner(playlistId)).rejects.toThrow('Playlist not found');
    });
  });

  describe('repostPlaylist', () => {
    it('reposts successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      const res = await model.repostPlaylist(userId, playlistId);
      expect(res.created).toBe(true);
    });

    it('handles already reposted', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockRejectedValueOnce({ code: '23505' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      const res = await model.repostPlaylist(userId, playlistId);
      expect(res.created).toBe(false);
    });

    it('throws 404 if playlist not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.repostPlaylist(userId, playlistId)).rejects.toThrow('Playlist not found');
    });

    it('throws other db errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockRejectedValueOnce(new Error('Fail'));
      await expect(model.repostPlaylist(userId, playlistId)).rejects.toThrow('Fail');
    });
  });

  describe('removeRepost', () => {
    it('removes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      expect(await model.removeRepost(userId, playlistId)).toBe(true);
    });

    it('throws 404 if playlist not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.removeRepost(userId, playlistId)).rejects.toThrow('Playlist not found');
    });
  });

  describe('getPlaylistRepostCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ repost_count: '3' }] });
      expect(await model.getPlaylistRepostCount(playlistId)).toBe(3);
    });
  });

  describe('isPlaylistRepostedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_reposted: true }] });
      expect(await model.isPlaylistRepostedByUser(userId, playlistId)).toBe(true);
    });
    it('returns false if no user', async () => {
      expect(await model.isPlaylistRepostedByUser(null, playlistId)).toBe(false);
    });
  });

  describe('getUserRepostedPlaylists', () => {
    it('returns list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getUserRepostedPlaylists(userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });
});
