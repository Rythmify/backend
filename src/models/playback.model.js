// ============================================================
// models/playback.model.js
// PostgreSQL queries for playback-state reads and playback-only data access
// All SQL lives HERE - no SQL outside models/
// ============================================================
const db = require('../config/db');

/* Fetches the minimal track fields required to resolve playback-state access and availability. */
const findTrackByIdForPlaybackState = async (trackId) => {
  const query = `
    SELECT
      t.id,
      t.status,
      t.is_public,
      t.is_hidden,
      t.secret_token,
      t.user_id,
      t.stream_url,
      t.preview_url,
      t.audio_url,
      t.geo_restriction_type,
      t.geo_regions,
      t.enable_app_playback
    FROM tracks t
    WHERE t.id = $1
      AND t.deleted_at IS NULL
    LIMIT 1
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

/* Inserts a listening history row so the database trigger can increment track play_count. */
const insertListeningHistory = async ({ userId, trackId, durationPlayed = 0, playedAt = null }) => {
  const query = `
    INSERT INTO listening_history (
      user_id,
      track_id,
      duration_played,
      played_at
    )
    VALUES ($1, $2, $3, COALESCE($4, now()))
    RETURNING id, user_id, track_id, duration_played, played_at
  `;

  const { rows } = await db.query(query, [userId, trackId, durationPlayed, playedAt]);
  return rows[0] || null;
};

/* Shapes a recently played row into the nested track summary contract used by the API response. */
const mapRecentlyPlayedRow = (row) => ({
  track: {
    id: row.id,
    title: row.title,
    genre: row.genre,
    duration: row.duration,
    cover_image: row.cover_image,
    user_id: row.user_id,
    play_count: row.play_count,
    like_count: row.like_count,
    stream_url: row.stream_url,
  },
  last_played_at: row.last_played_at,
});

/* Fetches up to the requested number of deduplicated recently played tracks for one user. */
const findRecentlyPlayedByUserId = async (userId, limit = 20) => {
  const query = `
    WITH deduplicated_history AS (
      SELECT DISTINCT ON (lh.track_id)
        lh.track_id,
        lh.played_at AS last_played_at
      FROM listening_history lh
      JOIN tracks t
        ON t.id = lh.track_id
      WHERE lh.user_id = $1
        AND t.deleted_at IS NULL
        AND t.status = 'ready'
        AND (
          t.user_id = $1
          OR (t.is_public = true AND t.is_hidden = false)
        )
      -- DISTINCT ON keeps only the latest play per track before the outer query sorts globally.
      ORDER BY lh.track_id, lh.played_at DESC, lh.id DESC
    )
    SELECT
      t.id,
      t.title,
      g.name AS genre,
      t.duration,
      t.cover_image,
      t.user_id,
      t.play_count,
      t.like_count,
      t.stream_url,
      deduplicated_history.last_played_at
    FROM deduplicated_history
    JOIN tracks t
      ON t.id = deduplicated_history.track_id
    LEFT JOIN genres g
      ON g.id = t.genre_id
    ORDER BY deduplicated_history.last_played_at DESC, t.id ASC
    LIMIT $2
  `;

  const { rows } = await db.query(query, [userId, limit]);
  return rows.map(mapRecentlyPlayedRow);
};

module.exports = {
  findTrackByIdForPlaybackState,
  insertListeningHistory,
  findRecentlyPlayedByUserId,
};
