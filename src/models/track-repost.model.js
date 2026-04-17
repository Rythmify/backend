// ============================================================
// models/track-repost.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for track reposts functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Get paginated list of users who reposted a track
 * Returns user profiles ordered by repost creation date (newest first)
 */
exports.getTrackReposters = async (trackId, limit, offset) => {
  // Verify track exists
  const trackCheck = await db.query('SELECT id FROM tracks WHERE id = $1 AND deleted_at IS NULL', [
    trackId,
  ]);
  if (!trackCheck.rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const query = `
    SELECT u.id, u.username, u.display_name, u.profile_picture, u.is_verified,
           tr.created_at as reposted_at
    FROM track_reposts tr
    JOIN users u ON tr.user_id = u.id
    WHERE tr.track_id = $1 AND u.deleted_at IS NULL
    ORDER BY tr.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [trackId, limit, offset]);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM track_reposts tr
    JOIN users u ON tr.user_id = u.id
    WHERE tr.track_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [trackId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check if user already reposted a track
 * Returns: repost_id (uuid) if exists, null otherwise
 */
exports.checkTrackRepost = async (userId, trackId) => {
  const query = `
    SELECT id FROM track_reposts 
    WHERE user_id = $1 AND track_id = $2
  `;
  const { rows } = await db.query(query, [userId, trackId]);
  return rows[0]?.id || null;
};

/**
 * Get user's reposted tracks (paginated)
 * Used for /me/reposted-tracks endpoint
 */
exports.getUserRepostedTracks = async (userId, limit, offset) => {
  const query = `
    SELECT t.id, t.title, t.cover_image, t.duration, t.user_id,
           u.username, u.display_name, u.profile_picture,
           t.is_public, t.release_date,
           t.like_count, t.comment_count, t.repost_count,
           tr.created_at as reposted_at
    FROM track_reposts tr
    JOIN tracks t ON tr.track_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE tr.user_id = $1 
      AND t.deleted_at IS NULL 
      AND u.deleted_at IS NULL
    ORDER BY tr.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT tr.track_id) as total 
    FROM track_reposts tr
    JOIN tracks t ON tr.track_id = t.id
    WHERE tr.user_id = $1 AND t.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Get the owner/creator of a track
 * Used to verify user is not reposting their own track
 */
exports.getTrackOwner = async (trackId) => {
  const query = `
    SELECT user_id FROM tracks WHERE id = $1 AND deleted_at IS NULL
  `;
  const { rows } = await db.query(query, [trackId]);

  if (!rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  return rows[0].user_id;
};

// ===== CREATE QUERIES =====

/**
 * Create a repost on a track (idempotent)
 * Returns: { created: true, repost } if newly created
 * Returns: { created: false, repost } if already existed
 */
exports.repostTrack = async (userId, trackId) => {
  // Verify track exists and is not deleted
  const trackCheck = await db.query('SELECT id FROM tracks WHERE id = $1 AND deleted_at IS NULL', [
    trackId,
  ]);
  if (!trackCheck.rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  try {
    // Try to insert new repost (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO track_reposts (user_id, track_id)
      VALUES ($1, $2)
      RETURNING id, user_id, track_id, created_at
    `;
    const { rows } = await db.query(query, [userId, trackId]);
    return { created: true, repost: rows[0] };
  } catch (err) {
    // Unique constraint violation = already reposted
    if (err.code === '23505') {
      // Get existing repost
      const query = `
        SELECT id, user_id, track_id, created_at 
        FROM track_reposts 
        WHERE user_id = $1 AND track_id = $2
      `;
      const { rows } = await db.query(query, [userId, trackId]);
      return { created: false, repost: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a repost from a track
 * Returns: true if deleted, false if not found
 */
exports.removeRepost = async (userId, trackId) => {
  // Verify track exists
  const trackCheck = await db.query('SELECT id FROM tracks WHERE id = $1', [trackId]);
  if (!trackCheck.rows.length) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const query = `
    DELETE FROM track_reposts 
    WHERE user_id = $1 AND track_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, trackId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total repost count for a track
 */
exports.getTrackRepostCount = async (trackId) => {
  const query = `
    SELECT COUNT(*) as repost_count FROM track_reposts 
    WHERE track_id = $1
  `;
  const { rows } = await db.query(query, [trackId]);
  return parseInt(rows[0].repost_count);
};

/**
 * Check if current user has reposted a track (for response decoration)
 */
exports.isTrackRepostedByUser = async (userId, trackId) => {
  if (!userId) return false; // Not authenticated

  const query = `
    SELECT EXISTS(
      SELECT 1 FROM track_reposts 
      WHERE user_id = $1 AND track_id = $2
    ) as is_reposted
  `;
  const { rows } = await db.query(query, [userId, trackId]);
  return rows[0].is_reposted;
};
