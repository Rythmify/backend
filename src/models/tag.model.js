// ============================================================
// models/tag.model.js — PostgreSQL queries for Tags
// Entity attributes: Tag_id, Name
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

const findByNames = async (tagNames) => {
  const normalized = [...new Set(tagNames.map((name) => name.trim().toLowerCase()))];

  if (!normalized.length) {
    return [];
  }

  const { rows } = await db.query(
    `
      SELECT id::text AS id, name
      FROM tags
      WHERE LOWER(name) = ANY($1::text[])
      ORDER BY name ASC
    `,
    [normalized]
  );

  return rows;
};

const findByName = async (name) => {
  const { rows } = await db.query(
    `
      SELECT id::text AS id, name
      FROM tags
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
    `,
    [name]
  );

  return rows[0] || null;
};

const findByIds = async (tagIds) => {
  const uniqueIds = [...new Set((tagIds || []).map(String))];

  if (!uniqueIds.length) {
    return [];
  }

  const { rows } = await db.query(
    `
      SELECT id::text AS id, name
      FROM tags
      WHERE id::text = ANY($1::text[])
    `,
    [uniqueIds]
  );

  const byId = new Map(rows.map((row) => [row.id, row]));

  // preserve input order
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
};

const getAllTags = async () => {
  const { rows } = await db.query(
    `
      SELECT id::text AS id, name
      FROM tags
      ORDER BY name ASC
    `
  );

  return rows;
};

module.exports = {
  findByNames,
  findByName,
  findByIds,
  getAllTags,
};
