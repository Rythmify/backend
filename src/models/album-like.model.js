// ============================================================
// models/album-like.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for album likes functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Get paginated list of users who liked an album
 * Returns user profiles ordered by like creation date (newest first)
 */
exports.getAlbumLikers = async (albumId, limit, offset) => {
  // Verify album exists
  const albumCheck = await db.query(
    'SELECT id FROM albums WHERE id = $1 AND deleted_at IS NULL',
    [albumId]
  );
  if (!albumCheck.rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  const query = `
    SELECT u.id, u.username, u.display_name, u.profile_picture, u.is_verified,
           al.created_at as liked_at
    FROM album_likes al
    JOIN users u ON al.user_id = u.id
    WHERE al.album_id = $1 AND u.deleted_at IS NULL
    ORDER BY al.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [albumId, limit, offset]);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM album_likes al
    JOIN users u ON al.user_id = u.id
    WHERE al.album_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [albumId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check if user already likes an album
 * Returns: like_id (uuid) if exists, null otherwise
 */
exports.checkAlbumLike = async (userId, albumId) => {
  const query = `
    SELECT id FROM album_likes 
    WHERE user_id = $1 AND album_id = $2
  `;
  const { rows } = await db.query(query, [userId, albumId]);
  return rows[0]?.id || null;
};

/**
 * Get user's liked albums (paginated)
 * Used for /me/liked-albums endpoint
 */
exports.getUserLikedAlbums = async (userId, limit, offset) => {
  const query = `
    SELECT a.id, a.title, a.cover_image, a.user_id,
           u.username, u.display_name, u.profile_picture,
           a.is_public, a.release_date,
           COUNT(DISTINCT al.user_id) as like_count,
           al.created_at as liked_at
    FROM album_likes al
    JOIN albums a ON al.album_id = a.id
    JOIN users u ON a.user_id = u.id
    WHERE al.user_id = $1 
      AND a.deleted_at IS NULL 
      AND u.deleted_at IS NULL
    GROUP BY a.id, u.id, al.id
    ORDER BY al.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT al.album_id) as total 
    FROM album_likes al
    JOIN albums a ON al.album_id = a.id
    WHERE al.user_id = $1 AND a.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

// ===== CREATE QUERIES =====

/**
 * Create a like on an album (idempotent)
 * Returns: { created: true, like_id } if newly created
 * Returns: { created: false, like_id } if already existed
 */
exports.likeAlbum = async (userId, albumId) => {
  // Verify album exists and is not deleted
  const albumCheck = await db.query(
    'SELECT id, user_id FROM albums WHERE id = $1 AND deleted_at IS NULL',
    [albumId]
  );
  if (!albumCheck.rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  try {
    // Try to insert new like (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO album_likes (user_id, album_id)
      VALUES ($1, $2)
      RETURNING id, user_id, album_id, created_at
    `;
    const { rows } = await db.query(query, [userId, albumId]);
    return { created: true, like: rows[0] };
  } catch (err) {
    // Unique constraint violation = already liked
    if (err.code === '23505') {
      // Get existing like
      const query = `
        SELECT id, user_id, album_id, created_at 
        FROM album_likes 
        WHERE user_id = $1 AND album_id = $2
      `;
      const { rows } = await db.query(query, [userId, albumId]);
      return { created: false, like: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a like from an album
 * Returns: true if deleted, false if not found
 */
exports.unlikeAlbum = async (userId, albumId) => {
  // Verify album exists
  const albumCheck = await db.query(
    'SELECT id FROM albums WHERE id = $1',
    [albumId]
  );
  if (!albumCheck.rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  const query = `
    DELETE FROM album_likes 
    WHERE user_id = $1 AND album_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, albumId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total like count for an album
 */
exports.getAlbumLikeCount = async (albumId) => {
  const query = `
    SELECT COUNT(*) as like_count FROM album_likes 
    WHERE album_id = $1
  `;
  const { rows } = await db.query(query, [albumId]);
  return parseInt(rows[0].like_count);
};

/**
 * Check if current user likes an album (for response decoration)
 */
exports.isAlbumLikedByUser = async (userId, albumId) => {
  if (!userId) return false; // Not authenticated
  
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM album_likes 
      WHERE user_id = $1 AND album_id = $2
    ) as is_liked
  `;
  const { rows } = await db.query(query, [userId, albumId]);
  return rows[0].is_liked;
};
