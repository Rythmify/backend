// ============================================================
// models/playback.model.js
// PostgreSQL queries for playback-state reads and playback-only data access
// All SQL lives HERE - no SQL outside models/
// ============================================================
const db = require('../config/db');
const { buildTrackPersonalizationSelect } = require('./track-personalization');

const VALID_PLAYABLE_TRACK_FILTER = `
  NULLIF(BTRIM(t.title), '') IS NOT NULL
  AND t.title <> 'tracks'
  AND t.cover_image IS NOT NULL
  AND t.cover_image <> 'pending'
  AND t.audio_url IS NOT NULL
  AND t.audio_url <> 'pending'
  AND t.stream_url IS NOT NULL
  AND t.stream_url <> 'pending'
`;

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
      AND ${VALID_PLAYABLE_TRACK_FILTER}
    LIMIT 1
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

/* Batch-loads lightweight track metadata for playback queue and player-state response enrichment. */
const findTrackMetadataByIds = async (trackIds) => {
  if (!Array.isArray(trackIds) || !trackIds.length) {
    return [];
  }

  const query = `
    SELECT
      t.id,
      t.title,
      t.duration,
      t.cover_image,
      t.stream_url,
      t.audio_url,
      t.user_id,
      u.display_name AS artist_name
    FROM tracks t
    LEFT JOIN users u
      ON u.id = t.user_id
    WHERE t.id = ANY($1::uuid[])
      AND t.deleted_at IS NULL
      AND ${VALID_PLAYABLE_TRACK_FILTER}
  `;

  const { rows } = await db.query(query, [trackIds]);
  return rows;
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

/* Soft-deletes active listening history rows for one user so clearing preserves analytics rows. */
const softDeleteListeningHistoryByUserId = async (userId) => {
  const query = `
    UPDATE listening_history
    SET deleted_at = NOW()
    WHERE user_id = $1
      AND deleted_at IS NULL
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
      AND lh.deleted_at IS NULL
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
      AND lh.deleted_at IS NULL
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
      AND deleted_at IS NULL
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
  comment_count: row.comment_count,
  repost_count: row.repost_count,
  stream_url: row.stream_url,
  audio_url: row.audio_url,
});

/* Normalizes requested personalization fields into stable booleans for API consumers. */
const mapTrackPersonalizationFlags = (row, fieldNames) =>
  fieldNames.reduce((accumulator, fieldName) => {
    accumulator[fieldName] = Boolean(row[fieldName]);
    return accumulator;
  }, {});

/* Shapes the /me/history track summary, extending the shared fields with tag names only here. */
const mapRecentlyPlayedTrackSummary = (row) => ({
  ...mapTrackSummary(row),
  tags: Array.isArray(row.tags) ? row.tags : [],
  ...mapTrackPersonalizationFlags(row, [
    'is_liked_by_me',
    'is_reposted_by_me',
    'is_artist_followed_by_me',
  ]),
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
      AND lh.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND t.status = 'ready'
      AND ${VALID_PLAYABLE_TRACK_FILTER}
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
      t.comment_count,
      t.repost_count,
      t.stream_url,
      t.audio_url,
      COALESCE(tag_data.tags, ARRAY[]::text[]) AS tags,
      ${buildTrackPersonalizationSelect({
        requesterUserIdParam: '$1',
        trackAlias: 't',
      })},
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
      t.comment_count,
      t.repost_count,
      t.stream_url,
      t.audio_url
    FROM listening_history lh
    JOIN tracks t
      ON t.id = lh.track_id
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    WHERE lh.user_id = $1
      AND lh.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND t.status = 'ready'
      AND ${VALID_PLAYABLE_TRACK_FILTER}
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
      AND lh.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND t.status = 'ready'
      AND ${VALID_PLAYABLE_TRACK_FILTER}
  `;

  const { rows } = await db.query(query, [userId]);
  return rows[0]?.total || 0;
};

module.exports = {
  findTrackByIdForPlaybackState,
  findTrackMetadataByIds,
  insertListeningHistory,
  softDeleteListeningHistoryByUserId,
  deleteListeningHistoryByUserId: softDeleteListeningHistoryByUserId,
  findRecentListeningHistoryEntry,
  findLatestListeningHistoryEntryByUserAndTrack,
  updateListeningHistoryProgress,
  findRecentlyPlayedByUserId,
  countRecentlyPlayedByUserId,
  findListeningHistoryByUserId,
  countListeningHistoryByUserId,
};
