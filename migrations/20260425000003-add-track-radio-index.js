'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  // 1. Add seed_track_id column to playlists
  await db.runSql(`
    ALTER TABLE playlists
      ADD COLUMN IF NOT EXISTS seed_track_id uuid
      REFERENCES tracks(id) ON DELETE SET NULL;
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_playlists_seed_track_id
      ON playlists(seed_track_id);
  `);

  // 2. Partial unique index — one track radio per user per seed track
  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_user_track_radio
      ON playlists(user_id, type, seed_track_id)
      WHERE type = 'track_radio' AND seed_track_id IS NOT NULL;
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS idx_playlists_user_track_radio;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_playlists_seed_track_id;`);
  await db.runSql(`ALTER TABLE playlists DROP COLUMN IF EXISTS seed_track_id;`);
};

exports._meta = { version: 1 };
