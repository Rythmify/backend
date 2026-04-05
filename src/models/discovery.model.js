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