// ============================================================
// models/push-token.model.js
// ============================================================
const db = require('../config/db');

/**
 * Save a device push token for a user.
 * Uses upsert — safe to call multiple times with same token.
 */
exports.registerToken = async (userId, token, platform) => {
  await db.query(
    `INSERT INTO push_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token) DO UPDATE
       SET platform = EXCLUDED.platform,
           updated_at = now()`,
    [userId, token, platform]
  );
};

/**
 * Remove a device push token on logout.
 */
exports.unregisterToken = async (userId, token) => {
  const { rowCount } = await db.query(
    `DELETE FROM push_tokens
     WHERE user_id = $1 AND token = $2`,
    [userId, token]
  );
  return rowCount > 0;
};

/**
 * Get all active tokens for a user (one user may have multiple devices).
 */
exports.getTokensByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT token, platform FROM push_tokens WHERE user_id = $1`,
    [userId]
  );
  return rows;
};