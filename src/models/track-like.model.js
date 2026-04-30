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
 * Returns full track details with personalization flags
 */
exports.getUserLikedTracks = async (userId, limit, offset) => {
  const query = `
    SELECT 
      t.id,
      t.title,
      t.description,
      g.name AS genre,
      u.display_name AS artist_name,
      t.cover_image,
      t.waveform_url,
      t.audio_url,
      t.stream_url,
      t.preview_url,
      t.duration,
      t.file_size,
      t.bitrate,
      t.status,
      t.is_public,
      t.secret_token,
      t.is_trending,
      t.is_featured,
      t.is_hidden,
      t.user_id,
      t.release_date,
      t.isrc,
      t.p_line,
      t.buy_link,
      t.record_label,
      t.publisher,
      t.explicit_content,
      t.license_type,
      t.enable_downloads,
      t.enable_offline_listening,
      t.include_in_rss_feed,
      t.display_embed_code,
      t.enable_app_playback,
      t.allow_comments,
      t.show_comments_public,
      t.show_insights_public,
      t.geo_restriction_type,
      t.geo_regions,
      t.play_count,
      t.like_count,
      t.comment_count,
      t.repost_count,
      CASE
        WHEN $2::uuid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM track_likes tl2
          WHERE tl2.track_id = t.id
            AND tl2.user_id = $2::uuid
        )
      END AS is_liked_by_me,
      CASE
        WHEN $2::uuid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM track_reposts tr
          WHERE tr.track_id = t.id
            AND tr.user_id = $2::uuid
        )
      END AS is_reposted_by_me,
      CASE
        WHEN $2::uuid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = $2::uuid
            AND f.following_id = t.user_id
        )
      END AS is_artist_followed_by_me,
      t.created_at,
      t.updated_at,
      COALESCE(tag_data.tags, ARRAY[]::text[]) AS tags,
      tl.created_at as liked_at
    FROM track_likes tl
    JOIN tracks t ON tl.track_id = t.id
    LEFT JOIN genres g ON g.id = t.genre_id
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN LATERAL (
      SELECT array_agg(tag.id::text ORDER BY tag.id::text) AS tags
      FROM track_tags tt
      JOIN tags tag ON tag.id = tt.tag_id
      WHERE tt.track_id = t.id
    ) tag_data ON true
    WHERE tl.user_id = $1 
      AND t.deleted_at IS NULL 
      AND t.status = 'ready'
      AND NULLIF(BTRIM(t.title), '') IS NOT NULL
      AND t.title <> 'tracks'
      AND t.cover_image IS NOT NULL
      AND t.cover_image <> 'pending'
      AND t.audio_url IS NOT NULL
      AND t.audio_url <> 'pending'
      AND t.stream_url IS NOT NULL
      AND t.stream_url <> 'pending'
      AND u.deleted_at IS NULL
    ORDER BY tl.created_at DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await db.query(query, [userId, userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(DISTINCT tl.track_id) as total 
    FROM track_likes tl
    JOIN tracks t ON tl.track_id = t.id
    WHERE tl.user_id = $1
      AND t.deleted_at IS NULL
      AND t.status = 'ready'
      AND NULLIF(BTRIM(t.title), '') IS NOT NULL
      AND t.title <> 'tracks'
      AND t.cover_image IS NOT NULL
      AND t.cover_image <> 'pending'
      AND t.audio_url IS NOT NULL
      AND t.audio_url <> 'pending'
      AND t.stream_url IS NOT NULL
      AND t.stream_url <> 'pending'
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

/**
 * Batch check: returns a Set of track_ids that the user has liked
 * from the provided list of IDs.
 */
exports.getLikedTrackIds = async (userId, trackIds) => {
  if (!userId || !Array.isArray(trackIds) || trackIds.length === 0) return new Set();

  const { rows } = await db.query(
    `SELECT track_id FROM track_likes WHERE user_id = $1 AND track_id = ANY($2::uuid[])`,
    [userId, trackIds]
  );
  return new Set(rows.map((r) => r.track_id));
};
