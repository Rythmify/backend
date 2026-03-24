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

module.exports = {
  getAllGenres,
};
