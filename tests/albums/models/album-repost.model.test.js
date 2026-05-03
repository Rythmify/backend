// ============================================================
// tests/albums/models/album-repost.model.test.js
// ============================================================
const model = require('../../../src/models/album-repost.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Album Repost Model', () => {
  const userId = 'user-1';
  const albumId = 'album-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlbumReposters', () => {
    it('returns reposters list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ id: userId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getAlbumReposters(albumId, 10, 0);
      expect(res.items).toHaveLength(1);
    });

    it('throws 404 if album not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getAlbumReposters(albumId, 10, 0)).rejects.toThrow('Album not found');
    });
  });

  describe('checkAlbumRepost', () => {
    it('returns id if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      expect(await model.checkAlbumRepost(userId, albumId)).toBe('r1');
    });
  });

  describe('getAlbumOwner', () => {
    it('returns owner id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ artist_id: 'owner-1' }] });
      expect(await model.getAlbumOwner(albumId)).toBe('owner-1');
    });
    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getAlbumOwner(albumId)).rejects.toThrow('Album not found');
    });
  });

  describe('repostAlbum', () => {
    it('creates new repost', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      const res = await model.repostAlbum(userId, albumId);
      expect(res.created).toBe(true);
    });

    it('handles already reposted', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockRejectedValueOnce({ code: '23505' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      const res = await model.repostAlbum(userId, albumId);
      expect(res.created).toBe(false);
    });

    it('throws 404 if album not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.repostAlbum(userId, albumId)).rejects.toThrow('Album not found');
    });

    it('throws other db errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockRejectedValueOnce(new Error('Fail'));
      await expect(model.repostAlbum(userId, albumId)).rejects.toThrow('Fail');
    });
  });

  describe('removeRepost', () => {
    it('removes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      expect(await model.removeRepost(userId, albumId)).toBe(true);
    });

    it('throws 404 if album not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.removeRepost(userId, albumId)).rejects.toThrow('Album not found');
    });
  });

  describe('getAlbumRepostCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ repost_count: '3' }] });
      expect(await model.getAlbumRepostCount(albumId)).toBe(3);
    });
  });

  describe('isAlbumRepostedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_reposted: true }] });
      expect(await model.isAlbumRepostedByUser(userId, albumId)).toBe(true);
    });
    it('returns false if no userId', async () => {
      expect(await model.isAlbumRepostedByUser(null, albumId)).toBe(false);
    });
  });

  describe('getUserRepostedAlbums', () => {
    it('returns list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: albumId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getUserRepostedAlbums(userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });
});
