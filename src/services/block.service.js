// ============================================================
// services/block.service.js
// Owner : Beshoy Maher (BE-3)
// Business logic for block operations
// ============================================================
const BlockModel = require('../models/block.model');
const AppError = require('../utils/app-error');

class BlockService {
  /**
   * Block a user.
   * Returns { blocked: true, isNew: true } if new block (201)
   * Returns { blocked: true, isNew: false } if already blocked (200)
   *
   * @param {string} blockerId - Current user ID
   * @param {string} blockedId - User to block UUID
   * @returns {Promise<{blocked: boolean, isNew: boolean, data?: object}>}
   * @throws AppError if self-block or validation fails
   */
  static async blockUser(blockerId, blockedId) {
    // Validation: can't block yourself
    if (BlockModel.isSelfBlock(blockerId, blockedId)) {
      throw new AppError('Cannot block yourself', 400, 'INVALID_OPERATION');
    }

    // Attempt to block (returns null if already blocked)
    const blockRecord = await BlockModel.blockUser(blockerId, blockedId);

    if (!blockRecord) {
      // Already blocked - idempotent response (200)
      return {
        blocked: true,
        isNew: false,
        data: null,
      };
    }

    // New block created - return block record (201)
    // Remove any follow relationships
    await BlockModel.removeFollowRelationships(blockerId, blockedId);

    return {
      blocked: true,
      isNew: true,
      data: {
        blocker_id: blockRecord.blocker_id,
        blocked_id: blockRecord.blocked_id,
        created_at: blockRecord.created_at,
      },
    };
  }

  /**
   * Unblock a user.
   *
   * @param {string} blockerId - Current user ID
   * @param {string} blockedId - User to unblock UUID
   * @returns {Promise<boolean>} True if unblocked, false if was not blocked
   * @throws AppError if validation fails
   */
  static async unblockUser(blockerId, blockedId) {
    // Validation: can't unblock yourself (doesn't matter but for consistency)
    if (BlockModel.isSelfBlock(blockerId, blockedId)) {
      throw new AppError('Invalid operation', 400, 'INVALID_OPERATION');
    }

    const unblocked = await BlockModel.unblockUser(blockerId, blockedId);

    if (!unblocked) {
      throw new AppError('User not in block list', 404, 'NOT_FOUND');
    }

    return true;
  }

  /**
   * Get paginated list of users blocked by the authenticated user.
   *
   * @param {string} blockerId - Current user ID
   * @param {number} limit - Pagination limit (1-100)
   * @param {number} offset - Pagination offset
   * @returns {Promise<{users: Array, total: number, limit: number, offset: number}>}
   */
  static async getBlockedUsers(blockerId, limit, offset) {
    // Validate pagination
    if (isNaN(limit) || isNaN(offset) || limit < 1 || limit > 100 || offset < 0) {
      throw new AppError('Limit must be 1-100, offset must be >= 0', 400, 'VALIDATION_FAILED');
    }

    const result = await BlockModel.getBlockedUsers(blockerId, limit, offset);

    return {
      users: result.users,
      total: result.total,
      limit,
      offset,
    };
  }
}

module.exports = BlockService;
