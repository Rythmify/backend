const db = require('../config/db');

exports.findByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT
       track_id,
       position_seconds::float8 AS position_seconds,
       volume::float8 AS volume,
       COALESCE(queue, '[]'::jsonb) AS queue,
       updated_at AS saved_at
     FROM player_state
     WHERE user_id = $1
       AND track_id IS NOT NULL
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
};
