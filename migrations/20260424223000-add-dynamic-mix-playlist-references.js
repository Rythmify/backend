'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE "playlists"
      ADD COLUMN IF NOT EXISTS "genre_id" uuid REFERENCES "genres" ("id") ON DELETE SET NULL;
  `);

  await db.runSql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'playlist_type'
          AND e.enumlabel = 'curated_daily'
      ) THEN
        ALTER TYPE "playlist_type" ADD VALUE 'curated_daily';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'playlist_type'
          AND e.enumlabel = 'curated_weekly'
      ) THEN
        ALTER TYPE "playlist_type" ADD VALUE 'curated_weekly';
      END IF;
    END $$;
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS playlists_genre_id_idx
    ON "playlists" ("genre_id");
  `);

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
