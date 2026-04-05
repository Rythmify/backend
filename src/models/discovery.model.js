// ============================================================
// models/discovery.model.js — PostgreSQL queries for Discovery Module
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');


const DISCOVERY_TRACK_SELECT = `
  t.id,
  t.title,
  t.cover_image,
  t.duration,
  t.play_count,
  t.like_count,
  t.user_id,
  t.stream_url,
  t.created_at,
  g.name  AS genre_name,
  u.display_name AS artist_name
`;


// Find the genre and owner of the reference track (for filtering related tracks)
exports.findTrackMeta = async (trackId) => {
  const { rows } = await db.query(
    `SELECT t.id, t.title, t.cover_image, t.duration, t.play_count, t.like_count,
            t.user_id, t.stream_url, t.created_at, t.genre_id,
            g.name  AS genre_name,
            u.display_name AS artist_name
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.id          = $1
       AND  t.is_public   = true
       AND  t.is_hidden   = false
       AND  t.status      = 'ready'
       AND  t.deleted_at  IS NULL`,
    [trackId]
  );
  return rows[0] || null;
};

// half the tracks from same artist, half from same genre (excluding same artist)
exports.findRelatedTracks = async ({ trackId, userId, genreId, limit, offset }) => {
  const halfLimit = Math.floor(limit / 2);

  // same-artist tracks (excluding the reference track itself)
  const sameArtist = await db.query(
    `SELECT ${DISCOVERY_TRACK_SELECT}
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.user_id    = $1
       AND  t.id        <> $2
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL
     ORDER BY t.play_count DESC, t.created_at DESC
     LIMIT  $3`,
    [userId, trackId, halfLimit]
  );

  // same-genre tracks by OTHER artists (excluding reference track)
  const sameGenre = genreId
    ? await db.query(
        `SELECT ${DISCOVERY_TRACK_SELECT}
         FROM   tracks t
         LEFT JOIN genres g ON g.id = t.genre_id
         LEFT JOIN users  u ON u.id = t.user_id
         WHERE  t.genre_id   = $1
           AND  t.user_id   <> $2
           AND  t.id        <> $3
           AND  t.is_public  = true
           AND  t.is_hidden  = false
           AND  t.status     = 'ready'
           AND  t.deleted_at IS NULL
         ORDER BY t.play_count DESC, t.created_at DESC
         LIMIT  $4
         OFFSET $5`,
        [genreId, userId, trackId, limit - sameArtist.rows.length, offset]
      )
    : { rows: [] };

  const combined = [...sameArtist.rows, ...sameGenre.rows];

  // total count for meta (approximate — combined without deduplication)
  const totalQuery = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM tracks
        WHERE user_id = $1 AND id <> $2
          AND is_public = true AND is_hidden = false
          AND status = 'ready' AND deleted_at IS NULL) +
       (SELECT COUNT(*) FROM tracks
        WHERE genre_id = $3 AND user_id <> $1 AND id <> $2
          AND is_public = true AND is_hidden = false
          AND status = 'ready' AND deleted_at IS NULL) AS total`,
    [userId, trackId, genreId]
  );

  return {
    tracks: combined,
    total: parseInt(totalQuery.rows[0]?.total || 0, 10),
  };
};

// for GET /home/hot-for-you
// Get user's most-listened genre in the last 30 days
exports.findUserTopGenre = async (userId) => {
  const { rows } = await db.query(
    `SELECT t.genre_id, COUNT(*) AS play_count
     FROM   listening_history lh
     JOIN   tracks t ON t.id = lh.track_id
     WHERE  lh.user_id   = $1
       AND  lh.played_at >= now() - INTERVAL '30 days'
       AND  t.genre_id   IS NOT NULL
     GROUP BY t.genre_id
     ORDER BY play_count DESC
     LIMIT 3`,
    [userId]
  );
  return rows; // array of { genre_id, play_count }
};

// Get highest-trending unplayed track in a given genre for a user.
exports.findHotTrackForUser = async ({ userId, genreId }) => {
  const { rows } = await db.query(
    `SELECT ${DISCOVERY_TRACK_SELECT}
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.genre_id   = $1
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL
       AND  t.id NOT IN (
         SELECT track_id FROM listening_history WHERE user_id = $2
       )
     ORDER BY t.play_count DESC
     LIMIT 1`,
    [genreId, userId]
  );
  return rows[0] || null;
};

// Global fallback — #1 trending track (used for unauthenticated or no-genre-match users)
exports.findGlobalHotTrack = async () => {
  const { rows } = await db.query(
    `SELECT ${DISCOVERY_TRACK_SELECT}
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL
       AND  t.created_at >= NOW() - INTERVAL '7 days'
     ORDER BY t.play_count DESC
     LIMIT 1`
  );
  return rows[0] || null;
};


// Trending tracks in a genre — recency-weighted play count over last 7 days
exports.findTrendingByGenre = async ({ genreId, limit, offset }) => {
  const { rows } = await db.query(
    `SELECT ${DISCOVERY_TRACK_SELECT},
            COUNT(lh.id) AS recent_plays
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     LEFT JOIN listening_history lh
            ON lh.track_id = t.id
           AND lh.played_at >= now() - INTERVAL '7 days'
     WHERE  t.genre_id   = $1
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL
     GROUP BY t.id, g.name, u.display_name
     ORDER BY recent_plays DESC, t.play_count DESC, t.created_at DESC
     LIMIT  $2
     OFFSET $3`,
    [genreId, limit, offset]
  );

  // Genre name for response label
  const genreRow = await db.query(
    `SELECT name AS genre_name FROM genres WHERE id = $1`,
    [genreId]
  );

  return {
    genre_id: genreId,
    genre_name: genreRow.rows[0]?.genre_name || null,
    tracks: rows,
  };
};



// GET /genres/:genre_id/tracks — paginated, sort = newest | popular
exports.findGenreTracks = async ({ genreId, limit, offset, sort }) => {
  const orderClause =
    sort === 'popular'
      ? `t.play_count DESC, t.created_at DESC`
      : `t.created_at DESC, t.play_count DESC`;

  const { rows } = await db.query(
    `SELECT ${DISCOVERY_TRACK_SELECT}
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.genre_id   = $1
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL
     ORDER BY ${orderClause}
     LIMIT  $2
     OFFSET $3`,
    [genreId, limit, offset]
  );

  const countRow = await db.query(
    `SELECT COUNT(*) AS total
     FROM   tracks
     WHERE  genre_id   = $1
       AND  is_public  = true
       AND  is_hidden  = false
       AND  status     = 'ready'
       AND  deleted_at IS NULL`,
    [genreId]
  );

  return {
    tracks: rows,
    total: parseInt(countRow.rows[0]?.total || 0, 10),
  };
};



// GET /genres/:genre_id/albums — direct genre_id on albums table, newest first
exports.findGenreAlbums = async ({ genreId, limit, offset }) => {
  const { rows } = await db.query(
    `SELECT
       a.id,
       a.title         AS name,
       a.cover_image,
       a.artist_id     AS owner_id,
       u.display_name  AS owner_name,
       a.track_count,
       a.like_count,
       a.release_date,
       a.created_at
     FROM   albums a
     JOIN   users u ON u.id = a.artist_id
     WHERE  a.genre_id   = $1
       AND  a.is_public  = true
       AND  a.deleted_at IS NULL
     ORDER BY a.release_date DESC NULLS LAST, a.like_count DESC
     LIMIT  $2
     OFFSET $3`,
    [genreId, limit, offset]
  );

  const countRow = await db.query(
    `SELECT COUNT(*) AS total
     FROM   albums
     WHERE  genre_id   = $1
       AND  is_public  = true
       AND  deleted_at IS NULL`,
    [genreId]
  );

  return {
    albums: rows,
    total: parseInt(countRow.rows[0]?.total || 0, 10),
  };
};


// GET /genres/:genre_id/playlists
// Note: since playlists table has no genre_id column, ALL results are "inferred"
exports.findGenrePlaylists = async ({ genreId, limit, offset }) => {
  const { rows } = await db.query(
    `SELECT
       p.id,
       p.name,
       p.cover_image,
       p.user_id       AS owner_id,
       u.display_name  AS owner_name,
       p.track_count,
       p.like_count,
       p.created_at,
       'inferred'      AS source
     FROM   playlists p
     JOIN   users u ON u.id = p.user_id
     WHERE  p.is_public  = true
       AND  p.deleted_at IS NULL
       AND  p.type       = 'regular'
       AND (
         SELECT COUNT(*) FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = p.id
           AND t.genre_id     = $1
           AND t.deleted_at   IS NULL
       ) >= (p.track_count * 0.5)
       AND p.track_count > 0
     ORDER BY p.like_count DESC
     LIMIT  $2
     OFFSET $3`,
    [genreId, limit, offset]
  );

  const countRow = await db.query(
    `SELECT COUNT(*) AS total
     FROM   playlists p
     WHERE  p.is_public  = true
       AND  p.deleted_at IS NULL
       AND  p.type       = 'regular'
       AND (
         SELECT COUNT(*) FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = p.id AND t.genre_id = $1 AND t.deleted_at IS NULL
       ) >= (p.track_count * 0.5)
       AND p.track_count > 0`,
    [genreId]
  );

  return {
    playlists: rows,
    total: parseInt(countRow.rows[0]?.total || 0, 10),
  };
};

// GET /genres/:genre_id/artists — top artists by followers who have tracks in genre
// Includes follow status for authenticated users
exports.findGenreArtists = async ({ genreId, limit, offset, currentUserId = null }) => {
  const { rows } = await db.query(
    `SELECT
       u.id,
       u.display_name,
       u.username,
       u.profile_picture,
       u.is_verified,
       u.followers_count,
       COUNT(t.id) AS track_count_in_genre,
       CASE WHEN f.following_id IS NOT NULL THEN true ELSE false END AS is_following
     FROM   users u
     JOIN   tracks t
            ON t.user_id    = u.id
           AND t.genre_id   = $1
           AND t.is_public  = true
           AND t.is_hidden  = false
           AND t.status     = 'ready'
           AND t.deleted_at IS NULL
     LEFT JOIN follows f
            ON f.following_id = u.id
           AND f.follower_id = $4
     WHERE  u.deleted_at    IS NULL
     GROUP BY u.id, u.display_name, u.username, u.profile_picture,
              u.is_verified, u.followers_count, f.following_id
     ORDER BY u.followers_count DESC
     LIMIT  $2
     OFFSET $3`,
    [genreId, limit, offset, currentUserId]
  );

  const countRow = await db.query(
    `SELECT COUNT(DISTINCT t.user_id) AS total
     FROM   tracks t
     WHERE  t.genre_id   = $1
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL`,
    [genreId]
  );

  return {
    artists: rows,
    total: parseInt(countRow.rows[0]?.total || 0, 10),
  };
};