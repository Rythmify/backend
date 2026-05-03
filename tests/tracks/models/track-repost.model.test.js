// ============================================================
// tests/tracks/models/track-repost.model.test.js
// ============================================================
const model = require('../../../src/models/track-repost.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Track Repost Model', () => {
  const userId = 'user-1';
  const trackId = 'track-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrackReposters', () => {
    it('returns reposters list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockResolvedValueOnce({ rows: [{ id: userId }] }) // reposters
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count

      const result = await model.getTrackReposters(trackId, 10, 0);
      expect(result.items).toHaveLength(1);
    });

    it('throws 404 if track not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getTrackReposters(trackId, 10, 0)).rejects.toThrow('Track not found');
    });
  });

  describe('checkTrackRepost', () => {
    it('returns repost id if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      expect(await model.checkTrackRepost(userId, trackId)).toBe('r1');
    });
  });

  describe('getUserRepostedTracks', () => {
    it('returns tracks list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      const res = await model.getUserRepostedTracks(userId, userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('getTrackOwner', () => {
    it('returns owner id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 'owner-1' }] });
      expect(await model.getTrackOwner(trackId)).toBe('owner-1');
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getTrackOwner(trackId)).rejects.toThrow('Track not found');
    });
  });

  describe('repostTrack', () => {
    it('creates new repost', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      const res = await model.repostTrack(userId, trackId);
      expect(res.created).toBe(true);
    });

    it('handles already reposted (unique constraint)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockRejectedValueOnce({ code: '23505' }); // insert error
      db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] }); // fetch existing

      const res = await model.repostTrack(userId, trackId);
      expect(res.created).toBe(false);
      expect(res.repost.id).toBe('r1');
    });

    it('throws 404 if track not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.repostTrack(userId, trackId)).rejects.toThrow('Track not found');
    });

    it('throws other db errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] })
        .mockRejectedValueOnce(new Error('DB Fail'));
      await expect(model.repostTrack(userId, trackId)).rejects.toThrow('DB Fail');
    });
  });

  describe('removeRepost', () => {
    it('removes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] }); // delete returning
      
      expect(await model.removeRepost(userId, trackId)).toBe(true);
    });

    it('throws 404 if track not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.removeRepost(userId, trackId)).rejects.toThrow('Track not found');
    });
  });

  describe('getTrackRepostCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ repost_count: '3' }] });
      expect(await model.getTrackRepostCount(trackId)).toBe(3);
    });
  });

  describe('isTrackRepostedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_reposted: true }] });
      expect(await model.isTrackRepostedByUser(userId, trackId)).toBe(true);
    });
    it('returns false if no userId', async () => {
      expect(await model.isTrackRepostedByUser(null, trackId)).toBe(false);
    });
  });
});
