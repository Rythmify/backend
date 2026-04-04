'use strict';

var dbm;
var type;
var seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};
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

  // Ensure there are no duplicate non-NULL (playlist_id, position) values
  // before creating the UNIQUE index. For each duplicate group, we keep the
  // first row (by id) and set position = NULL on the others so they no longer
  // conflict with the uniqueness constraint.
  await db.runSql(`
    WITH duplicates AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY playlist_id, position
          ORDER BY id
        ) AS rn
      FROM "playlist_tracks"
      WHERE position IS NOT NULL
    )
    UPDATE "playlist_tracks" pt
    SET position = NULL
    FROM duplicates d
    WHERE pt.id = d.id
      AND d.rn > 1;
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS playlist_tracks_playlist_id_position_idx
    ON "playlist_tracks" ("playlist_id", "position")
    WHERE "position" IS NOT NULL;
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