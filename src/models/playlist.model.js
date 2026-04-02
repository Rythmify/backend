// ============================================================
// models/playlist.model.js — PostgreSQL queries for Playlist
// Entity attributes: Playlist_id, User_Id, Name, Description, Is_public, Secret_token, Track_count, Like_count, Created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

const BASE_SELECT = `                   // Base SELECT query for playlists, used in multiple methods
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
  WHERE p.deleted_at IS NULL
`;

// ============================================================
// ENDPOINT 1 — POST /playlists (Create playlist)
// ============================================================

// Endpoint 1 — POST /playlists
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
