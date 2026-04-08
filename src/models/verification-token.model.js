// ============================================================
// models/verification-token.model.js — PostgreSQL queries for Verification_Tokens
// Entity attributes: Token_id, User_Id, Verification_token, Type, Expires_at, Revoked, Used_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

// Create a new verification token Used in: register, resend-verification, forgot-password
exports.create = async ({ user_id, token, type, expires_at }) => {
  const { rows } = await db.query(
    `INSERT INTO verification_tokens (user_id, token, type, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, token, type, expires_at, created_at`,
    [user_id, token, type, expires_at]
  );
  return rows[0];
};

// Find a valid token must staisfy all (4 conditions) Used in: verify-email, reset-password
exports.findValidToken = async (token, type) => {
  const { rows } = await db.query(
    `SELECT * FROM verification_tokens
     WHERE token     = $1
       AND type      = $2
       AND expires_at > now()
       AND revoked   = false
       AND used_at   IS NULL`,
    [token, type]
  );
  return rows[0] || null;
};

// Mark a token as used (set used_at timestamp) Used in: verify-email, reset-password
exports.markUsed = async (tokenId) => {
  await db.query(
    `UPDATE verification_tokens
     SET used_at = now()
     WHERE id = $1`,
    [tokenId]
  );
};

// Revoke ALL tokens of a given type for a user called before creating a new token so old links stop working
exports.revokeAllForUser = async (userId, type) => {
  await db.query(
    `UPDATE verification_tokens
     SET revoked = true
     WHERE user_id = $1
       AND type    = $2
       AND revoked = false
       AND used_at IS NULL`,
    [userId, type]
  );
};
