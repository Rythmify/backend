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

module.exports = {
  findTrackByIdForPlaybackState,
  insertListeningHistory,
};
