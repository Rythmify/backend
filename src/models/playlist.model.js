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
    p.slug,
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
  let clause = '';
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
exports.create = async ({ userId, name, isPublic, secretToken, subtype, slug }) => {
  const { rows } = await db.query(
    `INSERT INTO playlists 
      (user_id, name, is_public, secret_token, subtype, slug, type)
     VALUES ($1, $2, $3, $4, $5, $6, 'regular')
     RETURNING *`,
    [userId, name, isPublic, secretToken, subtype, slug]
  );
  return rows[0];
};

// ------------------------------------------------------------
// Endpoint 2 — List (Public)
// ------------------------------------------------------------
exports.findPublicPlaylists = async ({ ownerUserId, q, subtype, isAlbumView, limit, offset }) => {
  const params = [];
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
  const params = [];
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
  const params = [userId];
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
  const params = [userId];
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
  const params = [userId]; // User who performed the LIKE action
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
  const params = [userId];
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
// ENDPOINT 3 — GET /playlists/{playlist_id}
// ============================================================
/**
 * Finds a single playlist by ID using the standardized BASE_SELECT.
 */
exports.findPlaylistById = async (playlistId) => {
  const query = `
    ${BASE_SELECT}
    WHERE p.id = $1 AND p.deleted_at IS NULL
  `;
  const { rows } = await db.query(query, [playlistId]);
  if (!rows[0]) return null;

  // Fetch tags separately
  const tagsResult = await db.query(
    `SELECT t.id, t.name
     FROM playlist_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.playlist_id = $1
     ORDER BY t.name ASC`,
    [playlistId]
  );

  return { ...rows[0], tags: tagsResult.rows };
};

exports.findBySlug = async (slug, excludeId = null) => {
  if (excludeId) {
    const { rows } = await db.query(
      `SELECT id FROM playlists
       WHERE slug = $1 AND id != $2 AND deleted_at IS NULL`,
      [slug, excludeId]
    );
    return rows[0] || null;
  }

  const { rows } = await db.query(
    `SELECT id FROM playlists
     WHERE slug = $1 AND deleted_at IS NULL`,
    [slug]
  );
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

// ============================================================
// ENDPOINT 4 — PATCH /playlists/:playlist_id
// Also used internally by ENDPOINT 1 after cover image upload
// ============================================================
exports.updatePlaylist = async (
  playlistId,
  { name, description, isPublic, secretToken, subtype, coverImage, releaseDate, genreId, slug }
) => {
  const fields = [];
  const params = [];

  if (name !== undefined) {
    params.push(name);
    fields.push(`name = $${params.length}`);
  }
  if (description !== undefined) {
    params.push(description);
    fields.push(`description = $${params.length}`);
  }
  if (isPublic !== undefined) {
    params.push(isPublic);
    fields.push(`is_public = $${params.length}`);
  }
  if (secretToken !== undefined) {
    params.push(secretToken);
    fields.push(`secret_token = $${params.length}`);
  }
  if (subtype !== undefined) {
    params.push(subtype);
    fields.push(`subtype = $${params.length}`);
  }
  if (coverImage !== undefined) {
    params.push(coverImage);
    fields.push(`cover_image = $${params.length}`);
  }
  if (releaseDate !== undefined) {
    params.push(releaseDate);
    fields.push(`release_date = $${params.length}`);
  }
  if (genreId !== undefined) {
    params.push(genreId);
    fields.push(`genre_id = $${params.length}`);
  }
  if (slug !== undefined) {
    params.push(slug);
    fields.push(`slug = $${params.length}`);
  }

  if (fields.length === 0) return null;

  params.push(playlistId);
  const { rows } = await db.query(
    `UPDATE playlists
     SET ${fields.join(', ')}
     WHERE id = $${params.length} AND deleted_at IS NULL
     RETURNING *`,
    params
  );
  return rows[0] || null;
};

exports.getPlaylistTags = async (playlistId) => {
  const { rows } = await db.query(
    `SELECT t.id, t.name
     FROM playlist_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.playlist_id = $1
     ORDER BY t.name ASC`,
    [playlistId]
  );
  return rows;
};

exports.replacePlaylistTags = async (playlistId, tagNames) => {
  // Delete all existing tags for this playlist
  await db.query(`DELETE FROM playlist_tags WHERE playlist_id = $1`, [playlistId]);

  if (!tagNames || tagNames.length === 0) return [];

  // Normalize tag names
  const normalized = [
    ...new Set(tagNames.map((n) => String(n).trim().toLowerCase()).filter(Boolean)),
  ];

  // Find or create each tag
  const tagIds = [];
  for (const name of normalized) {
    // Try to find existing tag
    let result = await db.query(`SELECT id FROM tags WHERE LOWER(name) = $1 LIMIT 1`, [name]);

    // Create if not found
    if (!result.rows[0]) {
      result = await db.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [name]
      );
      if (!result.rows[0]) {
        result = await db.query(`SELECT id FROM tags WHERE LOWER(name) = $1 LIMIT 1`, [name]);
      }
    }

    if (result.rows[0]) tagIds.push(result.rows[0].id);
  }

  // Insert new playlist_tags
  for (const tagId of tagIds) {
    await db.query(
      `INSERT INTO playlist_tags (playlist_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [playlistId, tagId]
    );
  }

  // Return final tag list
  const { rows } = await db.query(
    `SELECT t.id, t.name
     FROM playlist_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.playlist_id = $1
     ORDER BY t.name ASC`,
    [playlistId]
  );
  return rows;
};

// ============================================================
// ENDPOINT 5 — DELETE /playlists/:playlist_id
// ============================================================
exports.hardDelete = async (playlistId) => {
  const { rows } = await db.query(
    `DELETE FROM playlists
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [playlistId]
  );
  return rows[0] || null;
};

// ============================================================
// ENDPOINT 6 — POST /playlists/:playlist_id/tracks
// ============================================================

/**
 * Check if a track already exists in this playlist.
 */
exports.findPlaylistTrack = async (playlistId, trackId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM playlist_tracks
     WHERE playlist_id = $1 AND track_id = $2`,
    [playlistId, trackId]
  );
  return rows.length > 0;
};

/**
 * Get the max current position in the playlist.
 * Returns 0 if playlist is empty.
 */
exports.getMaxPosition = async (playlistId) => {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(position), 0) AS max_pos
     FROM playlist_tracks
     WHERE playlist_id = $1`,
    [playlistId]
  );
  return rows[0].max_pos;
};

/**
 * Shift existing tracks down to make room at a given position.
 */
exports.shiftPositionsDown = async (playlistId, fromPosition) => {
  const TEMP_POSITION_OFFSET = 1000000;
  const threshold = fromPosition + TEMP_POSITION_OFFSET;

  // Phase 1: move affected rows out of range
  await db.query(
    `UPDATE playlist_tracks
     SET position = position + $1
     WHERE playlist_id = $2 AND position >= $3`,
    [TEMP_POSITION_OFFSET, playlistId, fromPosition]
  );

  // Phase 2: bring rows back shifted by +1
  await db.query(
    `UPDATE playlist_tracks
     SET position = position - $1 + 1
     WHERE playlist_id = $2 AND position >= $3`,
    [TEMP_POSITION_OFFSET, playlistId, threshold]
  );
};

/**
 * Insert a track at a specific position.
 */
exports.insertTrackAtPosition = async (playlistId, trackId, position) => {
  await db.query(
    `INSERT INTO playlist_tracks (playlist_id, track_id, position)
     VALUES ($1, $2, $3)`,
    [playlistId, trackId, position]
  );
};

// ============================================================
// ENDPOINT 7 — GET /playlists/:playlist_id/tracks
// ============================================================
exports.findPlaylistTracksPaginated = async (playlistId, { limit, offset }) => {
  const { rows } = await db.query(
    `SELECT
        pt.track_id,
        pt.position,
        pt.added_at,
        t.title,
        t.duration,
        t.cover_image,
        t.is_public,
        t.deleted_at,
        u.display_name AS artist_name,
        u.id           AS artist_id
     FROM playlist_tracks pt
     JOIN tracks t ON pt.track_id = t.id
     JOIN users  u ON t.user_id   = u.id
     WHERE pt.playlist_id = $1
       AND t.deleted_at IS NULL
     ORDER BY pt.position ASC
     LIMIT $2 OFFSET $3`,
    [playlistId, limit, offset]
  );

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM playlist_tracks pt
     JOIN tracks t ON pt.track_id = t.id
     WHERE pt.playlist_id = $1
       AND t.deleted_at IS NULL`,
    [playlistId]
  );

  return {
    rows,
    total: countResult.rows[0].total,
  };
};

// ============================================================
// ENDPOINT 8 — PATCH /playlists/:playlist_id/tracks/reorder
// ============================================================
exports.getAllTracksInPlaylist = async (playlistId) => {
  const { rows } = await db.query(`SELECT track_id FROM playlist_tracks WHERE playlist_id = $1`, [
    playlistId,
  ]);
  return rows.map((r) => r.track_id);
};

exports.reorderTracks = async (playlistId, items) => {
  const client = await db.connect();
  const TEMP_POSITION_OFFSET = 1000000;

  try {
    await client.query('BEGIN');

    // Lock current playlist tracks to prevent concurrent writes during reorder.
    await client.query(
      `SELECT track_id
       FROM playlist_tracks
       WHERE playlist_id = $1
       FOR UPDATE`,
      [playlistId]
    );

    // Move all current positions out of the way first so final assignments
    // cannot collide with the unique (playlist_id, position) index.
    await client.query(
      `UPDATE playlist_tracks
       SET position = position + $1
       WHERE playlist_id = $2`,
      [TEMP_POSITION_OFFSET, playlistId]
    );

    for (const item of items) {
      const result = await client.query(
        `UPDATE playlist_tracks
         SET position = $1
         WHERE playlist_id = $2 AND track_id = $3`,
        [item.position, playlistId, item.track_id]
      );

      if (result.rowCount !== 1) {
        throw new Error('PLAYLIST_REORDER_TRACK_NOT_FOUND');
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================
// ENDPOINT 7 — DELETE /playlists/:playlist_id/tracks/:track_id
// ============================================================

/**
 * Remove a specific track from a playlist.
 * Returns true if removed, false if it wasn't there.
 */
exports.removeTrackFromPlaylist = async (playlistId, trackId) => {
  const client = await db.connect();
  const TEMP_POSITION_OFFSET = 1000000;
  try {
    await client.query('BEGIN');

    const deleted = await client.query(
      `DELETE FROM playlist_tracks
       WHERE playlist_id = $1 AND track_id = $2
       RETURNING position`,
      [playlistId, trackId]
    );

    if (deleted.rowCount === 0) {
      await client.query('COMMIT');
      return false;
    }

    const removedPosition = deleted.rows[0].position;
    const threshold = removedPosition + TEMP_POSITION_OFFSET;

    // Phase 1: move affected rows out of range
    await client.query(
      `UPDATE playlist_tracks
       SET position = position + $1
       WHERE playlist_id = $2 AND position > $3`,
      [TEMP_POSITION_OFFSET, playlistId, removedPosition]
    );

    // Phase 2: bring rows back shifted by -1
    await client.query(
      `UPDATE playlist_tracks
       SET position = position - $1 - 1
       WHERE playlist_id = $2 AND position > $3`,
      [TEMP_POSITION_OFFSET, playlistId, threshold]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
