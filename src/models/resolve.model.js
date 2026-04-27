const db = require('../config/db');

async function trackExists(id) {
  const { rows } = await db.query(
    `SELECT 1 FROM tracks
     WHERE id = $1 AND deleted_at IS NULL AND is_public = true`,
    [id]
  );
  return rows.length > 0;
}

// Returns 'playlist' | 'album' | null
async function playlistSubtype(id) {
  const { rows } = await db.query(
    `SELECT subtype FROM playlists
     WHERE id = $1 AND deleted_at IS NULL AND is_public = true`,
    [id]
  );
  return rows.length > 0 ? rows[0].subtype : null;
}

module.exports = { trackExists, playlistSubtype };
