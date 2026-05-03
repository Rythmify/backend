// ============================================================
// tests/user/models/follow.model.test.js
// ============================================================
const model = require('../../../src/models/follow.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Follow Model', () => {
  const userId = 'user-1';
  const targetId = 'user-2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFollowing', () => {
    it('returns following list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: targetId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getFollowing(userId, 10, 0);
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe('getFollowers', () => {
    it('returns followers list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: targetId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getFollowers(userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('searchMyFollowing', () => {
    it('returns search results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: targetId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.searchMyFollowing(userId, 'test', 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('getSuggestedUsers', () => {
    it('returns suggested users', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: targetId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getSuggestedUsers(userId, 10, 0);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('getFollowStatus', () => {
    it('returns status bits', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_following: true }] });
      const res = await model.getFollowStatus(userId, targetId);
      expect(res.is_following).toBe(true);
    });
  });

  describe('followUser', () => {
    let client;
    beforeEach(() => {
      client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
    });

    it('follows successfully', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // block check
        .mockResolvedValueOnce({ rows: [{ follower_id: userId, following_id: targetId }] }) // insert
        .mockResolvedValueOnce({}); // COMMIT

      const res = await model.followUser(userId, targetId);
      expect(res.alreadyFollowing).toBe(false);
    });

    it('handles already following', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // block check
        .mockResolvedValueOnce({ rows: [] }) // insert returning nothing (conflict)
        .mockResolvedValueOnce({}); // COMMIT

      const res = await model.followUser(userId, targetId);
      expect(res.alreadyFollowing).toBe(true);
    });

    it('throws 400 on self follow', async () => {
      await expect(model.followUser(userId, userId)).rejects.toThrow('You cannot follow yourself');
    });

    it('throws 403 if blocked', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // blocked
      
      await expect(model.followUser(userId, targetId)).rejects.toThrow('You cannot follow this user');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('rolls back on error', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB Fail'));
      
      await expect(model.followUser(userId, targetId)).rejects.toThrow('DB Fail');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('unfollowUser', () => {
    let client;
    beforeEach(() => {
      client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
    });

    it('unfollows successfully', async () => {
      client.query.mockResolvedValue({});
      await model.unfollowUser(userId, targetId);
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    it('throws 400 on self unfollow', async () => {
      await expect(model.unfollowUser(userId, userId)).rejects.toThrow('You cannot unfollow yourself');
    });

    it('rolls back on error', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB Fail'));
      
      await expect(model.unfollowUser(userId, targetId)).rejects.toThrow('DB Fail');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
