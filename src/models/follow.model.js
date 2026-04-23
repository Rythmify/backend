// ============================================================
// models/follow.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for follow functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');
const followUtils = require('../utils/follow-utils');

// ===== GET QUERIES =====

/**
 * Get paginated list of users that a user is following
 * Optimized: Uses JOIN instead of NOT IN subquery
 */
exports.getFollowing = async (userId, limit, offset) => {
  const query = `
    SELECT u.id, u.display_name, u.username, u.profile_picture 
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 AND u.deleted_at IS NULL
    ORDER BY u.display_name ASC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(*) as total FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Get paginated list of users who follow a given user
 */
exports.getFollowers = async (userId, limit, offset) => {
  const query = `
    SELECT u.id, u.display_name, u.username, u.profile_picture
    FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = $1 AND u.deleted_at IS NULL
    ORDER BY u.display_name ASC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(*) as total FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Search within a user's following list
 */
exports.searchMyFollowing = async (userId, query, limit, offset) => {
  const searchQuery = `
    SELECT u.id, u.display_name, u.username, u.profile_picture
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 
      AND u.deleted_at IS NULL
      AND (u.display_name ILIKE $2 OR u.username ILIKE $2)
    ORDER BY u.display_name ASC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await db.query(searchQuery, [userId, `%${query}%`, limit, offset]);

  const countQuery = `
    SELECT COUNT(*) as total FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 
      AND u.deleted_at IS NULL
      AND (u.display_name ILIKE $2 OR u.username ILIKE $2)
  `;
  const { rows: countRows } = await db.query(countQuery, [userId, `%${query}%`]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, query };
};

/**
 * Get suggested users to follow
 * Optimized: Uses LEFT JOIN instead of NOT IN subquery
 * Excludes: self, already following, blocked users, deleted users
 */
exports.getSuggestedUsers = async (userId, limit, offset) => {
  const query = `
    SELECT u.id, u.display_name, u.username, u.profile_picture, u.followers_count
    FROM users u
    LEFT JOIN follows f ON u.id = f.following_id AND f.follower_id = $1
    LEFT JOIN blocks b ON (
      (b.blocker_id = $1 AND b.blocked_id = u.id) OR
      (b.blocker_id = u.id AND b.blocked_id = $1)
    )
    WHERE u.id != $1
      AND f.id IS NULL
      AND b.id IS NULL
      AND u.deleted_at IS NULL
    ORDER BY u.followers_count DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(*) as total FROM users u
    LEFT JOIN follows f ON u.id = f.following_id AND f.follower_id = $1
    LEFT JOIN blocks b ON (
      (b.blocker_id = $1 AND b.blocked_id = u.id) OR
      (b.blocker_id = u.id AND b.blocked_id = u.id)
    )
    WHERE u.id != $1
      AND f.id IS NULL
      AND b.id IS NULL
      AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check follow/block status between two users
 */
exports.getFollowStatus = async (userId, targetUserId) => {
  const query = `
    SELECT 
      (SELECT COUNT(*) > 0 FROM follows WHERE follower_id = $1 AND following_id = $2) as is_following,
      (SELECT COUNT(*) > 0 FROM follows WHERE follower_id = $2 AND following_id = $1) as is_followed_by,
      (SELECT COUNT(*) > 0 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2) as is_blocking,
      (SELECT COUNT(*) > 0 FROM blocks WHERE blocker_id = $2 AND blocked_id = $1) as is_blocked_by
  `;
  const { rows } = await db.query(query, [userId, targetUserId]);
  return rows[0];
};

// ===== FOLLOW/UNFOLLOW OPERATIONS WITH TRANSACTIONS =====

/**
 * Follow a user
 * Handles: Self-follow prevention, blocking checks, duplicates
 * Uses transaction to ensure followers_count consistency
 * Returns:
 *   - { follower_id, followed_id, created_at, alreadyFollowing: true } if already following
 *   - { follower_id, followed_id, created_at, alreadyFollowing: false } if new follow
 */
exports.followUser = async (followerId, userId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Edge case: prevent self-follow
    if (followerId === userId) {
      throw new AppError('You cannot follow yourself.', 400, 'FOLLOW_SELF');
    }

    // Edge case: check if blocked
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

    // Check if already following
    const existingQuery = `
      SELECT 1 FROM follows 
      WHERE follower_id = $1 AND following_id = $2
      LIMIT 1
    `;
    const { rows: existingRows } = await client.query(existingQuery, [followerId, userId]);
    if (existingRows.length > 0) {
      // Idempotent: return 200 with alreadyFollowing flag
      await client.query('COMMIT');
      return {
        follower_id: followerId,
        followed_id: userId,
        alreadyFollowing: true,
      };
    }

    // Insert follow relationship
    // NOTE: Database trigger trg_follow_counts will automatically increment followers_count and following_count
    const now = new Date().toISOString();
    await client.query(`INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`, [
      followerId,
      userId,
    ]);

    await client.query('COMMIT');
    return {
      follower_id: followerId,
      followed_id: userId,
      created_at: now,
      alreadyFollowing: false,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Unfollow a user
 * Idempotent: returns success even if not following
 * Uses transaction to ensure followers_count consistency
 */
exports.unfollowUser = async (followerId, userId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Edge case: prevent self-unfollow
    if (followerId === userId) {
      throw new AppError('You cannot unfollow yourself.', 400, 'FOLLOW_SELF');
    }

    // Check if currently following
    const existingQuery = `
      SELECT 1 FROM follows 
      WHERE follower_id = $1 AND following_id = $2
      LIMIT 1
    `;
    const { rows: existingRows } = await client.query(existingQuery, [followerId, userId]);

    // If following, delete and update counts
    if (existingRows.length > 0) {
      // Delete follow relationship
      // NOTE: Database trigger trg_follow_counts will automatically decrement followers_count and following_count
      await client.query(`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, [
        followerId,
        userId,
      ]);
    }

    // Idempotent: return success whether was following or not
    await client.query('COMMIT');
    return null; // 204 No Content
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};