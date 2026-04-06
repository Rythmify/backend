'use strict';

exports.setup = function (options, seedLink) {};

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE "playlists"
      ADD COLUMN IF NOT EXISTS "slug" varchar(255);
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS playlists_slug_idx
    ON "playlists" ("slug")
    WHERE deleted_at IS NULL;
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS playlists_slug_idx;`);
  await db.runSql(`
    ALTER TABLE "playlists"
      DROP COLUMN IF EXISTS "slug";
  `);
};

exports._meta = { version: 1 };
