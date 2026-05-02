// ============================================================
// tests/user/models/block.model.test.js
// ============================================================
const BlockModel = require('../../../src/models/block.model');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db');

describe('Block Model', () => {
  const blockerId = 'blocker-1';
  const blockedId = 'blocked-2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('blockUser', () => {
    it('creates new block', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // exists check
        .mockResolvedValueOnce({ rows: [{ id: 'b1', blocker_id: blockerId, blocked_id: blockedId }] }); // insert
      
      const res = await BlockModel.blockUser(blockerId, blockedId);
      expect(res.id).toBe('b1');
    });

    it('returns null if already blocked', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'b1' }] });
      const res = await BlockModel.blockUser(blockerId, blockedId);
      expect(res).toBeNull();
    });
  });

  describe('unblockUser', () => {
    it('returns true if deleted', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      expect(await BlockModel.unblockUser(blockerId, blockedId)).toBe(true);
    });
    it('returns false if not found', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });
      expect(await BlockModel.unblockUser(blockerId, blockedId)).toBe(false);
    });
  });

  describe('isUserBlocked', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      expect(await BlockModel.isUserBlocked(blockerId, blockedId)).toBe(true);
    });
  });

  describe('getBlockedUsers', () => {
    it('returns list and total', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'u2' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      
      const res = await BlockModel.getBlockedUsers(blockerId, 10, 0);
      expect(res.users).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe('isSelfBlock', () => {
    it('returns true if same id', () => {
      expect(BlockModel.isSelfBlock(blockerId, blockerId)).toBe(true);
      expect(BlockModel.isSelfBlock(blockerId, blockedId)).toBe(false);
    });
  });

  describe('removeFollowRelationships', () => {
    it('executes delete query', async () => {
      db.query.mockResolvedValueOnce({});
      await BlockModel.removeFollowRelationships(blockerId, blockedId);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM follows'), [blockerId, blockedId]);
    });
  });
});
