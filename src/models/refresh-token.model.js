// ============================================================
// models/refresh-token.model.js
// ============================================================
const db = require('../config/db');

// Store a new refresh token in the database
exports.create = async ({ user_id, refresh_token, expires_at }) => {
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, refresh_token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (refresh_token) DO NOTHING
     RETURNING id, user_id, refresh_token, expires_at, created_at`,
    [user_id, refresh_token, expires_at]
  );
  return rows[0];
};

// Find a valid refresh token — narrow select to reduce I/O under load
exports.findValid = async (token) => {
  const { rows } = await db.query(
    `SELECT id, user_id, expires_at
       FROM refresh_tokens
      WHERE refresh_token = $1
        AND revoked       = false
        AND expires_at    > now()
      LIMIT 1`,
    [token]
  );
  return rows[0] || null;
};

// Revoke a single refresh token
exports.revoke = async (token) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked = true
     WHERE refresh_token = $1`,
    [token]
  );
};

// Revoke ALL refresh tokens for a user
exports.revokeAllForUser = async (userId) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked = true
     WHERE user_id = $1
       AND revoked = false`,
    [userId]
  );
};

// Atomic: revoke old token + insert new token in one transaction
// Uses SKIP LOCKED to avoid blocking when a token is being rotated concurrently
exports.rotateToken = async ({ oldToken, userId, newToken, expiresAt }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Lock the token row if it is still valid; skip if another process already locked it
    const { rows } = await client.query(
      `SELECT id
         FROM refresh_tokens
        WHERE refresh_token = $1
          AND revoked = false
        FOR UPDATE SKIP LOCKED`,
      [oldToken]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE refresh_tokens
          SET revoked = true
        WHERE id = $1`,
      [rows[0].id]
    );

    await client.query(
      `INSERT INTO refresh_tokens (user_id, refresh_token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, newToken, expiresAt]
    );

    await client.query('COMMIT');
    return newToken;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
