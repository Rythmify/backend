// ============================================================
// models/genre.model.js — PostgreSQL queries for Genres
// Entity attributes: Genre_id, Name
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

const getAllGenres = async () => {
  const { rows } = await db.query(
    `
      SELECT id::text AS id, name
      FROM genres
      ORDER BY name ASC
    `
  );

  return rows;
};


// Genre header info (name, cover, counts)
const findGenreDetail = async (genreId) => {
  const { rows } = await db.query(
    `SELECT
       g.id,
       g.name,
       NULL::varchar AS cover_image,
       COUNT(DISTINCT t.id)      AS track_count,
       COUNT(DISTINCT t.user_id) AS artist_count
     FROM   genres g
     LEFT JOIN tracks t
            ON t.genre_id   = g.id
           AND t.is_public  = true
           AND t.is_hidden  = false
           AND t.status     = 'ready'
           AND t.deleted_at IS NULL
     WHERE  g.id = $1
     GROUP BY g.id, g.name`,
    [genreId]
  );
  return rows[0] || null;
};

module.exports = {
  getAllGenres,
  findGenreDetail,
};
