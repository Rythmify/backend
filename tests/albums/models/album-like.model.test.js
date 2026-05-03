// ============================================================
// tests/albums/models/album-like.model.test.js
// ============================================================
const model = require('../../../src/models/album-like.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Album Like Model', () => {
  const userId = 'user-1';
  const albumId = 'album-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlbumLikers', () => {
    it('returns likers list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ id: userId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getAlbumLikers(albumId, 10, 0);
      expect(res.items).toHaveLength(1);
    });

    it('throws 404 if album not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getAlbumLikers(albumId, 10, 0)).rejects.toThrow('Album not found');
    });
  });

  describe('checkAlbumLike', () => {
    it('returns id if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      expect(await model.checkAlbumLike(userId, albumId)).toBe('l1');
    });
  });

  describe('getUserLikedAlbums', () => {
    it('returns albums list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getUserLikedAlbums(userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('likeAlbum', () => {
    it('creates new like', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      const res = await model.likeAlbum(userId, albumId);
      expect(res.created).toBe(true);
    });

    it('handles already liked', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockRejectedValueOnce({ code: '23505' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      const res = await model.likeAlbum(userId, albumId);
      expect(res.created).toBe(false);
    });

    it('throws 404 if album not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.likeAlbum(userId, albumId)).rejects.toThrow('Album not found');
    });

    it('throws other db errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockRejectedValueOnce(new Error('Fail'));
      await expect(model.likeAlbum(userId, albumId)).rejects.toThrow('Fail');
    });
  });

  describe('unlikeAlbum', () => {
    it('unlikes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      expect(await model.unlikeAlbum(userId, albumId)).toBe(true);
    });

    it('throws 404 if album not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.unlikeAlbum(userId, albumId)).rejects.toThrow('Album not found');
    });
  });

  describe('getAlbumLikeCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ like_count: '5' }] });
      expect(await model.getAlbumLikeCount(albumId)).toBe(5);
    });
  });

  describe('isAlbumLikedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_liked: true }] });
      expect(await model.isAlbumLikedByUser(userId, albumId)).toBe(true);
    });
    it('returns false if no userId', async () => {
      expect(await model.isAlbumLikedByUser(null, albumId)).toBe(false);
    });
  });

  describe('getLikedAlbumIds', () => {
    it('returns Set of ids', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ album_id: 'a1' }] });
      const res = await model.getLikedAlbumIds(userId, ['a1']);
      expect(res.has('a1')).toBe(true);
    });
    it('returns empty Set on invalid input', async () => {
      expect(await model.getLikedAlbumIds(null, [])).toBeInstanceOf(Set);
    });
  });
});
