// ============================================================
// models/playlist-like.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for playlist likes functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Get paginated list of users who liked a playlist
 * Returns user profiles ordered by like creation date (newest first)
 */
exports.getPlaylistLikers = async (playlistId, limit, offset) => {
  // Verify playlist exists
  const playlistCheck = await db.query(
    'SELECT id FROM playlists WHERE id = $1 AND deleted_at IS NULL',
    [playlistId]
  );
  if (!playlistCheck.rows.length) {
    throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  }

  const query = `
    SELECT u.id, u.username, u.display_name, u.profile_picture, u.is_verified,
           pl.created_at as liked_at
    FROM playlist_likes pl
    JOIN users u ON pl.user_id = u.id
    WHERE pl.playlist_id = $1 AND u.deleted_at IS NULL
    ORDER BY pl.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [playlistId, limit, offset]);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM playlist_likes pl
    JOIN users u ON pl.user_id = u.id
    WHERE pl.playlist_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [playlistId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check if user already likes a playlist
 * Returns: like_id (uuid) if exists, null otherwise
 */
exports.checkPlaylistLike = async (userId, playlistId) => {
  const query = `
    SELECT id FROM playlist_likes 
    WHERE user_id = $1 AND playlist_id = $2
  `;
  const { rows } = await db.query(query, [userId, playlistId]);
  return rows[0]?.id || null;
};

/**
 * Get user's liked playlists (paginated)
 * Used for /me/liked-playlists endpoint
 */
exports.getUserLikedPlaylists = async (userId, limit, offset) => {
  const query = `
    SELECT p.id, p.name as title, p.description, p.cover_image, p.user_id,
           u.username, u.display_name, u.profile_picture,
           p.is_public, p.created_at as release_date,
           p.like_count, p.track_count,
           pl.created_at as liked_at
    FROM playlist_likes pl
    JOIN playlists p ON pl.playlist_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE pl.user_id = $1 
      AND p.deleted_at IS NULL 
      AND u.deleted_at IS NULL
    ORDER BY pl.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT pl.playlist_id) as total 
    FROM playlist_likes pl
    JOIN playlists p ON pl.playlist_id = p.id
    WHERE pl.user_id = $1 AND p.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

// ===== CREATE QUERIES =====

/**
 * Create a like on a playlist (idempotent)
 * Returns: { created: true, like_id } if newly created
 * Returns: { created: false, like_id } if already existed
 */
exports.likePlaylist = async (userId, playlistId) => {
  // Verify playlist exists and is not deleted
  const playlistCheck = await db.query(
    'SELECT id FROM playlists WHERE id = $1 AND deleted_at IS NULL',
    [playlistId]
  );
  if (!playlistCheck.rows.length) {
    throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  }

  try {
    // Try to insert new like (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO playlist_likes (user_id, playlist_id)
      VALUES ($1, $2)
      RETURNING id, user_id, playlist_id, created_at
    `;
    const { rows } = await db.query(query, [userId, playlistId]);
    return { created: true, like: rows[0] };
  } catch (err) {
    // Unique constraint violation = already liked
    if (err.code === '23505') {
      // Get existing like
      const query = `
        SELECT id, user_id, playlist_id, created_at 
        FROM playlist_likes 
        WHERE user_id = $1 AND playlist_id = $2
      `;
      const { rows } = await db.query(query, [userId, playlistId]);
      return { created: false, like: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a like from a playlist
 * Returns: true if deleted, false if not found
 */
exports.unlikePlaylist = async (userId, playlistId) => {
  // Verify playlist exists
  const playlistCheck = await db.query('SELECT id FROM playlists WHERE id = $1', [playlistId]);
  if (!playlistCheck.rows.length) {
    throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  }

  const query = `
    DELETE FROM playlist_likes 
    WHERE user_id = $1 AND playlist_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, playlistId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total like count for a playlist
 */
exports.getPlaylistLikeCount = async (playlistId) => {
  const query = `
    SELECT COUNT(*) as like_count FROM playlist_likes 
    WHERE playlist_id = $1
  `;
  const { rows } = await db.query(query, [playlistId]);
  return parseInt(rows[0].like_count);
};

/**
 * Check if current user likes a playlist (for response decoration)
 */
exports.isPlaylistLikedByUser = async (userId, playlistId) => {
  if (!userId) return false; // Not authenticated

  const query = `
    SELECT EXISTS(
      SELECT 1 FROM playlist_likes 
      WHERE user_id = $1 AND playlist_id = $2
    ) as is_liked
  `;
  const { rows } = await db.query(query, [userId, playlistId]);
  return rows[0].is_liked;
};
