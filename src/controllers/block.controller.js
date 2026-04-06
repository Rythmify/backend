// ============================================================
// controllers/block.controller.js
// Owner : Beshoy Maher (BE-3)
// HTTP handlers for block endpoints
// ============================================================
const BlockService = require('../services/block.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');

class BlockController {
  /**
   * POST /users/:user_id/block
   * Block a user (idempotent).
   * Returns 200 if already blocked, 201 if new block.
   * Requires: authentication
   */
  static blockUser = asyncHandler(async (req, res) => {
    const blockedId = req.params.user_id;
    const blockerId = req.user?.id || req.user?.sub || req.user?.user_id;

    if (!blockerId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const result = await BlockService.blockUser(blockerId, blockedId);

    const statusCode = result.isNew ? 201 : 200;
    const message = result.isNew ? 'User blocked successfully' : 'User already blocked';

    return success(res, result.data, message, statusCode);
  });

  /**
   * DELETE /users/:user_id/block
   * Unblock a user.
   * Returns 204 (no content).
   * Requires: authentication
   */
  static unblockUser = asyncHandler(async (req, res) => {
    const blockedId = req.params.user_id;
    const blockerId = req.user?.id || req.user?.sub || req.user?.user_id;

    if (!blockerId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    await BlockService.unblockUser(blockerId, blockedId);

    return success(res, null, 'User unblocked successfully', 204);
  });

  /**
   * GET /users/me/blocked
   * List all users blocked by the authenticated user (paginated).
   * Requires: authentication
   */
  static getBlockedUsers = asyncHandler(async (req, res) => {
    const blockerId = req.user?.id || req.user?.sub || req.user?.user_id;
    const { limit = 20, offset = 0 } = req.query;

    if (!blockerId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Validate pagination
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 1 || limitNum > 100 || offsetNum < 0) {
      throw new AppError('Limit must be 1-100, offset must be >= 0', 400, 'VALIDATION_FAILED');
    }

    const result = await BlockService.getBlockedUsers(blockerId, limitNum, offsetNum);

    const responseData = {
      items: result.users,
      meta: {
        limit: result.limit,
        offset: result.offset,
        total: result.total,
      },
    };

    return success(res, responseData, 'Blocked users list fetched successfully', 200);
  });
}

module.exports = BlockController;
