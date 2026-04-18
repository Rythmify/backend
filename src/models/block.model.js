// ============================================================
// models/block.model.js — PostgreSQL queries for Block relationships
// Entity attributes: Block_id, Blocker_id, Blocked_id, Created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class BlockModel {
  /**
   * Block a user (idempotent).
   * If already blocked, returns null (handled by service as 200).
   * If new block, returns the block record (handled by service as 201).
   *
   * @param {string} blockerId - Blocker user UUID
   * @param {string} blockedId - Blocked user UUID
   * @returns {Promise<{id, blocker_id, blocked_id, created_at} | null>}
   */
  static async blockUser(blockerId, blockedId) {
    // Check if already blocked
    const exists = await db.query(
      'SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );

    if (exists.rows.length > 0) {
      // Already blocked, return null to indicate idempotent (no change)
      return null;
    }

    const blockId = uuidv4();
    const query = `
      INSERT INTO blocks (id, blocker_id, blocked_id)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        blocker_id,
        blocked_id,
        created_at
    `;

    const result = await db.query(query, [blockId, blockerId, blockedId]);
    return result.rows[0];
  }

  /**
   * Unblock a user.
   * Returns true if unblocked, false if not blocked.
   *
   * @param {string} blockerId - Blocker user UUID
   * @param {string} blockedId - Blocked user UUID
   * @returns {Promise<boolean>}
   */
  static async unblockUser(blockerId, blockedId) {
    const result = await db.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [
      blockerId,
      blockedId,
    ]);

    return result.rowCount > 0;
  }

  /**
   * Check if user A is blocking user B.
   *
   * @param {string} blockerId - Blocker user UUID
   * @param {string} blockedId - Blocked user UUID
   * @returns {Promise<boolean>}
   */
  static async isUserBlocked(blockerId, blockedId) {
    const result = await db.query(
      'SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2 LIMIT 1',
      [blockerId, blockedId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get paginated list of users blocked by a user.
   *
   * @param {string} blockerId - Blocker user UUID
   * @param {number} limit - Pagination limit (1-100)
   * @param {number} offset - Pagination offset
   * @returns {Promise<{users: Array, total: number}>}
   */
  static async getBlockedUsers(blockerId, limit, offset) {
    // Get paginated blocked users with user details
    const query = `
      SELECT
        u.id AS user_id,
        u.username,
        u.email,
        u.display_name,
        u.avatar_url,
        u.bio,
        u.followers_count,
        u.following_count,
        u.created_at
      FROM blocks b
      LEFT JOIN users u ON b.blocked_id = u.id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [blockerId, limit, offset]);
    const users = result.rows;

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM blocks WHERE blocker_id = $1',
      [blockerId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return { users, total };
  }

  /**
   * Check if user is trying to block themselves.
   *
   * @param {string} blockerId - Blocker user UUID
   * @param {string} blockedId - Blocked user UUID
   * @returns {boolean}
   */
  static isSelfBlock(blockerId, blockedId) {
    return blockerId === blockedId;
  }

  /**
   * Remove any existing follow relationship when blocking.
   * Executes: DELETE FROM follows WHERE (follower_id = blocker_id AND following_id = blocked_id)
   *                                  OR (follower_id = blocked_id AND following_id = blocker_id)
   *
   * @param {string} blockerId - Blocker user UUID
   * @param {string} blockedId - Blocked user UUID
   * @returns {Promise<void>}
   */
  static async removeFollowRelationships(blockerId, blockedId) {
    // Remove both directions of following to ensure clean break
    const query = `
      DELETE FROM follows
      WHERE (follower_id = $1 AND following_id = $2)
         OR (follower_id = $2 AND following_id = $1)
    `;

    await db.query(query, [blockerId, blockedId]);
  }
}

module.exports = BlockModel;
