// ============================================================
// models/refresh-token.model.js — PostgreSQL queries for Refresh_Tokens
// Entity attributes: Token_id, User_Id, Refresh_token, Expires_at, Revoked
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');



// Store a new refresh token in the database
exports.create = async ({ user_id, refresh_token, expires_at }) => {
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, refresh_token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, refresh_token, expires_at, created_at`,
    [user_id, refresh_token, expires_at]
  );
  return rows[0];
};


// Find a valid refresh token must pass ALL conditions Used in: refresh and logout endpoints
exports.findValid = async (token) => {
  const { rows } = await db.query(
    `SELECT * FROM refresh_tokens
     WHERE refresh_token = $1
       AND revoked       = false
       AND expires_at    > now()`,
    [token]
  );
  return rows[0] || null;
};

// Revoke a single refresh token by its token string Used in: logout endpoint (revoke current token)
exports.revoke = async (token) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked = true
     WHERE refresh_token = $1`,
    [token]
  );
};

// Revoke ALL refresh tokens for a user Used in: reset-password (logout all devices), account suspension (admin action)
exports.revokeAllForUser = async (userId) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked = true
     WHERE user_id = $1
       AND revoked = false`,
    [userId]
  );
};