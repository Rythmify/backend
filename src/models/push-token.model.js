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
  const { rows } = await db.query(`SELECT token, platform FROM push_tokens WHERE user_id = $1`, [
    userId,
  ]);
  return rows;
};

/**
 * Fetch push preference flags for a user.
 * Returns null when no preferences row exists yet.
 */
exports.getPushPreferencesByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT
       new_follower_push,
       repost_of_your_post_push,
       new_post_by_followed_push,
       likes_and_plays_push,
       comment_on_post_push,
       recommended_content_push,
       new_message_push,
       feature_updates_push,
       surveys_and_feedback_push,
       promotional_content_push
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  );

  return rows[0] || null;
};
