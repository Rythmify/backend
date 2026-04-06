// ============================================================
// utils/follow-utils.js
// Shared utilities for follow and follow-request models
// Prevents code duplication across modules
// ============================================================

const db = require('../config/db');
const AppError = require('./app-error');

/**
 * Prevent user from following themselves
 * Throws 400 error if attemptingself-follow
 */
exports.validateNotSelfFollow = (followerId, userId) => {
  if (followerId === userId) {
    throw new AppError('You cannot follow yourself.', 400, 'FOLLOW_SELF');
  }
};

/**
 * Check if two users have a blocking relationship
 * Returns true if either blocked the other
 * Can be used in both direct follow and follow-request flows
 */
exports.validateNotBlocked = async (client, followerId, userId) => {
  const blockQuery = `
    SELECT 1 FROM blocks 
    WHERE (blocker_id = $1 AND blocked_id = $2)
       OR (blocker_id = $2 AND blocked_id = $1)
    LIMIT 1
  `;
  const { rows: blockRows } = await client.query(blockQuery, [followerId, userId]);
  
  if (blockRows.length > 0) {
    throw new AppError('You cannot follow this user.', 403, 'PERMISSION_DENIED');
  }
};

/**
 * Check if user exists and is not deleted
 * Returns user object or throws 404 error
 */
exports.validateUserExists = async (userId) => {
  const query = `
    SELECT id, display_name, username, is_private, deleted_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(query, [userId]);
  
  if (rows.length === 0 || rows[0].deleted_at) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  return rows[0];
};

/**
 * Get blocking status between two users
 * Returns: { is_blocking: bool, is_blocked_by: bool }
 * Useful for checking if follow action is allowed
 */
exports.getBlockingStatus = async (followerId, userId) => {
  const query = `
    SELECT 
      (SELECT COUNT(*) > 0 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2) as is_blocking,
      (SELECT COUNT(*) > 0 FROM blocks WHERE blocker_id = $2 AND blocked_id = $1) as is_blocked_by
  `;
  const { rows } = await db.query(query, [followerId, userId]);
  return rows[0];
};

/**
 * Bidirectional blocking check SQL pattern
 * Returns WHERE clause for blocking validation
 * Usage: `WHERE ... AND ${exports.BLOCKING_CHECK_PATTERN}`
 * Params: (userId, otherUserId, ...)
 */
exports.BLOCKING_CHECK_SQL = `
  (b.blocker_id = $1 AND b.blocked_id = u.id) OR
  (b.blocker_id = u.id AND b.blocked_id = $1)
`;
