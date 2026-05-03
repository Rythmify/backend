// ============================================================
// tests/user/models/follow-request.model.test.js
// ============================================================
const model = require('../../../src/models/follow-request.model');
const db = require('../../../src/config/db');
const followUtils = require('../../../src/utils/follow-utils');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');
jest.mock('../../../src/utils/follow-utils');

describe('Follow Request Model', () => {
  const userId = 'user-1';
  const followerId = 'follower-2';
  const requestId = 'req-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingRequests', () => {
    it('returns pending requests list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: followerId, username: 'test' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await model.getPendingRequests(userId, 10, 0);
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe('getRequestStatus', () => {
    it('returns status if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ status: 'pending' }] });
      expect(await model.getRequestStatus(followerId, userId)).toBe('pending');
    });
    it('returns null if not exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      expect(await model.getRequestStatus(followerId, userId)).toBeNull();
    });
  });

  describe('createFollowRequest', () => {
    let client;
    beforeEach(() => {
      client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
    });

    it('creates new request', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'pending' }] }); // insert
      
      const res = await model.createFollowRequest(followerId, userId);
      expect(res.alreadyRequested).toBe(false);
      expect(followUtils.validateNotSelfFollow).toHaveBeenCalled();
      expect(followUtils.validateNotBlocked).toHaveBeenCalled();
    });

    it('handles already requested', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // insert conflict
        .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'pending' }] }); // fetch existing
      
      const res = await model.createFollowRequest(followerId, userId);
      expect(res.alreadyRequested).toBe(true);
    });

    it('rolls back on error', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Fail'));
      
      await expect(model.createFollowRequest(followerId, userId)).rejects.toThrow('Fail');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('acceptFollowRequest', () => {
    let client;
    beforeEach(() => {
      client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
    });

    it('accepts successfully', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ follower_id: followerId, following_id: userId }] }) // get details
        .mockResolvedValueOnce({ rows: [{ created_at: 'now' }] }) // follow insert
        .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'accepted' }] }) // update request
        .mockResolvedValueOnce({}); // COMMIT

      const res = await model.acceptFollowRequest(requestId, userId);
      expect(res.status).toBe('accepted');
      expect(res.isNew).toBe(true);
    });

    it('throws 404 if request not found', async () => {
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // not found
      
      await expect(model.acceptFollowRequest(requestId, userId)).rejects.toThrow('Follow request not found');
    });
  });

  describe('rejectFollowRequest', () => {
    it('rejects successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: requestId, status: 'rejected' }] });
      const res = await model.rejectFollowRequest(requestId, userId);
      expect(res.status).toBe('rejected');
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.rejectFollowRequest(requestId, userId)).rejects.toThrow('Follow request not found');
    });
  });

  describe('cancelFollowRequest', () => {
    it('cancels successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: requestId }] });
      const res = await model.cancelFollowRequest(requestId, followerId);
      expect(res.success).toBe(true);
    });

    it('throws 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.cancelFollowRequest(requestId, followerId)).rejects.toThrow('Follow request not found');
    });
  });
});
