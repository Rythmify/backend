// ============================================================
// models/oauth-connection.model.js
// Table: oauth_connections
// ============================================================
const db = require('../config/db');

// Find an existing OAuth connection with provider and provider_user_id
exports.findByProvider = async (provider, providerUserId) => {
  const { rows } = await db.query(
    `SELECT * FROM oauth_connections
     WHERE provider = $1 AND provider_user_id = $2`,
    [provider, providerUserId]
  );
  return rows[0] || null;
};

// Create a new OAuth connection linking a Rythmify user to a provider
exports.create = async ({
  user_id,
  provider,
  provider_user_id,
  access_token,
  refresh_token,
  expires_at,
}) => {
  const { rows } = await db.query(
    `INSERT INTO oauth_connections
       (user_id, provider, provider_user_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      user_id,
      provider,
      provider_user_id,
      access_token || null,
      refresh_token || null,
      expires_at || null,
    ]
  );
  return rows[0];
};

// Update provider tokens on re-login
exports.updateTokens = async ({ user_id, provider, access_token, refresh_token, expires_at }) => {
  await db.query(
    `UPDATE oauth_connections
     SET access_token = $3, refresh_token = $4, expires_at = $5, updated_at = now()
     WHERE user_id = $1 AND provider = $2`,
    [user_id, provider, access_token || null, refresh_token || null, expires_at || null]
  );
};
