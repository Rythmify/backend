// ============================================================
// models/playlist-repost.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for playlist reposts functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Get paginated list of users who reposted a playlist
 * Returns user profiles ordered by repost creation date (newest first)
 */
exports.getPlaylistReposters = async (playlistId, limit, offset) => {
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
           pr.created_at as reposted_at
    FROM playlist_reposts pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.playlist_id = $1 AND u.deleted_at IS NULL
    ORDER BY pr.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [playlistId, limit, offset]);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM playlist_reposts pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.playlist_id = $1 AND u.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [playlistId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Check if user already reposted a playlist
 * Returns: repost_id (uuid) if exists, null otherwise
 */
exports.checkPlaylistRepost = async (userId, playlistId) => {
  const query = `
    SELECT id FROM playlist_reposts 
    WHERE user_id = $1 AND playlist_id = $2
  `;
  const { rows } = await db.query(query, [userId, playlistId]);
  return rows[0]?.id || null;
};

/**
 * Get user's reposted playlists (paginated)
 * Used for /me/reposted-playlists endpoint
 */
exports.getUserRepostedPlaylists = async (userId, limit, offset) => {
  const query = `
    SELECT p.id, p.name, p.description, p.cover_image, p.user_id,
           u.username, u.display_name, u.profile_picture,
           p.is_public, p.track_count, p.like_count,
           pr.created_at as reposted_at
    FROM playlist_reposts pr
    JOIN playlists p ON pr.playlist_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE pr.user_id = $1 
      AND p.deleted_at IS NULL 
      AND u.deleted_at IS NULL
    ORDER BY pr.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT pr.playlist_id) as total 
    FROM playlist_reposts pr
    JOIN playlists p ON pr.playlist_id = p.id
    WHERE pr.user_id = $1 AND p.deleted_at IS NULL
  `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);

  return { items: rows, total, limit, offset };
};

/**
 * Get the owner/creator of a playlist
 * Used to verify user is not reposting their own playlist
 */
exports.getPlaylistOwner = async (playlistId) => {
  const query = `
    SELECT user_id FROM playlists WHERE id = $1 AND deleted_at IS NULL
  `;
  const { rows } = await db.query(query, [playlistId]);

  if (!rows.length) {
    throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  }

  return rows[0].user_id;
};

// ===== CREATE QUERIES =====

/**
 * Create a repost on a playlist (idempotent)
 * Returns: { created: true, repost } if newly created
 * Returns: { created: false, repost } if already existed
 */
exports.repostPlaylist = async (userId, playlistId) => {
  // Verify playlist exists and is not deleted
  const playlistCheck = await db.query(
    'SELECT id FROM playlists WHERE id = $1 AND deleted_at IS NULL',
    [playlistId]
  );
  if (!playlistCheck.rows.length) {
    throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  }

  try {
    // Try to insert new repost (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO playlist_reposts (user_id, playlist_id)
      VALUES ($1, $2)
      RETURNING id, user_id, playlist_id, created_at
    `;
    const { rows } = await db.query(query, [userId, playlistId]);
    return { created: true, repost: rows[0] };
  } catch (err) {
    // Unique constraint violation = already reposted
    if (err.code === '23505') {
      // Get existing repost
      const query = `
        SELECT id, user_id, playlist_id, created_at 
        FROM playlist_reposts 
        WHERE user_id = $1 AND playlist_id = $2
      `;
      const { rows } = await db.query(query, [userId, playlistId]);
      return { created: false, repost: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a repost from a playlist
 * Returns: true if deleted, false if not found
 */
exports.removeRepost = async (userId, playlistId) => {
  // Verify playlist exists
  const playlistCheck = await db.query('SELECT id FROM playlists WHERE id = $1', [playlistId]);
  if (!playlistCheck.rows.length) {
    throw new AppError('Playlist not found', 404, 'PLAYLIST_NOT_FOUND');
  }

  const query = `
    DELETE FROM playlist_reposts 
    WHERE user_id = $1 AND playlist_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, playlistId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total repost count for a playlist
 */
exports.getPlaylistRepostCount = async (playlistId) => {
  const query = `
    SELECT COUNT(*) as repost_count FROM playlist_reposts 
    WHERE playlist_id = $1
  `;
  const { rows } = await db.query(query, [playlistId]);
  return parseInt(rows[0].repost_count);
};

/**
 * Check if current user has reposted a playlist (for response decoration)
 */
exports.isPlaylistRepostedByUser = async (userId, playlistId) => {
  if (!userId) return false; // Not authenticated

  const query = `
    SELECT EXISTS(
      SELECT 1 FROM playlist_reposts 
      WHERE user_id = $1 AND playlist_id = $2
    ) as is_reposted
  `;
  const { rows } = await db.query(query, [userId, playlistId]);
  return rows[0].is_reposted;
};
