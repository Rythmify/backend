// ============================================================
// tests/tracks/models/track-like.model.test.js
// ============================================================
const model = require('../../../src/models/track-like.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Track Like Model', () => {
  const userId = 'user-1';
  const trackId = 'track-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrackLikers', () => {
    it('returns likers list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockResolvedValueOnce({ rows: [{ id: userId, username: 'test' }] }) // likers
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count

      const result = await model.getTrackLikers(trackId, 10, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('throws 404 if track not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.getTrackLikers(trackId, 10, 0)).rejects.toThrow('Track not found');
    });
  });

  describe('checkTrackLike', () => {
    it('returns like id if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'like-1' }] });
      const res = await model.checkTrackLike(userId, trackId);
      expect(res).toBe('like-1');
    });

    it('returns null if not exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await model.checkTrackLike(userId, trackId);
      expect(res).toBeNull();
    });
  });

  describe('getUserLikedTracks', () => {
    it('returns tracks successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId, title: 'song' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getUserLikedTracks(userId, 10, 0);
      expect(res.items[0].title).toBe('song');
      expect(res.total).toBe(1);
    });
  });

  describe('likeTrack', () => {
    it('creates new like', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockResolvedValueOnce({ rows: [{ id: 'l1', user_id: userId, track_id: trackId }] }); // insert

      const res = await model.likeTrack(userId, trackId);
      expect(res.created).toBe(true);
      expect(res.like.id).toBe('l1');
    });

    it('handles already liked (unique constraint)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockRejectedValueOnce({ code: '23505' }); // insert error
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] }); // fetch existing

      const res = await model.likeTrack(userId, trackId);
      expect(res.created).toBe(false);
      expect(res.like.id).toBe('l1');
    });

    it('throws 404 if track not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.likeTrack(userId, trackId)).rejects.toThrow('Track not found');
    });

    it('throws other db errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] })
        .mockRejectedValueOnce(new Error('DB Fail'));
      await expect(model.likeTrack(userId, trackId)).rejects.toThrow('DB Fail');
    });
  });

  describe('unlikeTrack', () => {
    it('unlikes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] }) // trackCheck
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] }); // delete returning
      
      const res = await model.unlikeTrack(userId, trackId);
      expect(res).toBe(true);
    });

    it('returns false if not found', async () => {
       db.query
        .mockResolvedValueOnce({ rows: [{ id: trackId }] })
        .mockResolvedValueOnce({ rows: [] });
      
      const res = await model.unlikeTrack(userId, trackId);
      expect(res).toBe(false);
    });

    it('throws 404 if track not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.unlikeTrack(userId, trackId)).rejects.toThrow('Track not found');
    });
  });

  describe('getTrackLikeCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ like_count: '5' }] });
      const res = await model.getTrackLikeCount(trackId);
      expect(res).toBe(5);
    });
  });

  describe('isTrackLikedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_liked: true }] });
      const res = await model.isTrackLikedByUser(userId, trackId);
      expect(res).toBe(true);
    });
    it('returns false if no userId', async () => {
      const res = await model.isTrackLikedByUser(null, trackId);
      expect(res).toBe(false);
    });
  });

  describe('getLikedTrackIds', () => {
    it('returns Set of ids', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ track_id: 't1' }, { track_id: 't2' }] });
      const res = await model.getLikedTrackIds(userId, ['t1', 't2', 't3']);
      expect(res.has('t1')).toBe(true);
      expect(res.has('t2')).toBe(true);
      expect(res.has('t3')).toBe(false);
    });

    it('returns empty Set on invalid input', async () => {
      expect(await model.getLikedTrackIds(null, [])).toBeInstanceOf(Set);
      expect((await model.getLikedTrackIds(userId, [])).size).toBe(0);
    });
  });
});
