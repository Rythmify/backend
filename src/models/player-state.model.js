const db = require('../config/db');

exports.trackExists = async (trackId) => {
  const { rows } = await db.query(
    `SELECT 1
     FROM tracks
     WHERE id = $1
     LIMIT 1`,
    [trackId]
  );

  return rows.length > 0;
};

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

exports.upsert = async ({ userId, trackId, positionSeconds, volume, queue }) => {
  const { rows } = await db.query(
    `INSERT INTO player_state (
       user_id,
       track_id,
       position_seconds,
       volume,
       queue,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       track_id = EXCLUDED.track_id,
       position_seconds = EXCLUDED.position_seconds,
       volume = EXCLUDED.volume,
       queue = EXCLUDED.queue,
       updated_at = now()
     RETURNING
       track_id,
       position_seconds::float8 AS position_seconds,
       volume::float8 AS volume,
       COALESCE(queue, '[]'::jsonb) AS queue,
       updated_at AS saved_at`,
    [userId, trackId, positionSeconds, volume, JSON.stringify(queue)]
  );

  return rows[0];
};

exports.upsertIfNewer = async ({ userId, trackId, positionSeconds, volume, queue, updatedAt }) => {
  const { rows } = await db.query(
    `INSERT INTO player_state (
       user_id,
       track_id,
       position_seconds,
       volume,
       queue,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
     ON CONFLICT (user_id)
     DO UPDATE SET
       track_id = EXCLUDED.track_id,
       position_seconds = EXCLUDED.position_seconds,
       volume = EXCLUDED.volume,
       queue = EXCLUDED.queue,
       updated_at = EXCLUDED.updated_at
     WHERE player_state.updated_at <= EXCLUDED.updated_at
     RETURNING
       track_id,
       position_seconds::float8 AS position_seconds,
       volume::float8 AS volume,
       COALESCE(queue, '[]'::jsonb) AS queue,
       updated_at AS saved_at`,
    [userId, trackId, positionSeconds, volume, JSON.stringify(queue), updatedAt]
  );

  return rows[0] || null;
};
