// ============================================================
// tests/playlists/models/playlist-like.model.test.js
// ============================================================
const model = require('../../../src/models/playlist-like.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Playlist Like Model', () => {
  const userId = 'user-1';
  const playlistId = 'play-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlaylistLikers', () => {
    it('returns likers', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ id: userId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getPlaylistLikers(playlistId, 10, 0);
      expect(res.items).toHaveLength(1);
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getPlaylistLikers(playlistId, 10, 0)).rejects.toThrow('Playlist not found');
    });
  });

  describe('checkPlaylistLike', () => {
    it('returns id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      expect(await model.checkPlaylistLike(userId, playlistId)).toBe('l1');
    });
  });

  describe('getUserLikedPlaylists', () => {
    it('returns list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getUserLikedPlaylists(userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('likePlaylist', () => {
    it('likes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      const res = await model.likePlaylist(userId, playlistId);
      expect(res.created).toBe(true);
    });

    it('handles already liked', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockRejectedValueOnce({ code: '23505' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      const res = await model.likePlaylist(userId, playlistId);
      expect(res.created).toBe(false);
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.likePlaylist(userId, playlistId)).rejects.toThrow('Playlist not found');
    });

    it('throws other errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockRejectedValueOnce(new Error('Fail'));
      await expect(model.likePlaylist(userId, playlistId)).rejects.toThrow('Fail');
    });
  });

  describe('unlikePlaylist', () => {
    it('unlikes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: playlistId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      expect(await model.unlikePlaylist(userId, playlistId)).toBe(true);
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.unlikePlaylist(userId, playlistId)).rejects.toThrow('Playlist not found');
    });
  });

  describe('getPlaylistLikeCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ like_count: '5' }] });
      expect(await model.getPlaylistLikeCount(playlistId)).toBe(5);
    });
  });

  describe('isPlaylistLikedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_liked: true }] });
      expect(await model.isPlaylistLikedByUser(userId, playlistId)).toBe(true);
    });
    it('returns false if no user', async () => {
      expect(await model.isPlaylistLikedByUser(null, playlistId)).toBe(false);
    });
  });

  describe('getLikedPlaylistIds', () => {
    it('returns Set', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ playlist_id: 'p1' }] });
      const res = await model.getLikedPlaylistIds(userId, ['p1']);
      expect(res.has('p1')).toBe(true);
    });
  });
});
