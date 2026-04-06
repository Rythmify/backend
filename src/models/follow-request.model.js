// ============================================================
// models/follow-request.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for follow request functionality (private accounts)
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');
const followUtils = require('../utils/follow-utils');

// ===== GET QUERIES =====

/**
 * Get pending follow requests for a user (requests TO them)
 * Paginated list of users who want to follow them
 */
exports.getPendingRequests = async (userId, limit, offset) => {
  const query = `
    SELECT u.id, u.username, u.display_name, u.bio, u.location, u.gender, u.role,
           u.profile_picture, u.cover_photo, u.is_private, u.is_verified,
           u.followers_count, u.following_count, u.created_at,
           fr.id as request_id, fr.created_at as requested_at
    FROM follow_requests fr
    JOIN users u ON fr.follower_id = u.id
    WHERE fr.following_id = $1 
      AND fr.status = 'pending'
      AND u.deleted_at IS NULL
    ORDER BY fr.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);
  
  const countQuery = `
    SELECT COUNT(*) as total FROM follow_requests fr
    JOIN users u ON fr.follower_id = u.id
    WHERE fr.following_id = $1 
      AND fr.status = 'pending'
      AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);
  
  return { items: rows, total, limit, offset };
};

/**
 * Get request status between two users
 * Returns: 'pending', 'accepted', 'rejected', or null if no request
 */
exports.getRequestStatus = async (followerId, userId) => {
  const query = `
    SELECT status FROM follow_requests
    WHERE follower_id = $1 AND following_id = $2
    LIMIT 1
  `;
  const { rows } = await db.query(query, [followerId, userId]);
  return rows.length > 0 ? rows[0].status : null;
};

// ===== CREATE/UPDATE QUERIES =====

/**
 * Create a follow request for a private account
 * Handles: Self-follow prevention, blocking checks, duplicates
 * Uses transaction to ensure consistency
 * Returns: 
 *   - { id, follower_id, following_id, status, created_at, alreadyRequested: true } if already requested
 *   - { id, follower_id, following_id, status, created_at, alreadyRequested: false } if new request
 */
exports.createFollowRequest = async (followerId, userId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    followUtils.validateNotSelfFollow(followerId, userId);

    // Edge case: check if blocked
    await followUtils.validateNotBlocked(client, followerId, userId);

    // Atomic idempotent insert
    const insertQuery = `
      INSERT INTO follow_requests (follower_id, following_id, status, created_at) 
      VALUES ($1, $2, 'pending', now())
      ON CONFLICT (follower_id, following_id) DO NOTHING
      RETURNING id, follower_id, following_id, status, created_at
    `;
    const { rows: insertRows } = await client.query(insertQuery, [followerId, userId]);

    const wasInserted = insertRows.length > 0;
    
    let result;
    if (wasInserted) {
      // New request
      result = {
        ...insertRows[0],
        alreadyRequested: false
      };
    } else {
      // Already requested: fetch existing request
      const existingQuery = `
        SELECT id, follower_id, following_id, status, created_at FROM follow_requests
        WHERE follower_id = $1 AND following_id = $2
        LIMIT 1
      `;
      const { rows: existingRows } = await client.query(existingQuery, [followerId, userId]);
      result = {
        ...existingRows[0],
        alreadyRequested: true
      };
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Accept a follow request (user accepts follower)
 * Converts pending follow request to actual follow relationship
 * Uses transaction to maintain consistency
 */
exports.acceptFollowRequest = async (requestId, userId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Get the request details
    const requestQuery = `
      SELECT follower_id, following_id FROM follow_requests
      WHERE id = $1 AND following_id = $2 AND status = 'pending'
      LIMIT 1
    `;
    const { rows: requestRows } = await client.query(requestQuery, [requestId, userId]);
    
    if (requestRows.length === 0) {
      throw new AppError('Follow request not found or already processed.', 404, 'NOT_FOUND');
    }

    const { follower_id, following_id } = requestRows[0];

    // Create the actual follow relationship
    const followInsertQuery = `
      INSERT INTO follows (follower_id, following_id, created_at)
      VALUES ($1, $2, now())
      ON CONFLICT (follower_id, following_id) DO NOTHING
      RETURNING created_at
    `;
    const { rows: followRows } = await client.query(followInsertQuery, [follower_id, following_id]);

    // Update request status to accepted
    const updateQuery = `
      UPDATE follow_requests
      SET status = 'accepted', updated_at = now()
      WHERE id = $1
      RETURNING id, follower_id, following_id, status, created_at, updated_at
    `;
    const { rows: updateRows } = await client.query(updateQuery, [requestId]);

    await client.query('COMMIT');
    return updateRows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reject a follow request
 * Updates the request status without creating follow relationship
 */
exports.rejectFollowRequest = async (requestId, userId) => {
  const query = `
    UPDATE follow_requests
    SET status = 'rejected', updated_at = now()
    WHERE id = $1 AND following_id = $2 AND status = 'pending'
    RETURNING id, follower_id, following_id, status, created_at, updated_at
  `;
  const { rows } = await db.query(query, [requestId, userId]);
  
  if (rows.length === 0) {
    throw new AppError('Follow request not found or already processed.', 404, 'NOT_FOUND');
  }

  return rows[0];
};

/**
 * Cancel a follow request (follower cancels their request)
 * Deletes the follow request entirely
 */
exports.cancelFollowRequest = async (requestId, followerId) => {
  const query = `
    DELETE FROM follow_requests
    WHERE id = $1 AND follower_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [requestId, followerId]);
  
  if (rows.length === 0) {
    throw new AppError('Follow request not found.', 404, 'NOT_FOUND');
  }

  return { success: true };
};
