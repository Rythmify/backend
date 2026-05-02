// ============================================================
// tests/user/services/block.service.test.js
// ============================================================
const BlockService = require('../../../src/services/block.service');
const BlockModel = require('../../../src/models/block.model');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/block.model');

describe('Block Service', () => {
  const blockerId = 'blocker-1';
  const blockedId = 'blocked-2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('blockUser', () => {
    it('blocks a user successfully', async () => {
      BlockModel.isSelfBlock.mockReturnValue(false);
      BlockModel.blockUser.mockResolvedValue({
        blocker_id: blockerId,
        blocked_id: blockedId,
        created_at: 'now'
      });
      BlockModel.removeFollowRelationships.mockResolvedValue();

      const result = await BlockService.blockUser(blockerId, blockedId);

      expect(result.isNew).toBe(true);
      expect(BlockModel.removeFollowRelationships).toHaveBeenCalledWith(blockerId, blockedId);
    });

    it('returns 200 if already blocked', async () => {
      BlockModel.isSelfBlock.mockReturnValue(false);
      BlockModel.blockUser.mockResolvedValue(null);

      const result = await BlockService.blockUser(blockerId, blockedId);

      expect(result.isNew).toBe(false);
      expect(BlockModel.removeFollowRelationships).not.toHaveBeenCalled();
    });

    it('throws 400 on self block', async () => {
      BlockModel.isSelfBlock.mockReturnValue(true);
      await expect(BlockService.blockUser(blockerId, blockerId)).rejects.toThrow('Cannot block yourself');
    });
  });

  describe('unblockUser', () => {
    it('unblocks successfully', async () => {
      BlockModel.isSelfBlock.mockReturnValue(false);
      BlockModel.unblockUser.mockResolvedValue(true);
      const res = await BlockService.unblockUser(blockerId, blockedId);
      expect(res).toBe(true);
    });

    it('throws 404 if not found', async () => {
      BlockModel.isSelfBlock.mockReturnValue(false);
      BlockModel.unblockUser.mockResolvedValue(false);
      await expect(BlockService.unblockUser(blockerId, blockedId)).rejects.toThrow('User not in block list');
    });

    it('throws 400 on self unblock', async () => {
      BlockModel.isSelfBlock.mockReturnValue(true);
      await expect(BlockService.unblockUser(blockerId, blockerId)).rejects.toThrow('Invalid operation');
    });
  });

  describe('getBlockedUsers', () => {
    it('returns list', async () => {
      BlockModel.getBlockedUsers.mockResolvedValue({ users: [], total: 0 });
      const res = await BlockService.getBlockedUsers(blockerId, 10, 0);
      expect(res.users).toEqual([]);
    });

    it('throws 400 on invalid pagination', async () => {
      await expect(BlockService.getBlockedUsers(blockerId, 150, 0)).rejects.toThrow('Limit must be 1-100');
      await expect(BlockService.getBlockedUsers(blockerId, 10, -1)).rejects.toThrow('Limit must be 1-100');
      await expect(BlockService.getBlockedUsers(blockerId, NaN, 0)).rejects.toThrow('Limit must be 1-100');
    });
  });
});
