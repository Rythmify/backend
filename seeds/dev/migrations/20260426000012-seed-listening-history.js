'use strict';

exports.setup = function () {};

const SEEDED_ARTIST_EMAILS = [
  'tameimpala@rythmify.com',
  'radiohead@rythmify.com',
  'arcticmonkeys@rythmify.com',
  'marwanpablo@rythmify.com',
  'dominicfike@rythmify.com',
  'glassanimals@rythmify.com',
  'tul8te@rythmify.com',
  'amrdiab@rythmify.com',
  'elissa@rythmify.com',
  'adele@rythmify.com',
  'cairokee@rythmify.com',
  'theweeknd@rythmify.com',
  'drake@rythmify.com',
  'kendricklamar@rythmify.com',
  'frankocean@rythmify.com',
  'tylerthecreator@rythmify.com',
  'billieeilish@rythmify.com',
  'daftpunk@rythmify.com',
];

const sqlArray = (values) =>
  `ARRAY[${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')}]`;

exports.up = async function (db) {
  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_tracks AS (
      SELECT track.id, track.duration
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND artist.role = 'artist'
        AND track.deleted_at IS NULL
        AND track.duration >= 30
    ),
    listener_targets AS (
      SELECT
        id AS user_id,
        25 + FLOOR(RANDOM() * 16)::integer AS history_count
      FROM seeded_listeners
    ),
    listener_slots AS (
      SELECT
        target.user_id,
        slot.slot_number
      FROM listener_targets target
      CROSS JOIN LATERAL generate_series(1, target.history_count) AS slot(slot_number)
    ),
    randomized_history AS (
      SELECT
        slot.user_id,
        picked_track.id AS track_id,
        30 + FLOOR(RANDOM() * (picked_track.duration - 29))::integer AS duration_played,
        NOW()
          - (FLOOR(RANDOM() * 90) * INTERVAL '1 day')
          - (FLOOR(RANDOM() * 24) * INTERVAL '1 hour')
          - (FLOOR(RANDOM() * 60) * INTERVAL '1 minute') AS played_at
      FROM listener_slots slot
      CROSS JOIN LATERAL (
        SELECT track.id, track.duration
        FROM seeded_tracks track
        ORDER BY RANDOM() + slot.slot_number * 0
        LIMIT 1
      ) picked_track
    )
    INSERT INTO listening_history (
      user_id, track_id, duration_played, played_at, deleted_at
    )
    SELECT
      user_id,
      track_id,
      duration_played,
      played_at,
      NULL
    FROM randomized_history
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM listening_history
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    );
  `);
};

exports._meta = { version: 1 };
