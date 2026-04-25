// ============================================================
// models/station.model.js
// Owner : Omar Hamza (BE-5)
// Raw DB queries for saved artist stations
// ============================================================
const db = require('../config/db');

async function saveStation(userId, artistId) {
  const { rows } = await db.query(
    `
    INSERT INTO saved_stations (user_id, artist_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, artist_id) DO NOTHING
    RETURNING id, user_id, artist_id, created_at
    `,
    [userId, artistId]
  );

  if (rows[0]) return { created: true, station: rows[0] };

  const existing = await db.query(
    `SELECT id, user_id, artist_id, created_at
     FROM saved_stations
     WHERE user_id = $1 AND artist_id = $2`,
    [userId, artistId]
  );

  return { created: false, station: existing.rows[0] };
}

async function unsaveStation(userId, artistId) {
  const { rowCount } = await db.query(
    `DELETE FROM saved_stations WHERE user_id = $1 AND artist_id = $2`,
    [userId, artistId]
  );
  return rowCount > 0;
}

async function isStationSaved(userId, artistId) {
  if (!userId) return false;
  const { rows } = await db.query(
    `SELECT 1 FROM saved_stations WHERE user_id = $1 AND artist_id = $2 LIMIT 1`,
    [userId, artistId]
  );
  return rows.length > 0;
}

async function getUserSavedStations(userId, limit, offset) {
  const { rows } = await db.query(
    `
    SELECT
      ss.id,
      ss.artist_id,
      ss.created_at AS saved_at,
      u.display_name AS artist_name,
      u.profile_picture,
      COALESCE(COUNT(t.id), 0)::integer AS track_count,
      COALESCE(u.followers_count, 0)::integer AS follower_count,
      COUNT(*) OVER()::integer AS total_count
    FROM saved_stations ss
    JOIN users u ON u.id = ss.artist_id
    LEFT JOIN tracks t
      ON t.user_id = ss.artist_id
      AND t.is_public = true
      AND t.is_hidden = false
      AND t.status = 'ready'
      AND t.deleted_at IS NULL
    WHERE ss.user_id = $1
      AND u.deleted_at IS NULL
    GROUP BY ss.id, ss.artist_id, ss.created_at, u.display_name,
             u.profile_picture, u.followers_count
    ORDER BY ss.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map((r) => ({
      id: r.id,
      artist_id: r.artist_id,
      artist_name: r.artist_name,
      profile_picture: r.profile_picture ?? null,
      track_count: r.track_count,
      follower_count: r.follower_count,
      saved_at: r.saved_at,
      type: 'artist_station',
    })),
    total,
  };
}

module.exports = { saveStation, unsaveStation, isStationSaved, getUserSavedStations };
