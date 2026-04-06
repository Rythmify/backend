'use strict';

exports.setup = function(options, seedLink) {};

exports.up = async function(db) {
  await db.runSql(`
    CREATE TABLE "playlist_tags" (
      "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "playlist_id" uuid        NOT NULL REFERENCES "playlists" ("id") ON DELETE CASCADE,
      "tag_id"      uuid        NOT NULL REFERENCES "tags"      ("id") ON DELETE CASCADE,
      "created_at"  timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX playlist_tags_playlist_id_tag_id_idx
    ON "playlist_tags" ("playlist_id", "tag_id");
  `);

  await db.runSql(`
    CREATE INDEX playlist_tags_tag_id_idx
    ON "playlist_tags" ("tag_id");
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP INDEX IF EXISTS playlist_tags_tag_id_idx;`);
  await db.runSql(`DROP INDEX IF EXISTS playlist_tags_playlist_id_tag_id_idx;`);
  await db.runSql(`DROP TABLE IF EXISTS "playlist_tags" CASCADE;`);
};

exports._meta = { version: 1 };