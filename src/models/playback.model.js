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

/* Deletes every listening history row for one user so history clearing stays idempotent. */
const deleteListeningHistoryByUserId = async (userId) => {
  const query = `
    DELETE FROM listening_history
    WHERE user_id = $1
  `;

  const result = await db.query(query, [userId]);
  return result.rowCount || 0;
};

/* Finds a recent listening history row for the same user and track inside the dedupe window. */
const findRecentListeningHistoryEntry = async ({
  userId,
  trackId,
  playedAt,
  windowSeconds = 30,
}) => {
  const query = `
    SELECT
      lh.id,
      lh.user_id,
      lh.track_id,
      lh.duration_played,
      lh.played_at
    FROM listening_history lh
    WHERE lh.user_id = $1
      AND lh.track_id = $2
      AND lh.played_at BETWEEN ($3::timestamptz - make_interval(secs => $4::int)) AND $3::timestamptz
    ORDER BY lh.played_at DESC, lh.id DESC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [userId, trackId, playedAt, windowSeconds]);
  return rows[0] || null;
};

/* Finds the newest recent listening-history row for one user and track for best-effort progress enrichment. */
const findLatestListeningHistoryEntryByUserAndTrack = async ({ userId, trackId, playedAfter }) => {
  const query = `
    SELECT
      lh.id,
      lh.user_id,
      lh.track_id,
      lh.duration_played,
      lh.played_at
    FROM listening_history lh
    WHERE lh.user_id = $1
      AND lh.track_id = $2
      AND ($3::timestamptz IS NULL OR lh.played_at >= $3::timestamptz)
    ORDER BY lh.played_at DESC, lh.id DESC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [userId, trackId, playedAfter || null]);
  return rows[0] || null;
};

/* Updates listening-history progress without ever decreasing the stored best-known furthest position. */
const updateListeningHistoryProgress = async ({ historyId, progressSeconds }) => {
  const query = `
    UPDATE listening_history
    SET duration_played = GREATEST(duration_played, $2::int)
    WHERE id = $1
    RETURNING id, user_id, track_id, duration_played, played_at
  `;

  const { rows } = await db.query(query, [historyId, progressSeconds]);
  return rows[0] || null;
};

/* Shapes shared TrackSummary-style fields so playback list responses stay consistent. */
const mapTrackSummary = (row) => ({
  id: row.id,
  title: row.title,
  genre: row.genre,
  duration: row.duration,
  cover_image: row.cover_image,
  user_id: row.user_id,
  artist_name: row.artist_name,
  play_count: row.play_count,
  like_count: row.like_count,
  stream_url: row.stream_url,
});

/* Shapes the /me/history track summary, extending the shared fields with tag names only here. */
const mapRecentlyPlayedTrackSummary = (row) => ({
  ...mapTrackSummary(row),
  tags: Array.isArray(row.tags) ? row.tags : [],
});

/* Shapes a recently played row into the nested track summary contract used by the API response. */
const mapRecentlyPlayedRow = (row) => ({
  track: mapRecentlyPlayedTrackSummary(row),
  last_played_at: row.last_played_at,
});

/* Shapes a listening history row into the nested track summary contract used by the API response. */
const mapListeningHistoryRow = (row) => ({
  id: row.history_id,
  track: mapTrackSummary(row),
  played_at: row.played_at,
});

/* Shared deduplication CTE so /me/history rows and totals stay perfectly aligned. */
const RECENTLY_PLAYED_DEDUPLICATION_CTE = `
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
`;

/* Fetches one page of deduplicated recently played tracks for one user. */
const findRecentlyPlayedByUserId = async (userId, limit = 20, offset = 0) => {
  const query = `
    ${RECENTLY_PLAYED_DEDUPLICATION_CTE}
    SELECT
      t.id,
      t.title,
      g.name AS genre,
      t.duration,
      t.cover_image,
      t.user_id,
      u.display_name AS artist_name,
      t.play_count,
      t.like_count,
      t.stream_url,
      COALESCE(tag_data.tags, ARRAY[]::text[]) AS tags,
      deduplicated_history.last_played_at
    FROM deduplicated_history
    JOIN tracks t
      ON t.id = deduplicated_history.track_id
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    LEFT JOIN LATERAL (
      SELECT array_agg(tag_name.name ORDER BY tag_name.name) AS tags
      FROM (
        SELECT DISTINCT tag.name
        FROM track_tags tt
        JOIN tags tag
          ON tag.id = tt.tag_id
        WHERE tt.track_id = t.id
      ) tag_name
    ) tag_data ON true
    ORDER BY deduplicated_history.last_played_at DESC, t.id ASC
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await db.query(query, [userId, limit, offset]);
  return rows.map(mapRecentlyPlayedRow);
};

/* Counts deduplicated recently played tracks so /me/history pagination metadata stays accurate. */
const countRecentlyPlayedByUserId = async (userId) => {
  const query = `
    ${RECENTLY_PLAYED_DEDUPLICATION_CTE}
    SELECT COUNT(*)::int AS total
    FROM deduplicated_history
  `;

  const { rows } = await db.query(query, [userId]);
  return rows[0]?.total || 0;
};

/* Fetches a paginated play-by-play listening history for one user ordered newest first. */
const findListeningHistoryByUserId = async (userId, limit = 20, offset = 0) => {
  const query = `
    SELECT
      lh.id AS history_id,
      lh.played_at,
      t.id,
      t.title,
      g.name AS genre,
      t.duration,
      t.cover_image,
      t.user_id,
      u.display_name AS artist_name,
      t.play_count,
      t.like_count,
      t.stream_url
    FROM listening_history lh
    JOIN tracks t
      ON t.id = lh.track_id
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    WHERE lh.user_id = $1
      AND t.deleted_at IS NULL
    ORDER BY lh.played_at DESC, lh.id DESC
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await db.query(query, [userId, limit, offset]);
  return rows.map(mapListeningHistoryRow);
};

/* Counts non-deleted listening history rows for one user so pagination totals stay accurate. */
const countListeningHistoryByUserId = async (userId) => {
  const query = `
    SELECT COUNT(*)::int AS total
    FROM listening_history lh
    JOIN tracks t
      ON t.id = lh.track_id
    WHERE lh.user_id = $1
      AND t.deleted_at IS NULL
  `;

  const { rows } = await db.query(query, [userId]);
  return rows[0]?.total || 0;
};

module.exports = {
  findTrackByIdForPlaybackState,
  insertListeningHistory,
  deleteListeningHistoryByUserId,
  findRecentListeningHistoryEntry,
  findLatestListeningHistoryEntryByUserAndTrack,
  updateListeningHistoryProgress,
  findRecentlyPlayedByUserId,
  countRecentlyPlayedByUserId,
  findListeningHistoryByUserId,
  countListeningHistoryByUserId,
};
