const db = require('../config/db');

// ------------------------------------------------------------
// Base SELECT for consistency
// ------------------------------------------------------------
const BASE_SELECT = `
  SELECT
    p.id            AS playlist_id,
    p.user_id       AS owner_user_id,
    p.name,
    p.description,
    p.cover_image,
    p.type,
    p.subtype,
    p.is_public,
    p.secret_token,
    p.release_date,
    p.genre_id,
    p.like_count,
    p.repost_count,
    p.track_count,
    p.created_at,
    p.updated_at
  FROM playlists p
`;

// ------------------------------------------------------------
// Helper: Build Type Filter
// Handles the "All is under albums if type is not playlist" logic
// ------------------------------------------------------------
const buildTypeFilter = (subtype, isAlbumView, currentIdx) => {
  let clause = "";
  const params = [];
  let idx = currentIdx;

  if (isAlbumView) {
    clause = ` AND p.subtype != 'playlist'`;
  } else if (subtype) {
    clause = ` AND p.subtype = $${idx++}`;
    params.push(subtype);
  }
  return { clause, params, nextIdx: idx };
};

exports.getTopTrackArt = async (playlistId) => {
  const query = `
    SELECT t.cover_image 
    FROM playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = $1 AND t.deleted_at IS NULL
    ORDER BY pt.position ASC
    LIMIT 1
  `;
  const { rows } = await db.query(query, [playlistId]);
  return rows[0] || null;
};

// ------------------------------------------------------------
// Endpoint 1 — Create
// ------------------------------------------------------------
exports.create = async ({ userId, name, isPublic, secretToken, subtype }) => {
  const { rows } = await db.query(
    `INSERT INTO playlists 
      (user_id, name, is_public, secret_token, subtype, type)
     VALUES ($1, $2, $3, $4, $5, 'regular')
     RETURNING *`,
    [userId, name, isPublic, secretToken, subtype]
  );
  return rows[0];
};

// ------------------------------------------------------------
// Endpoint 2 — List (Public)
// ------------------------------------------------------------
exports.findPublicPlaylists = async ({ ownerUserId, q, subtype, isAlbumView, limit, offset }) => {
  let params = [];
  let idx = 1;
  let where = `WHERE p.is_public = true AND p.deleted_at IS NULL AND p.type = 'regular'`;

  if (ownerUserId) {
    where += ` AND p.user_id = $${idx++}`;
    params.push(ownerUserId);
  }

  const typeFilter = buildTypeFilter(subtype, isAlbumView, idx);
  where += typeFilter.clause;
  params.push(...typeFilter.params);
  idx = typeFilter.nextIdx;

  if (q) {
    where += ` AND p.name ILIKE $${idx++}`;
    params.push(`%${q}%`);
  }

  params.push(limit, offset);
  const { rows } = await db.query(
    `${BASE_SELECT} ${where} ORDER BY p.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    params
  );
  return rows;
};

exports.countPublicPlaylists = async ({ ownerUserId, q, subtype, isAlbumView }) => {
  let params = [];
  let idx = 1;
  let where = `WHERE p.is_public = true AND p.deleted_at IS NULL AND p.type = 'regular'`;

  if (ownerUserId) {
    where += ` AND p.user_id = $${idx++}`;
    params.push(ownerUserId);
  }

  const typeFilter = buildTypeFilter(subtype, isAlbumView, idx);
  where += typeFilter.clause;
  params.push(...typeFilter.params);
  idx = typeFilter.nextIdx;

  if (q) {
    where += ` AND p.name ILIKE $${idx++}`;
    params.push(`%${q}%`);
  }

  const { rows } = await db.query(`SELECT COUNT(*) FROM playlists p ${where}`, params);
  return rows[0].count;
};

// ------------------------------------------------------------
// Endpoint 2 — List (My Playlists)
// ------------------------------------------------------------
exports.findMyPlaylists = async ({ userId, q, subtype, isAlbumView, limit, offset }) => {
  let params = [userId];
  let idx = 2;
  let where = `WHERE p.user_id = $1 AND p.deleted_at IS NULL AND p.type = 'regular'`;

  const typeFilter = buildTypeFilter(subtype, isAlbumView, idx);
  where += typeFilter.clause;
  params.push(...typeFilter.params);
  idx = typeFilter.nextIdx;

  if (q) {
    where += ` AND p.name ILIKE $${idx++}`;
    params.push(`%${q}%`);
  }

  params.push(limit, offset);
  const { rows } = await db.query(
    `${BASE_SELECT} ${where} ORDER BY p.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    params
  );
  return rows;
};

exports.countMyPlaylists = async ({ userId, q, subtype, isAlbumView }) => {
  let params = [userId];
  let idx = 2;
  let where = `WHERE p.user_id = $1 AND p.deleted_at IS NULL AND p.type = 'regular'`;

  const typeFilter = buildTypeFilter(subtype, isAlbumView, idx);
  where += typeFilter.clause;
  params.push(...typeFilter.params);
  idx = typeFilter.nextIdx;

  if (q) {
    where += ` AND p.name ILIKE $${idx++}`;
    params.push(`%${q}%`);
  }

  const { rows } = await db.query(`SELECT COUNT(*) FROM playlists p ${where}`, params);
  return rows[0].count;
};

// ------------------------------------------------------------
// Endpoint 2 — List (Liked)
// ------------------------------------------------------------
exports.findLikedPlaylists = async ({ userId, q, subtype, isAlbumView, limit, offset }) => {
  let params = [userId]; // User who performed the LIKE action
  let idx = 2;
  
  // WHERE clause only cares about who liked it (pl.user_id)
  let where = `WHERE pl.user_id = $1 AND p.deleted_at IS NULL AND p.type = 'regular'`;

  // Apply Subtype/Album logic
  const typeFilter = buildTypeFilter(subtype, isAlbumView, idx);
  where += typeFilter.clause;
  params.push(...typeFilter.params);
  idx = typeFilter.nextIdx;

  // Apply Search
  if (q) {
    where += ` AND p.name ILIKE $${idx++}`;
    params.push(`%${q}%`);
  }

  params.push(limit, offset);

  // BASE_SELECT refers to the shared column list we defined earlier
  const query = `
    SELECT p.*, pl.created_at AS liked_at 
    FROM playlists p
    INNER JOIN playlist_likes pl ON p.id = pl.playlist_id
    ${where}
    ORDER BY pl.created_at DESC
    LIMIT $${idx++} OFFSET $${idx}
  `;

  const { rows } = await db.query(query, params);
  return rows;
};

exports.countLikedPlaylists = async ({ userId, q, subtype, isAlbumView }) => {
  let params = [userId];
  let idx = 2;
  let where = `WHERE pl.user_id = $1 AND p.deleted_at IS NULL AND p.type = 'regular'`;

  const typeFilter = buildTypeFilter(subtype, isAlbumView, idx);
  where += typeFilter.clause;
  params.push(...typeFilter.params);
  idx = typeFilter.nextIdx;

  if (q) {
    where += ` AND p.name ILIKE $${idx++}`;
    params.push(`%${q}%`);
  }

  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total 
     FROM playlists p 
     INNER JOIN playlist_likes pl ON p.id = pl.playlist_id 
     ${where}`, 
    params
  );
  return rows[0].total;
};

// ============================================================
// ENDPOINT 2 — GET /playlists/{playlist_id}
// ============================================================
/**
 * Finds a single playlist by ID using the standardized BASE_SELECT.
 */
exports.findPlaylistById = async (playlistId) => {
  // Using the BASE_SELECT you defined earlier
  const query = `${BASE_SELECT} WHERE p.id = $1 AND p.deleted_at IS NULL`;
  const { rows } = await db.query(query, [playlistId]);
  return rows[0] || null;
};

/**
 * Fetches all tracks currently in the playlist with track metadata.
 */
exports.findPlaylistTracks = async (playlistId) => {
  const query = `
    SELECT 
        pt.track_id,
        pt.position,
        pt.added_at,
        t.title,
        t.duration,
        t.cover_image,
        u.username AS artist_name
     FROM playlist_tracks pt
     JOIN tracks t ON pt.track_id = t.id
     JOIN users u ON t.user_id = u.id
     WHERE pt.playlist_id = $1 AND t.deleted_at IS NULL
     ORDER BY pt.position ASC
  `;
  const { rows } = await db.query(query, [playlistId]);
  return rows;
};