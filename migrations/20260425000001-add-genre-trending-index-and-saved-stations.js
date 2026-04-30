'use strict';

// This migration must run in a SEPARATE transaction from the one that added
// the 'genre_trending' enum value, because Postgres forbids using a freshly
// added enum value inside the same transaction that created it.

exports.setup = function () {};

exports.up = async function (db) {
  // Partial unique index: one genre_trending playlist per user per genre
  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_user_genre_trending
      ON playlists(user_id, type, genre_id)
      WHERE type = 'genre_trending' AND genre_id IS NOT NULL;
  `);

  // saved_stations table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS saved_stations (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      artist_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT saved_stations_user_artist_unique UNIQUE (user_id, artist_id)
    );
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_saved_stations_user_id
      ON saved_stations(user_id);
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_saved_stations_artist_id
      ON saved_stations(artist_id);
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS idx_saved_stations_artist_id;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_saved_stations_user_id;`);
  await db.runSql(`DROP TABLE IF EXISTS saved_stations;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_playlists_user_genre_trending;`);
};

exports._meta = { version: 1 };
