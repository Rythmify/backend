'use strict';

exports.setup = function(options, seedLink) {};

exports.up = async function(db) {
  await db.runSql(`
    ALTER TABLE "playlists"
      ADD COLUMN IF NOT EXISTS "release_date" date,
      ADD COLUMN IF NOT EXISTS "genre_id"     uuid REFERENCES "genres" ("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "subtype"      varchar(20) NOT NULL DEFAULT 'playlist';
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS playlists_genre_id_idx
    ON "playlists" ("genre_id");
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS playlist_tracks_playlist_id_position_idx
    ON "playlist_tracks" ("playlist_id", "position");
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP INDEX IF EXISTS playlist_tracks_playlist_id_position_idx;`);
  await db.runSql(`DROP INDEX IF EXISTS playlists_genre_id_idx;`);
  await db.runSql(`
    ALTER TABLE "playlists"
      DROP COLUMN IF EXISTS "release_date",
      DROP COLUMN IF EXISTS "genre_id",
      DROP COLUMN IF EXISTS "subtype";
  `);
};

exports._meta = { version: 1 };