// ============================================================
// models/feed.model.js
// Owner : Omar Hamza (BE-5)
// Raw DB queries — no business logic here
// ============================================================

const db = require('../config/db');

// ─────────────────────────────────────────────────────────────
// Shared SQL fragments
// ─────────────────────────────────────────────────────────────

const TRACK_COLUMNS = `
  t.id,
  t.title,
  t.cover_image,
  t.preview_url,
  t.duration,
  g.name        AS genre_name,
  t.play_count,
  t.like_count,
  COALESCE(t.repost_count, 0) AS repost_count,
  t.user_id,
  u.display_name AS artist_name,
  t.audio_url    AS stream_url,
  t.created_at
`;

const BASE_ARTIST_FILTER = `
  u.deleted_at IS NULL
  AND u.is_suspended = false
  AND u.role = 'artist'
`;

/**
 * Basic track visibility + artist validity guard.
 * Used in every track query.
 * Does NOT include block filtering (no userId available in global queries).
 */
const TRACK_FILTERS = `
  t.is_public  = true
  AND t.is_hidden  = false
  AND t.status     = 'ready'
  AND t.deleted_at IS NULL
  AND ${BASE_ARTIST_FILTER}
`;

/**
 * Block filter for user-scoped queries.
 * Usage: AND ${blockFilter('$1')}
 *
 * Covers both directions:
 *   - the current user has blocked the artist
 *   - the artist has blocked the current user
 *
 * Pass the bind-param placeholder for the current userId as the argument.
 */
const blockFilter = (userParam) => `
  NOT EXISTS (
    SELECT 1 FROM blocks blk
    WHERE blk.blocker_id = ${userParam}
      AND blk.blocked_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocks blk
    WHERE blk.blocker_id = u.id
      AND blk.blocked_id = ${userParam}
  )
`;

const optionalBlockFilter = (userParam, targetExpr = 'u.id') => `
  (
    ${userParam}::uuid IS NULL
    OR (
      NOT EXISTS (
        SELECT 1 FROM blocks blk
        WHERE blk.blocker_id = ${userParam}
          AND blk.blocked_id = ${targetExpr}
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks blk
        WHERE blk.blocker_id = ${targetExpr}
          AND blk.blocked_id = ${userParam}
      )
    )
  )
`;

// ─────────────────────────────────────────────────────────────
// getDailyTracks
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getDailyTracks(limit, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT ${TRACK_COLUMNS}
    FROM   tracks t
    JOIN   users  u ON u.id = t.user_id
    LEFT   JOIN genres g ON g.id = t.genre_id
    WHERE  ${TRACK_FILTERS}
      AND  ${optionalBlockFilter('$2')}
    ORDER  BY (
              COALESCE(t.play_count, 0)::numeric
              + (10 / (1 + EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400.0))
            ) DESC,
              t.created_at DESC
    LIMIT  $1
    `,
    [limit, viewerUserId]
  );

  return rows;
}

async function isFollowingArtist(userId, artistId) {
  const { rows } = await db.query(
    `
    SELECT 1
    FROM follows
    WHERE follower_id = $1
      AND following_id = $2
    LIMIT 1
    `,
    [userId, artistId]
  );

  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────
// getWeeklyTracks
// User-scoped — block filter applied on the outer WHERE so blocked
// artists are excluded regardless of which CTE matched them.
//
// source_rank is intentionally returned so the service layer can
// detect "personalized vs. trending" — stripped by sanitizeTracks()
// before it ever reaches the client.
// ─────────────────────────────────────────────────────────────

async function getWeeklyTracks(userId, limit) {
  const { rows } = await db.query(
    `
    WITH top_listened_artists AS (
      SELECT t.user_id AS artist_id,
             COUNT(*)           AS play_count,
             MAX(lh.played_at) AS last_played
      FROM   listening_history lh
      JOIN   tracks t ON t.id = lh.track_id
      WHERE  lh.user_id = $1
        AND  lh.deleted_at IS NULL
      GROUP  BY t.user_id
    ),
    top_listened_genres AS (
      SELECT t.genre_id,
             COUNT(*)           AS play_count,
             MAX(lh.played_at) AS last_played
      FROM   listening_history lh
      JOIN   tracks t ON t.id = lh.track_id
      WHERE  lh.user_id   = $1
        AND  lh.deleted_at IS NULL
        AND  t.genre_id   IS NOT NULL
      GROUP  BY t.genre_id
    ),
    followed_artists AS (
      SELECT f.following_id AS artist_id
      FROM   follows f
      JOIN   users   u ON u.id = f.following_id
      WHERE  f.follower_id = $1
        AND  u.role        = 'artist'
        AND  u.deleted_at  IS NULL
    ),
    favorite_genres AS (
      SELECT ufg.genre_id
      FROM   user_favorite_genres ufg
      WHERE  ufg.user_id = $1
    ),
    liked_genres AS (
      SELECT DISTINCT t.genre_id
      FROM   track_likes tl
      JOIN   tracks t ON t.id = tl.track_id
      WHERE  tl.user_id   = $1
        AND  t.genre_id   IS NOT NULL
    )
    SELECT
      ${TRACK_COLUMNS},
      CASE
        WHEN tla.artist_id IS NOT NULL THEN 1  -- top listened artist
        WHEN fa.artist_id  IS NOT NULL THEN 2  -- followed artist
        WHEN tlg.genre_id  IS NOT NULL THEN 3  -- top listened genre
        WHEN fg.genre_id   IS NOT NULL THEN 4  -- favourite genre
        WHEN lg.genre_id   IS NOT NULL THEN 5  -- liked genre
        ELSE                                6
      END AS source_rank
    FROM   tracks t
    JOIN   users  u ON u.id = t.user_id
    LEFT   JOIN genres               g   ON g.id   = t.genre_id
    LEFT   JOIN top_listened_artists tla ON tla.artist_id = t.user_id
    LEFT   JOIN top_listened_genres  tlg ON tlg.genre_id  = t.genre_id
    LEFT   JOIN followed_artists     fa  ON fa.artist_id  = t.user_id
    LEFT   JOIN favorite_genres      fg  ON fg.genre_id   = t.genre_id
    LEFT   JOIN liked_genres         lg  ON lg.genre_id   = t.genre_id
    WHERE  ${TRACK_FILTERS}
      AND  ${blockFilter('$1')}
    ORDER  BY source_rank       ASC,
              tla.last_played   DESC NULLS LAST,
              t.play_count      DESC,
              t.created_at      DESC
    LIMIT  $2
    `,
    [userId, limit]
  );

  return rows;
}

// ─────────────────────────────────────────────────────────────
// getHomeTrendingByGenre
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getHomeTrendingByGenre(trackLimit, viewerUserId = null) {
  const { rows: genreRows } = await db.query(
    `
    SELECT g.id AS genre_id, g.name AS genre_name
    FROM   genres g
    JOIN   tracks t ON t.genre_id  = g.id
    JOIN   users  u ON u.id        = t.user_id
    WHERE  t.is_public  = true
      AND  t.is_hidden  = false
      AND  t.status     = 'ready'
      AND  t.deleted_at IS NULL
      AND  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$1')}
    GROUP  BY g.id, g.name
    ORDER  BY SUM(t.play_count) DESC, g.name ASC
    LIMIT  10
    `,
    [viewerUserId]
  );

  if (genreRows.length === 0) {
    return { genres: [], initial_tab: null };
  }

  const genres = genreRows.map((r) => ({ genre_id: r.genre_id, genre_name: r.genre_name }));
  const initialGenre = genres[0];
  const initialTracks = await findTracksByGenreId(initialGenre.genre_id, trackLimit, viewerUserId);

  return {
    genres,
    initial_tab: {
      genre_id: initialGenre.genre_id,
      genre_name: initialGenre.genre_name,
      tracks: Array.isArray(initialTracks) ? initialTracks : [],
    },
  };
}

async function getUserLikedGenreTrendingIds(userId) {
  if (!userId) return new Set();

  const { rows } = await db.query(
    `
    SELECT p.genre_id
    FROM playlists p
    JOIN playlist_likes pl
      ON pl.playlist_id = p.id
      AND pl.user_id = $1
    WHERE p.user_id    = $1
      AND p.type::text = 'genre_trending'
      AND p.genre_id   IS NOT NULL
    `,
    [userId]
  );

  return new Set(rows.map((row) => row.genre_id));
}

// ─────────────────────────────────────────────────────────────
// getArtistsToWatch  (home-page snapshot, no pagination)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getArtistsToWatch(limit, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.profile_picture,
      (
        SELECT g.name
        FROM   tracks t2
        LEFT   JOIN genres g ON g.id = t2.genre_id
        WHERE  t2.user_id    = u.id
          AND  t2.is_public  = true
          AND  t2.is_hidden  = false
          AND  t2.status     = 'ready'
          AND  t2.deleted_at IS NULL
        ORDER  BY t2.play_count DESC, t2.created_at DESC
        LIMIT  1
      ) AS top_genre,
      COALESCE(SUM(t.play_count), 0)::integer AS play_velocity,
      COUNT(t.id)::integer                    AS track_count
    FROM   users  u
    LEFT   JOIN tracks t
             ON t.user_id    = u.id
            AND t.is_public  = true
            AND t.is_hidden  = false
            AND t.status     = 'ready'
            AND t.deleted_at IS NULL
    WHERE  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$2')}
    GROUP  BY u.id, u.display_name, u.profile_picture
    ORDER  BY play_velocity DESC, track_count DESC, u.display_name ASC
    LIMIT  $1
    `,
    [limit, viewerUserId]
  );

  return rows.map(mapArtist);
}

// ─────────────────────────────────────────────────────────────
// getArtistsToWatchPaginated  (standalone endpoint with total)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getArtistsToWatchPaginated(limit, offset, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.profile_picture,
      (
        SELECT g.name
        FROM   tracks t2
        LEFT   JOIN genres g ON g.id = t2.genre_id
        WHERE  t2.user_id    = u.id
          AND  t2.is_public  = true
          AND  t2.is_hidden  = false
          AND  t2.status     = 'ready'
          AND  t2.deleted_at IS NULL
        ORDER  BY t2.play_count DESC, t2.created_at DESC
        LIMIT  1
      ) AS top_genre,
      COALESCE(SUM(t.play_count), 0)::integer AS play_velocity,
      COUNT(t.id)::integer                    AS track_count,
      COUNT(*) OVER()::integer                AS total_count
    FROM   users  u
    LEFT   JOIN tracks t
             ON t.user_id    = u.id
            AND t.is_public  = true
            AND t.is_hidden  = false
            AND t.status     = 'ready'
            AND t.deleted_at IS NULL
    WHERE  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$3')}
    GROUP  BY u.id, u.display_name, u.profile_picture
    ORDER  BY play_velocity DESC, track_count DESC, u.display_name ASC
    LIMIT  $1 OFFSET $2
    `,
    [limit, offset, viewerUserId]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { items: rows.map(mapArtist), total };
}

function mapArtist(row) {
  return {
    id: row.id,
    display_name: row.display_name,
    profile_picture: row.profile_picture ?? null,
    top_genre: row.top_genre ?? null,
    play_velocity: Number(row.play_velocity) || 0,
    track_count: Number(row.track_count) || 0,
  };
}

// ─────────────────────────────────────────────────────────────
// getDiscoverWithStations  (home-page snapshot)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getDiscoverWithStations(limit, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.profile_picture,
      COALESCE(COUNT(t.id),       0)::integer AS track_count,
      COALESCE(u.followers_count, 0)::integer AS follower_count
    FROM   users  u
    LEFT   JOIN tracks t
             ON t.user_id    = u.id
            AND t.is_public  = true
            AND t.is_hidden  = false
            AND t.status     = 'ready'
            AND t.deleted_at IS NULL
    WHERE  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$2')}
    GROUP  BY u.id, u.display_name, u.profile_picture, u.followers_count
    ORDER  BY follower_count DESC, track_count DESC, u.display_name ASC
    LIMIT  $1
    `,
    [limit, viewerUserId]
  );

  return rows.map(mapStation);
}

// ─────────────────────────────────────────────────────────────
// getStationsPaginated  (standalone endpoint)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getStationsPaginated(limit, offset, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.profile_picture,
      COALESCE(COUNT(t.id),       0)::integer AS track_count,
      COALESCE(u.followers_count, 0)::integer AS follower_count,
      COUNT(*) OVER()::integer                AS total_count
    FROM   users  u
    LEFT   JOIN tracks t
             ON t.user_id    = u.id
            AND t.is_public  = true
            AND t.is_hidden  = false
            AND t.status     = 'ready'
            AND t.deleted_at IS NULL
    WHERE  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$3')}
    GROUP  BY u.id, u.display_name, u.profile_picture, u.followers_count
    ORDER  BY follower_count DESC, track_count DESC, u.display_name ASC
    LIMIT  $1 OFFSET $2
    `,
    [limit, offset, viewerUserId]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { items: rows.map(mapStation), total };
}

// ─────────────────────────────────────────────────────────────
// getStationByArtistId  (single station lookup)
// Lookup by specific artistId — no viewer userId, block filter N/A.
// ─────────────────────────────────────────────────────────────

async function getStationByArtistId(artistId, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.profile_picture,
      COALESCE(COUNT(t.id),       0)::integer AS track_count,
      COALESCE(u.followers_count, 0)::integer AS follower_count
    FROM   users  u
    LEFT   JOIN tracks t
             ON t.user_id    = u.id
            AND t.is_public  = true
            AND t.is_hidden  = false
            AND t.status     = 'ready'
            AND t.deleted_at IS NULL
    WHERE  u.id         = $1
      AND  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$2')}
    GROUP  BY u.id, u.display_name, u.profile_picture, u.followers_count
    LIMIT  1
    `,
    [artistId, viewerUserId]
  );

  return rows.length > 0 ? mapStation(rows[0]) : null;
}

function mapStation(row) {
  return {
    id: row.id,
    name: `Based on ${row.display_name}`,
    artist_id: row.id,
    artist_name: row.display_name,
    cover_image: row.profile_picture ?? null,
    track_count: Number(row.track_count) || 0,
    follower_count: Number(row.follower_count) || 0,
  };
}

// ─────────────────────────────────────────────────────────────
// getTracksByArtistId  (station track list, paginated)
// Fetches tracks for one specific artist — no viewer userId, N/A.
// ─────────────────────────────────────────────────────────────

async function getTracksByArtistId(artistId, limit, offset, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      ${TRACK_COLUMNS},
      COUNT(*) OVER()::integer AS total_count
    FROM   tracks t
    JOIN   users  u ON u.id = t.user_id
    LEFT   JOIN genres g ON g.id = t.genre_id
    WHERE  t.user_id    = $1
      AND  ${TRACK_FILTERS}
      AND  ${optionalBlockFilter('$4')}
    ORDER  BY t.play_count DESC, t.created_at DESC
    LIMIT  $2 OFFSET $3
    `,
    [artistId, limit, offset, viewerUserId]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { items: rows, total };
}

// ─────────────────────────────────────────────────────────────
// getPersonalizedMixGenreCandidates
// User-scoped — selects genres, not artist rows.
// Block filter is not applied here: we are collecting genre IDs
// the user has engaged with, not surfacing artist profiles.
// ─────────────────────────────────────────────────────────────

async function getPersonalizedMixGenreCandidates(userId, limit) {
  const { rows } = await db.query(
    `
    WITH top_listened_genres AS (
      SELECT t.genre_id,
             COUNT(*)::integer   AS play_count,
             MAX(lh.played_at)  AS last_played
      FROM   listening_history lh
      JOIN   tracks t ON t.id = lh.track_id
      WHERE  lh.user_id   = $1
        AND  lh.deleted_at IS NULL
        AND  t.genre_id   IS NOT NULL
      GROUP  BY t.genre_id
    ),
    favorite_genres AS (
      SELECT ufg.genre_id,
             NULL::integer     AS play_count,
             NULL::timestamptz AS last_played
      FROM   user_favorite_genres ufg
      WHERE  ufg.user_id = $1
    ),
    liked_genres AS (
      SELECT t.genre_id,
             COUNT(*)::integer  AS play_count,
             MAX(tl.created_at) AS last_played
      FROM   track_likes tl
      JOIN   tracks t ON t.id = tl.track_id
      WHERE  tl.user_id   = $1
        AND  t.genre_id   IS NOT NULL
        AND  t.is_public  = true
        AND  t.is_hidden  = false
        AND  t.status     = 'ready'
        AND  t.deleted_at IS NULL
      GROUP  BY t.genre_id
    ),
    candidate_genres AS (
      SELECT genre_id, 1 AS source_rank, play_count, last_played FROM top_listened_genres
      UNION ALL
      SELECT genre_id, 2 AS source_rank, play_count, last_played FROM favorite_genres
      UNION ALL
      SELECT genre_id, 3 AS source_rank, play_count, last_played FROM liked_genres
    ),
    deduped AS (
      SELECT cg.genre_id,
             MIN(cg.source_rank)::integer AS source_rank,
             MAX(cg.last_played)          AS last_played,
             MAX(cg.play_count)::integer  AS signal_count
      FROM   candidate_genres cg
      GROUP  BY cg.genre_id
    )
    SELECT d.genre_id,
           g.name AS genre_name,
           d.source_rank,
           d.last_played,
           d.signal_count
    FROM   deduped d
    JOIN   genres  g ON g.id = d.genre_id
    ORDER  BY d.source_rank  ASC,
              d.last_played  DESC NULLS LAST,
              d.signal_count DESC NULLS LAST,
              g.name         ASC
    LIMIT  $2
    `,
    [userId, limit]
  );

  return rows;
}

// ─────────────────────────────────────────────────────────────
// getTrendingMixGenreCandidates  (guest fallback)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getTrendingMixGenreCandidates(limit, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT g.id AS genre_id, g.name AS genre_name
    FROM   genres g
    JOIN   tracks t ON t.genre_id  = g.id
    JOIN   users  u ON u.id        = t.user_id
    WHERE  t.is_public  = true
      AND  t.is_hidden  = false
      AND  t.status     = 'ready'
      AND  t.deleted_at IS NULL
      AND  ${BASE_ARTIST_FILTER}
      AND  ${optionalBlockFilter('$2')}
    GROUP  BY g.id, g.name
    ORDER  BY SUM(t.play_count) DESC, g.name ASC
    LIMIT  $1
    `,
    [limit, viewerUserId]
  );

  return rows;
}

// ─────────────────────────────────────────────────────────────
// getTopPreviewTracksByGenreIds
// Global query — genreIds only, no userId, block filter N/A.
// ─────────────────────────────────────────────────────────────

async function getTopPreviewTracksByGenreIds(genreIds, viewerUserId = null) {
  if (!Array.isArray(genreIds) || genreIds.length === 0) return [];

  const { rows } = await db.query(
    `
    WITH selected_genres AS (
      SELECT genre_id,
             ordinality::integer AS genre_order
      FROM   unnest($1::uuid[]) WITH ORDINALITY AS g(genre_id, ordinality)
    ),
    ranked_tracks AS (
      SELECT
        sg.genre_id,
        sg.genre_order,
        ${TRACK_COLUMNS},
        ROW_NUMBER() OVER (
          PARTITION BY sg.genre_id
          ORDER BY t.play_count DESC, t.created_at DESC
        ) AS track_rank
      FROM   selected_genres sg
      JOIN   tracks t ON t.genre_id = sg.genre_id
      JOIN   users  u ON u.id       = t.user_id
      LEFT   JOIN genres g ON g.id  = t.genre_id
      WHERE  ${TRACK_FILTERS}
        AND  ${optionalBlockFilter('$2')}
    )
    SELECT genre_id, genre_order,
           id, title, cover_image, duration, genre_name,
           play_count, like_count, repost_count,
           user_id, artist_name, stream_url, created_at
    FROM   ranked_tracks
    WHERE  track_rank = 1
    ORDER  BY genre_order ASC
    `,
    [genreIds, viewerUserId]
  );

  return rows;
}

// ─────────────────────────────────────────────────────────────
// getFirstPreviewTracksByAlbumIds
// User-scoped query — returns the first track for each album
// ordered by album_tracks.position ASC NULLS LAST, then created_at ASC.
// ─────────────────────────────────────────────────────────────

async function getFirstPreviewTracksByAlbumIds(albumIds, viewerUserId = null) {
  if (!Array.isArray(albumIds) || albumIds.length === 0) return [];

  const { rows } = await db.query(
    `
    WITH selected_albums AS (
      SELECT album_id,
             ordinality::integer AS album_order
      FROM   unnest($1::uuid[]) WITH ORDINALITY AS a(album_id, ordinality)
    ),
    ranked_tracks AS (
      SELECT
        sa.album_id,
        sa.album_order,
        ${TRACK_COLUMNS},
        ROW_NUMBER() OVER (
          PARTITION BY sa.album_id
          ORDER BY at.position ASC NULLS LAST, t.created_at ASC
        ) AS track_rank
      FROM   selected_albums sa
      JOIN   album_tracks at ON at.album_id = sa.album_id
      JOIN   tracks t ON t.id = at.track_id
      JOIN   users  u ON u.id = t.user_id
      LEFT   JOIN genres g ON g.id = t.genre_id
      WHERE  ${TRACK_FILTERS}
        AND  ${optionalBlockFilter('$2')}
    )
    SELECT
      album_id,
      album_order,
      id,
      title,
      cover_image,
      preview_url,
      duration,
      genre_name,
      play_count,
      like_count,
      repost_count,
      user_id,
      artist_name,
      stream_url,
      created_at
    FROM   ranked_tracks
    WHERE  track_rank = 1
    ORDER  BY album_order ASC
    `,
    [albumIds, viewerUserId]
  );

  return rows;
}

// ─────────────────────────────────────────────────────────────
// getMoreOfWhatYouLike
// User-scoped — block filter applied in candidate_tracks CTE
// so blocked artists are excluded before ranking and dedup.
// ─────────────────────────────────────────────────────────────

async function getMoreOfWhatYouLike(userId, limit, offset) {
  const { rows } = await db.query(
    `
    WITH recent_track_plays AS (
      SELECT
        lh.track_id,
        MAX(lh.played_at) AS last_played,
        SUM(CASE WHEN lh.played_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::numeric AS recent_play_score
      FROM listening_history lh
      WHERE lh.user_id = $1
        AND lh.deleted_at IS NULL
      GROUP BY lh.track_id
    ),
    top_listened_artists AS (
      SELECT t.user_id AS artist_id,
             COUNT(*)           AS play_count,
             MAX(lh.played_at) AS last_played
      FROM   listening_history lh
      JOIN   tracks t ON t.id = lh.track_id
      WHERE  lh.user_id = $1
        AND  lh.deleted_at IS NULL
      GROUP  BY t.user_id
    ),
    top_listened_genres AS (
      SELECT t.genre_id,
             COUNT(*)           AS play_count,
             MAX(lh.played_at) AS last_played
      FROM   listening_history lh
      JOIN   tracks t ON t.id = lh.track_id
      WHERE  lh.user_id   = $1
        AND  lh.deleted_at IS NULL
        AND  t.genre_id   IS NOT NULL
      GROUP  BY t.genre_id
    ),
    followed_artists AS (
      SELECT u.id
      FROM   follows f
      JOIN   users   u ON u.id = f.following_id
      WHERE  f.follower_id = $1
        AND  u.role        = 'artist'
        AND  u.deleted_at  IS NULL
    ),
    favorite_genres AS (
      SELECT genre_id
      FROM   user_favorite_genres
      WHERE  user_id = $1
    ),
    liked_genres AS (
      SELECT DISTINCT t.genre_id
      FROM   track_likes tl
      JOIN   tracks t ON t.id = tl.track_id
      WHERE  tl.user_id   = $1
        AND  t.genre_id   IS NOT NULL
        AND  t.is_public  = true
        AND  t.is_hidden  = false
        AND  t.status     = 'ready'
        AND  t.deleted_at IS NULL
    ),
    candidate_tracks AS (
      SELECT
        ${TRACK_COLUMNS},
        tla.last_played AS listened_artist_last_played,
        COALESCE(rtp.recent_play_score, 0) AS recent_play_score,
        (
          COALESCE(t.play_count, 0)::numeric * 0.4 +
          COALESCE(t.like_count, 0)::numeric * 0.3 +
          COALESCE(rtp.recent_play_score, 0)::numeric * 0.3
        ) AS weighted_score,
        CASE
          WHEN tla.artist_id IS NOT NULL THEN 1
          WHEN fa.id         IS NOT NULL THEN 2
          WHEN tlg.genre_id  IS NOT NULL THEN 3
          WHEN fg.genre_id   IS NOT NULL THEN 4
          WHEN lg.genre_id   IS NOT NULL THEN 5
          ELSE                                6
        END AS source_rank
      FROM   tracks t
      JOIN   users  u ON u.id = t.user_id
      LEFT   JOIN genres               g   ON g.id   = t.genre_id
      LEFT   JOIN top_listened_artists tla ON tla.artist_id = t.user_id
      LEFT   JOIN top_listened_genres  tlg ON tlg.genre_id  = t.genre_id
      LEFT   JOIN followed_artists     fa  ON fa.id         = t.user_id
      LEFT   JOIN favorite_genres      fg  ON fg.genre_id   = t.genre_id
      LEFT   JOIN liked_genres         lg  ON lg.genre_id   = t.genre_id
      LEFT   JOIN recent_track_plays   rtp ON rtp.track_id  = t.id
      WHERE  ${TRACK_FILTERS}
        AND  ${blockFilter('$1')}
        AND (
          tla.artist_id IS NOT NULL
          OR fa.id IS NOT NULL
          OR tlg.genre_id IS NOT NULL
          OR fg.genre_id IS NOT NULL
          OR lg.genre_id IS NOT NULL
          OR rtp.track_id IS NOT NULL
        )
    ),
    -- Deduplicate tracks that match multiple signals — keep best rank
    deduped AS (
      SELECT DISTINCT ON (id)
        id, title, cover_image, duration, genre_name,
        user_id, play_count, like_count, repost_count,
        artist_name, stream_url, created_at,
        listened_artist_last_played, recent_play_score, weighted_score, source_rank
      FROM   candidate_tracks
      ORDER  BY id, source_rank ASC
    ),
    ranked AS (
      SELECT *,
             COUNT(*) OVER()::integer AS total_count
      FROM   deduped
      ORDER  BY weighted_score              DESC,
                source_rank                 ASC,
                listened_artist_last_played DESC NULLS LAST,
                created_at                  DESC
      LIMIT  $2 OFFSET $3
    )
    SELECT id, title, cover_image, duration, genre_name,
           user_id, play_count, like_count, repost_count,
           artist_name, stream_url, created_at,
           source_rank, total_count
    FROM   ranked
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const primarySourceRank = rows.length > 0 ? Number(rows[0].source_rank) : 6;

  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    cover_image: row.cover_image ?? null,
    duration: row.duration,
    genre_name: row.genre_name ?? null,
    user_id: row.user_id,
    play_count: row.play_count,
    like_count: row.like_count,
    repost_count: row.repost_count,
    artist_name: row.artist_name ?? null,
    stream_url: row.stream_url ?? null,
    created_at: row.created_at,
  }));

  return {
    items,
    total,
    source: primarySourceRank <= 5 ? 'personalized' : 'trending_fallback',
  };
}

// ─────────────────────────────────────────────────────────────
// getAlbumsFromFollowedArtists
// User-scoped — block filter applied so albums from blocked
// artists (or artists who blocked the user) are excluded.
// ─────────────────────────────────────────────────────────────

async function getAlbumsFromFollowedArtists(userId, limit, offset) {
  const { rows } = await db.query(
    `
    SELECT
      p.id,
      p.name        AS name,
      p.cover_image,
      p.user_id     AS owner_id,
      u.display_name AS owner_name,
      p.track_count,
      p.like_count,
      p.created_at,
      COUNT(*) OVER()::integer AS total_count
    FROM   follows f
    JOIN   users  u ON u.id = f.following_id
    JOIN   playlists p ON p.user_id = u.id
    WHERE  f.follower_id = $1
      AND  u.role        = 'artist'
      AND  u.deleted_at  IS NULL
      AND  p.deleted_at  IS NULL
      AND  p.subtype = 'album'
      AND  ${blockFilter('$1')}
    ORDER  BY p.like_count DESC, p.created_at DESC
    LIMIT  $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(mapAlbum);

  return { items, total };
}

// ─────────────────────────────────────────────────────────────
// getTopAlbums  (global fallback)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function getTopAlbums(limit, offset, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      p.id,
      p.name        AS name,
      p.cover_image,
      p.user_id     AS owner_id,
      u.display_name AS owner_name,
      p.track_count,
      p.like_count,
      p.created_at,
      COUNT(*) OVER()::integer AS total_count
    FROM   playlists p
    JOIN   users  u ON u.id = p.user_id
    WHERE  ${BASE_ARTIST_FILTER}
      AND  p.deleted_at IS NULL
      AND  p.subtype = 'album'
      AND  ${optionalBlockFilter('$3', 'p.user_id')}
    ORDER  BY p.like_count DESC, p.created_at DESC
    LIMIT  $1 OFFSET $2
    `,
    [limit, offset, viewerUserId]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(mapAlbum);

  return { items, total };
}

// ─────────────────────────────────────────────────────────────
// getAllAlbums (ultimate fallback)
// Returns any albums ordered by creation date (newest first).
// Used when both followed artist albums and top albums are empty.
// ─────────────────────────────────────────────────────────────
async function getAllAlbums(limit, offset, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT
      p.id,
      p.name        AS name,
      p.cover_image,
      p.user_id     AS owner_id,
      u.display_name AS owner_name,
      p.track_count,
      p.like_count,
      p.created_at,
      COUNT(*) OVER()::integer AS total_count
    FROM   playlists p
    JOIN   users  u ON u.id = p.user_id
    WHERE  u.deleted_at IS NULL
      AND  p.deleted_at IS NULL
      AND  p.subtype = 'album'
      AND  ${optionalBlockFilter('$3', 'p.user_id')}
    ORDER  BY p.created_at DESC
    LIMIT  $1 OFFSET $2
    `,
    [limit, offset, viewerUserId]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(mapAlbum);

  return { items, total };
}

function mapAlbum(row) {
  return {
    id: row.id,
    name: row.name,
    cover_image: row.cover_image ?? null,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    track_count: row.track_count,
    like_count: row.like_count,
    created_at: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// findGenreById
// ─────────────────────────────────────────────────────────────

async function findGenreById(genreId) {
  const { rows } = await db.query(`SELECT id, name FROM genres WHERE id = $1 LIMIT 1`, [genreId]);

  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// findTracksByGenreId  (internal use, no total, no userId)
// Global query — block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function findTracksByGenreId(genreId, limit, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT ${TRACK_COLUMNS}
    FROM   tracks t
    JOIN   users  u ON u.id = t.user_id
    LEFT   JOIN genres g ON g.id = t.genre_id
    WHERE  t.genre_id   = $1
      AND  ${TRACK_FILTERS}
      AND  ${optionalBlockFilter('$3')}
    ORDER  BY t.play_count DESC, t.created_at DESC
    LIMIT  $2
    `,
    [genreId, limit, viewerUserId]
  );

  return rows;
}

async function findTracksByGenreIds(genreIds, limit, viewerUserId = null) {
  if (!Array.isArray(genreIds) || genreIds.length === 0) return [];

  const { rows } = await db.query(
    `
    SELECT ${TRACK_COLUMNS}
    FROM   tracks t
    JOIN   users  u ON u.id = t.user_id
    LEFT   JOIN genres g ON g.id = t.genre_id
    WHERE  t.genre_id = ANY($1::uuid[])
      AND  ${TRACK_FILTERS}
      AND  ${optionalBlockFilter('$3')}
    ORDER  BY t.play_count DESC, t.created_at DESC
    LIMIT  $2
    `,
    [genreIds, limit, viewerUserId]
  );

  return rows;
}

// ─────────────────────────────────────────────────────────────
// findTracksByGenreIdPaginated  (lazy-load tab endpoint)
// Global query — no userId, block filter not applicable.
// ─────────────────────────────────────────────────────────────

async function findTracksByGenreIdPaginated(genreId, limit, offset, viewerUserId = null) {
  const { rows } = await db.query(
    `
    SELECT *, COUNT(*) OVER()::integer AS total_count
    FROM (
      SELECT
        ${TRACK_COLUMNS},
        COUNT(lh.id) AS recent_plays
      FROM   tracks t
      JOIN   users  u ON u.id = t.user_id
      LEFT   JOIN genres g ON g.id = t.genre_id
      LEFT   JOIN listening_history lh
              ON lh.track_id = t.id
             AND lh.deleted_at IS NULL
             AND lh.played_at >= now() - INTERVAL '7 days'
      WHERE  t.genre_id   = $1
        AND  ${TRACK_FILTERS}
        AND  ${optionalBlockFilter('$4')}
      GROUP BY t.id, u.id, g.id
      ORDER  BY recent_plays DESC, t.play_count DESC, t.created_at DESC
      LIMIT  $2 OFFSET $3
    ) sub
    `,
    [genreId, limit, offset, viewerUserId]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { rows, total };
}

async function getActivityFeed(userId, limit = 20, cursor = null) {
  let decodedCursor = null;
  if (cursor) {
    try {
      const cursorString = Buffer.from(cursor, 'base64').toString();
      decodedCursor = new Date(cursorString); // Convert to timestamp
    } catch (err) {
      decodedCursor = null;
    }
  }

  const { rows } = await db.query(
    `
    WITH followings AS (
      SELECT following_id FROM follows WHERE follower_id = $1
    ),
    activity AS (
      -- Track posts
      SELECT 'track_post' AS type, t.id::text AS track_id, NULL::text AS playlist_id,
             t.user_id AS actor_id, t.created_at AS occurred_at, t.id::text AS sort_id
      FROM tracks t
      WHERE t.user_id IN (SELECT following_id FROM followings) OR t.user_id = $1
        AND t.is_public = true AND t.status = 'ready' AND t.deleted_at IS NULL

      UNION ALL
      -- Track reposts
      SELECT 'track_repost', tr.track_id::text, NULL::text, tr.user_id, tr.created_at, tr.id::text
      FROM track_reposts tr
      WHERE tr.user_id IN (SELECT following_id FROM followings) OR tr.user_id = $1

      UNION ALL
      -- Playlist posts
      SELECT 'playlist_post', NULL::text, p.id::text, p.user_id, p.created_at, p.id::text
      FROM playlists p
      WHERE p.user_id IN (SELECT following_id FROM followings) OR p.user_id = $1
        AND p.is_public = true AND p.deleted_at IS NULL AND p.type = 'regular'

      UNION ALL
      -- Playlist reposts
      SELECT 'playlist_repost', NULL::text, pr.playlist_id::text, pr.user_id, pr.created_at, pr.id::text
      FROM playlist_reposts pr
      WHERE pr.user_id IN (SELECT following_id FROM followings) OR pr.user_id = $1
    )
    SELECT a.type, a.occurred_at, a.actor_id,
           a.track_id, a.playlist_id, a.sort_id
    FROM activity a
    WHERE ($3::timestamptz IS NULL OR a.occurred_at < $3::timestamptz)
    ORDER BY a.occurred_at DESC, a.sort_id DESC
    LIMIT $2 + 1
    `,
    [userId, limit, decodedCursor]
  );

  // Now map rows into JS objects
  const items = [];
  for (const row of rows) {
    // load actor (the user who performed the action)
    const actorRes = await db.query(
      `SELECT id, username, display_name, profile_picture, followers_count, is_verified
       FROM users WHERE id = $1 LIMIT 1`,
      [row.actor_id]
    );
    const actor = actorRes.rows[0] || null;

    if (row.type === 'track_post' || row.type === 'track_repost') {
      // Fetch track details (including artist summary)
      const trackRes = await db.query(
        `SELECT t.id, t.title, t.duration, t.play_count, t.like_count,
                t.cover_image, t.audio_url, t.preview_url, t.stream_url,
                u.id AS artist_id, u.username AS artist_username, u.display_name AS artist_display_name,
                u.profile_picture AS artist_profile_picture, u.followers_count AS artist_followers,
                u.is_verified AS artist_is_verified
         FROM tracks t
         JOIN users u ON u.id = t.user_id
         WHERE t.id = $1 AND t.deleted_at IS NULL LIMIT 1`,
        [row.track_id]
      );
      const t = trackRes.rows[0] || null;

      const track = t
        ? {
            id: t.id,
            title: t.title,
            duration: t.duration,
            play_count: t.play_count,
            like_count: t.like_count,
            coverUrl: t.cover_image ?? null,
            audioUrl: t.audio_url ?? null,
            preview_url: t.preview_url ?? t.stream_url ?? t.audio_url ?? null,
            stream_url: t.stream_url ?? t.audio_url ?? null,
            user: {
              id: t.artist_id,
              username: t.artist_username,
              displayName: t.artist_display_name ?? null,
              avatar: t.artist_profile_picture ?? null,
              profile_picture: t.artist_profile_picture ?? null,
              followers: t.artist_followers ?? 0,
              isVerified: !!t.artist_is_verified,
            },
          }
        : null;

      items.push({
        id: String(row.sort_id),
        type: row.type === 'track_repost' ? 'repost' : 'post',
        content_type: 'track',
        created_at: row.occurred_at ? row.occurred_at.toISOString() : null,
        user: actor
          ? {
              id: actor.id,
              username: actor.username,
              displayName: actor.display_name ?? null,
              avatar: actor.profile_picture ?? null,
              profile_picture: actor.profile_picture ?? null,
              followers: actor.followers_count ?? 0,
              isVerified: !!actor.is_verified,
            }
          : null,
        track,
      });
    } else {
      // Playlist case
      const playlistRes = await db.query(
        `SELECT p.id, p.name, p.description, p.cover_image, p.track_count,
                p.like_count, p.repost_count, p.created_at, u.id AS creator_id, u.username AS creator_username,
                u.display_name AS creator_display_name, u.profile_picture AS creator_profile_picture,
                u.followers_count AS creator_followers, u.is_verified AS creator_is_verified
         FROM playlists p
         JOIN users u ON u.id = p.user_id
         WHERE p.id = $1 AND p.deleted_at IS NULL LIMIT 1`,
        [row.playlist_id]
      );
      const p = playlistRes.rows[0] || null;

      // Get first + top 5 tracks (include created_at for time-since previews)
      const tracksRes = await db.query(
        `SELECT t.id, t.title, t.duration, t.play_count, t.like_count,
                t.cover_image, t.audio_url, t.preview_url, t.stream_url, t.created_at,
                u.id AS artist_id, u.username, u.display_name, u.profile_picture
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id AND t.deleted_at IS NULL
         JOIN users u ON u.id = t.user_id
         WHERE pt.playlist_id = $1
         ORDER BY pt.position ASC
         LIMIT 5`,
        [row.playlist_id]
      );

      const firstTrackRow = tracksRes.rows[0] || null;
      const first_track = firstTrackRow
        ? {
            id: firstTrackRow.id,
            title: firstTrackRow.title,
            duration: firstTrackRow.duration,
            play_count: firstTrackRow.play_count,
            like_count: firstTrackRow.like_count,
            coverUrl: firstTrackRow.cover_image ?? null,
            audioUrl: firstTrackRow.audio_url ?? null,
            preview_url:
              firstTrackRow.preview_url ??
              firstTrackRow.stream_url ??
              firstTrackRow.audio_url ??
              null,
            stream_url: firstTrackRow.stream_url ?? firstTrackRow.audio_url ?? null,
            user: {
              id: firstTrackRow.artist_id,
              username: firstTrackRow.username,
              displayName: firstTrackRow.display_name ?? null,
              avatar: firstTrackRow.profile_picture ?? null,
              profile_picture: firstTrackRow.profile_picture ?? null,
            },
          }
        : null;

      // small helper to render a human-friendly "time since" string
      const formatTimeSince = (dt) => {
        if (!dt) return null;
        const then = new Date(dt);
        const ms = Date.now() - then.getTime();
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds} seconds ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minutes ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days} days ago`;
        const weeks = Math.floor(days / 7);
        return `${weeks} weeks ago`;
      };

      const top_tracks = tracksRes.rows.map((tr) => ({
        id: tr.id,
        title: tr.title,
        duration: tr.duration,
        play_count: tr.play_count,
        like_count: tr.like_count,
        coverUrl: tr.cover_image ?? null,
        audioUrl: tr.audio_url ?? null,
        preview_url: tr.preview_url ?? tr.stream_url ?? tr.audio_url ?? null,
        stream_url: tr.stream_url ?? tr.audio_url ?? null,
        user: {
          id: tr.artist_id,
          username: tr.username,
          displayName: tr.display_name ?? null,
          avatar: tr.profile_picture ?? null,
          profile_picture: tr.profile_picture ?? null,
        },
      }));

      // produce lightweight previews for the rest of the tracks (image + timeSince)
      const restPreviewTracks = tracksRes.rows.slice(1).map((tr) => ({
        id: tr.id,
        title: tr.title,
        duration: tr.duration,
        coverUrl: tr.cover_image ?? null,
        timeSince: formatTimeSince(tr.created_at),
      }));

      const playlist = p
        ? {
            id: p.id,
            title: p.name,
            description: p.description ?? null,
            coverUrl: p.cover_image ?? null,
            postedAt: p.created_at ? p.created_at.toISOString() : null,
            likeCount: p.like_count ?? 0,
            repostCount: p.repost_count ?? 0,
            trackCount: p.track_count ?? 0,
            playlistSlug: p.id,
            creatorName: p.creator_display_name ?? null,
            creatorUsername: p.creator_username,
            tracks: top_tracks,
            trackPreviews: restPreviewTracks,
          }
        : null;

      items.push({
        id: String(row.sort_id),
        type: row.type === 'playlist_repost' ? 'repost' : 'post',
        content_type: 'playlist',
        created_at: row.occurred_at ? row.occurred_at.toISOString() : null,
        user: actor
          ? {
              id: actor.id,
              username: actor.username,
              displayName: actor.display_name ?? null,
              avatar: actor.profile_picture ?? null,
              profile_picture: actor.profile_picture ?? null,
              followers: actor.followers_count ?? 0,
              isVerified: !!actor.is_verified,
            }
          : null,
        playlist,
        track: first_track,
      });
    }
  }
  const hasMore = items.length > limit;
  let nextCursor = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    const lastTimestamp = lastItem.created_at; // ISO string
    nextCursor = Buffer.from(lastTimestamp).toString('base64');
  }

  return { items: items.slice(0, limit), hasMore, nextCursor };
}

async function getDiscoveryFeed(userId, limit = 20, cursor = null) {
  const offset = cursor ? parseInt(Buffer.from(cursor, 'base64').toString(), 10) : 0;

  const { rows } = await db.query(
    `
    WITH

    -- tracks from genres the user likes
    liked_by_you AS (
      SELECT DISTINCT ON (t.id)
        t.id AS track_id,
        'liked_by_you'        AS reason_type,
        tl_seed.track_id      AS source_id,
        tl_seed.created_at    AS signal_strength,
        t_liked.title         AS source_name
      FROM track_likes tl_seed
      JOIN tracks t
        ON  t.genre_id = (SELECT genre_id FROM tracks WHERE id = tl_seed.track_id)
        AND t.id <> tl_seed.track_id
        AND t.is_public = true
        AND t.status    = 'ready'
        AND t.deleted_at IS NULL
      JOIN tracks t_liked ON t_liked.id = tl_seed.track_id
      WHERE tl_seed.user_id = $1
        AND t.id NOT IN (SELECT track_id FROM track_likes WHERE user_id = $1)
      ORDER BY t.id, tl_seed.created_at DESC
    ),

    -- tracks from artists the user follows
    followed_artist AS (
      SELECT DISTINCT ON (t.id)
        t.id              AS track_id,
        'followed_artist' AS reason_type,
        f.following_id    AS source_id,
        f.created_at      AS signal_strength,
        u.username        AS source_name
      FROM follows f
      JOIN tracks t
        ON  t.user_id    = f.following_id
        AND t.is_public  = true
        AND t.status     = 'ready'
        AND t.deleted_at IS NULL
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $1
      ORDER BY t.id, f.created_at DESC
    ),

    -- tracks similar to what the user has played
    played_by_you AS (
      SELECT DISTINCT ON (t.id)
        t.id AS track_id,
        'played_by_you'   AS reason_type,
        lh.track_id       AS source_id,
        lh.played_at      AS signal_strength,
        t_played.title    AS source_name 
      FROM listening_history lh
      JOIN tracks t
        ON  t.genre_id = (SELECT genre_id FROM tracks WHERE id = lh.track_id)
        AND t.id <> lh.track_id
        AND t.is_public = true
        AND t.status    = 'ready'
        AND t.deleted_at IS NULL
      JOIN tracks t_played ON t_played.id = lh.track_id
      WHERE lh.user_id = $1
        AND lh.deleted_at IS NULL
        AND t.id NOT IN (
          SELECT track_id
          FROM listening_history
          WHERE user_id = $1
            AND deleted_at IS NULL
        )
      ORDER BY t.id, lh.played_at DESC
    ),

    -- new releases from followed artists (last 30 days)
    new_release AS (
      SELECT DISTINCT ON (t.id)
        t.id           AS track_id,
        'new_release'  AS reason_type,
        t.user_id      AS source_id,
        t.created_at   AS signal_strength,
        u.username     AS source_name 
      FROM follows f
      JOIN tracks t
        ON  t.user_id    = f.following_id
        AND t.is_public  = true
        AND t.status     = 'ready'
        AND t.deleted_at IS NULL
        AND t.created_at >= now() - interval '30 days'
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $1
      ORDER BY t.id, t.created_at DESC
    ),

    -- popular recent releases fallback (recent tracks with higher play counts)
    popular_release AS (
      SELECT DISTINCT ON (t.id)
        t.id           AS track_id,
        'new_release'  AS reason_type,
        t.user_id      AS source_id,
        t.created_at   AS signal_strength,
        u.username     AS source_name
      FROM tracks t
      JOIN users u ON u.id = t.user_id
      WHERE t.is_public = true
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND t.created_at >= now() - interval '30 days'
        AND t.play_count >= 5000
      ORDER BY t.id, t.created_at DESC
    ),

    -- merge all reasons, pick one reason per track
    merged AS (
      SELECT * FROM liked_by_you
      UNION ALL
      SELECT * FROM followed_artist
      UNION ALL
      SELECT * FROM played_by_you
      UNION ALL
      SELECT * FROM new_release
      UNION ALL
      SELECT * FROM popular_release
    ),
    deduplicated AS (
      SELECT DISTINCT ON (track_id)
        track_id, reason_type, source_id, signal_strength, source_name
      FROM merged
      ORDER BY track_id, signal_strength DESC
    )

    SELECT
      d.track_id,
      d.reason_type,
      d.source_id,
      d.signal_strength,
      d.source_name,
      t.title,
      t.duration,
      t.play_count,
      t.like_count,
      t.cover_image,
      t.preview_url,
      t.audio_url,
      t.stream_url,
      t.created_at,
      u.id   AS artist_id,
      u.username AS artist_username,
      u.profile_picture AS artist_profile_picture
    FROM deduplicated d
    JOIN tracks t ON t.id = d.track_id
    JOIN users  u ON u.id = t.user_id
    ORDER BY d.signal_strength DESC
    LIMIT  $2
    OFFSET $3
    `,
    [userId, limit, offset]
  );

  const hasMore = rows.length === limit;
  const nextOffset = offset + rows.length;
  const nextCursor = hasMore ? Buffer.from(String(nextOffset)).toString('base64') : null;

  return { items: rows, hasMore, nextCursor };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

module.exports = {
  getDailyTracks,
  isFollowingArtist,
  getWeeklyTracks,
  getHomeTrendingByGenre,
  getUserLikedGenreTrendingIds,
  getArtistsToWatch,
  getArtistsToWatchPaginated,
  getDiscoverWithStations,
  getStationsPaginated,
  getStationByArtistId,
  getTracksByArtistId,
  getPersonalizedMixGenreCandidates,
  getTrendingMixGenreCandidates,
  getTopPreviewTracksByGenreIds,
  getFirstPreviewTracksByAlbumIds,
  getMoreOfWhatYouLike,
  getAlbumsFromFollowedArtists,
  getTopAlbums,
  getAllAlbums,
  findGenreById,
  findTracksByGenreId,
  findTracksByGenreIds,
  findTracksByGenreIdPaginated,
  getActivityFeed,
  getDiscoveryFeed,
};
