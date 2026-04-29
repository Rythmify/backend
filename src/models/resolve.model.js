// resolve.model.js
const db = require('../config/db');

async function trackExists(id) {
  const { rows } = await db.query(
    `SELECT 1 FROM tracks
     WHERE id = $1 AND deleted_at IS NULL AND is_public = true`,
    [id]
  );
  return rows.length > 0;
}

async function playlistSubtype(id) {
  const { rows } = await db.query(
    `SELECT subtype FROM playlists
     WHERE id = $1 AND deleted_at IS NULL AND is_public = true`,
    [id]
  );
  return rows.length > 0 ? rows[0].subtype : null;
}

async function playlistSubtypeBySlug(slug) {
  const { rows } = await db.query(
    `SELECT subtype FROM playlists
     WHERE slug = $1 AND deleted_at IS NULL AND is_public = true`,
    [slug]
  );
  return rows.length > 0 ? rows[0].subtype : null;
}

async function userExists(username) {
  const { rows } = await db.query(
    `SELECT 1 FROM users
     WHERE username = $1 AND deleted_at IS NULL`,
    [username]
  );
  return rows.length > 0;
}

module.exports = { trackExists, playlistSubtype, playlistSubtypeBySlug, userExists };
