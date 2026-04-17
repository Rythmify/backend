// ============================================================
// models/album-repost.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for album reposts functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Get paginated list of users who reposted an album
 * Returns user profiles ordered by repost creation date (newest first)
 */
exports.getAlbumReposters = async (albumId, limit, offset) => {
  // Verify album exists
  const albumCheck = await db.query('SELECT id FROM albums WHERE id = $1 AND deleted_at IS NULL', [
    albumId,
  ]);
  if (!albumCheck.rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  const query = `
    SELECT u.id, u.username, u.display_name, u.profile_picture, u.is_verified,
           ar.created_at as reposted_at
    FROM album_reposts ar
    JOIN users u ON ar.user_id = u.id
    WHERE ar.album_id = $1 AND u.deleted_at IS NULL
    ORDER BY ar.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [albumId, limit, offset]);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM album_reposts ar
    JOIN users u ON ar.user_id = u.id
    WHERE ar.album_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [albumId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check if user already reposted an album
 * Returns: repost_id (uuid) if exists, null otherwise
 */
exports.checkAlbumRepost = async (userId, albumId) => {
  const query = `
    SELECT id FROM album_reposts 
    WHERE user_id = $1 AND album_id = $2
  `;
  const { rows } = await db.query(query, [userId, albumId]);
  return rows[0]?.id || null;
};

/**
 * Get user's reposted albums (paginated)
 * Used for /me/reposted-albums endpoint
 */
exports.getUserRepostedAlbums = async (userId, limit, offset) => {
  const query = `
    SELECT a.id, a.title, a.cover_image, a.artist_id,
           u.username, u.display_name, u.profile_picture,
           a.release_date, a.track_count, a.like_count,
           ar.created_at as reposted_at
    FROM album_reposts ar
    JOIN albums a ON ar.album_id = a.id
    JOIN users u ON a.artist_id = u.id
    WHERE ar.user_id = $1 
      AND a.deleted_at IS NULL 
      AND u.deleted_at IS NULL
    ORDER BY ar.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT ar.album_id) as total 
    FROM album_reposts ar
    JOIN albums a ON ar.album_id = a.id
    WHERE ar.user_id = $1 AND a.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Get the owner/creator of an album
 * Used to verify user is not reposting their own album
 */
exports.getAlbumOwner = async (albumId) => {
  const query = `
    SELECT artist_id FROM albums WHERE id = $1 AND deleted_at IS NULL
  `;
  const { rows } = await db.query(query, [albumId]);

  if (!rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  return rows[0].artist_id;
};

// ===== CREATE QUERIES =====

/**
 * Create a repost on an album (idempotent)
 * Returns: { created: true, repost } if newly created
 * Returns: { created: false, repost } if already existed
 */
exports.repostAlbum = async (userId, albumId) => {
  // Verify album exists and is not deleted
  const albumCheck = await db.query('SELECT id FROM albums WHERE id = $1 AND deleted_at IS NULL', [
    albumId,
  ]);
  if (!albumCheck.rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  try {
    // Try to insert new repost (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO album_reposts (user_id, album_id)
      VALUES ($1, $2)
      RETURNING id, user_id, album_id, created_at
    `;
    const { rows } = await db.query(query, [userId, albumId]);
    return { created: true, repost: rows[0] };
  } catch (err) {
    // Unique constraint violation = already reposted
    if (err.code === '23505') {
      // Get existing repost
      const query = `
        SELECT id, user_id, album_id, created_at 
        FROM album_reposts 
        WHERE user_id = $1 AND album_id = $2
      `;
      const { rows } = await db.query(query, [userId, albumId]);
      return { created: false, repost: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a repost from an album
 * Returns: true if deleted, false if not found
 */
exports.removeRepost = async (userId, albumId) => {
  // Verify album exists
  const albumCheck = await db.query('SELECT id FROM albums WHERE id = $1', [albumId]);
  if (!albumCheck.rows.length) {
    throw new AppError('Album not found', 404, 'ALBUM_NOT_FOUND');
  }

  const query = `
    DELETE FROM album_reposts 
    WHERE user_id = $1 AND album_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, albumId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total repost count for an album
 */
exports.getAlbumRepostCount = async (albumId) => {
  const query = `
    SELECT COUNT(*) as repost_count FROM album_reposts 
    WHERE album_id = $1
  `;
  const { rows } = await db.query(query, [albumId]);
  return parseInt(rows[0].repost_count);
};

/**
 * Check if current user has reposted an album (for response decoration)
 */
exports.isAlbumRepostedByUser = async (userId, albumId) => {
  if (!userId) return false; // Not authenticated

  const query = `
    SELECT EXISTS(
      SELECT 1 FROM album_reposts 
      WHERE user_id = $1 AND album_id = $2
    ) as is_reposted
  `;
  const { rows } = await db.query(query, [userId, albumId]);
  return rows[0].is_reposted;
};
