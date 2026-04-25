'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS playlists_daily_mix_user_unique_idx
    ON "playlists" ("user_id")
    WHERE "type"::text = 'curated_daily' AND "deleted_at" IS NULL;
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS playlists_weekly_mix_user_unique_idx
    ON "playlists" ("user_id")
    WHERE "type"::text = 'curated_weekly' AND "deleted_at" IS NULL;
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS playlists_genre_mix_user_genre_unique_idx
    ON "playlists" ("user_id", "genre_id")
    WHERE "type"::text = 'auto_generated'
      AND "genre_id" IS NOT NULL
      AND "deleted_at" IS NULL;
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS playlists_genre_mix_user_genre_unique_idx;`);
  await db.runSql(`DROP INDEX IF EXISTS playlists_weekly_mix_user_unique_idx;`);
  await db.runSql(`DROP INDEX IF EXISTS playlists_daily_mix_user_unique_idx;`);
};

exports._meta = { version: 1 };
