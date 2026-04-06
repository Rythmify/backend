// ============================================================
// models/track-like.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for track likes functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Get paginated list of users who liked a track
 * Returns user profiles ordered by like creation date (newest first)
 */
exports.getTrackLikers = async (trackId, limit, offset) => {
  // Verify track exists
  const trackCheck = await db.query('SELECT id FROM tracks WHERE id = $1 AND deleted_at IS NULL', [
    trackId,
  ]);
  if (!trackCheck.rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const query = `
    SELECT u.id, u.username, u.display_name, u.profile_picture, u.is_verified,
           tl.created_at as liked_at
    FROM track_likes tl
    JOIN users u ON tl.user_id = u.id
    WHERE tl.track_id = $1 AND u.deleted_at IS NULL
    ORDER BY tl.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [trackId, limit, offset]);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM track_likes tl
    JOIN users u ON tl.user_id = u.id
    WHERE tl.track_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [trackId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check if user already likes a track
 * Returns: like_id (uuid) if exists, null otherwise
 */
exports.checkTrackLike = async (userId, trackId) => {
  const query = `
    SELECT id FROM track_likes 
    WHERE user_id = $1 AND track_id = $2
  `;
  const { rows } = await db.query(query, [userId, trackId]);
  return rows[0]?.id || null;
};

/**
 * Get user's liked tracks (paginated)
 * Used for /me/liked-tracks endpoint
 */
exports.getUserLikedTracks = async (userId, limit, offset) => {
  const query = `
    SELECT t.id, t.title, t.cover_image, t.duration, t.user_id,
           u.username, u.display_name, u.profile_picture,
           t.is_public, t.release_date,
           t.like_count, t.comment_count,
           tl.created_at as liked_at
    FROM track_likes tl
    JOIN tracks t ON tl.track_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE tl.user_id = $1 
      AND t.deleted_at IS NULL 
      AND u.deleted_at IS NULL
    ORDER BY tl.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT tl.track_id) as total 
    FROM track_likes tl
    JOIN tracks t ON tl.track_id = t.id
    WHERE tl.user_id = $1 AND t.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

// ===== CREATE QUERIES =====

/**
 * Create a like on a track (idempotent)
 * Returns: { created: true, like_id } if newly created
 * Returns: { created: false, like_id } if already existed
 */
exports.likeTrack = async (userId, trackId) => {
  // Verify track exists and is not deleted
  const trackCheck = await db.query('SELECT id FROM tracks WHERE id = $1 AND deleted_at IS NULL', [
    trackId,
  ]);
  if (!trackCheck.rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  try {
    // Try to insert new like (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO track_likes (user_id, track_id)
      VALUES ($1, $2)
      RETURNING id, user_id, track_id, created_at
    `;
    const { rows } = await db.query(query, [userId, trackId]);
    return { created: true, like: rows[0] };
  } catch (err) {
    // Unique constraint violation = already liked
    if (err.code === '23505') {
      // Get existing like
      const query = `
        SELECT id, user_id, track_id, created_at 
        FROM track_likes 
        WHERE user_id = $1 AND track_id = $2
      `;
      const { rows } = await db.query(query, [userId, trackId]);
      return { created: false, like: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a like from a track
 * Returns: true if deleted, false if not found
 */
exports.unlikeTrack = async (userId, trackId) => {
  // Verify track exists
  const trackCheck = await db.query('SELECT id FROM tracks WHERE id = $1', [trackId]);
  if (!trackCheck.rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const query = `
    DELETE FROM track_likes 
    WHERE user_id = $1 AND track_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, trackId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total like count for a track
 */
exports.getTrackLikeCount = async (trackId) => {
  const query = `
    SELECT COUNT(*) as like_count FROM track_likes 
    WHERE track_id = $1
  `;
  const { rows } = await db.query(query, [trackId]);
  return parseInt(rows[0].like_count);
};

/**
 * Check if current user likes a track (for response decoration)
 */
exports.isTrackLikedByUser = async (userId, trackId) => {
  if (!userId) return false; // Not authenticated

  const query = `
    SELECT EXISTS(
      SELECT 1 FROM track_likes 
      WHERE user_id = $1 AND track_id = $2
    ) as is_liked
  `;
  const { rows } = await db.query(query, [userId, trackId]);
  return rows[0].is_liked;
};
