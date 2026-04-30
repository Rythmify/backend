'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  // Add 'genre_trending' to playlist_type enum (safe, idempotent)
  // The partial index using this value must be created in a SEPARATE migration
  // because Postgres does not allow new enum values to be used in the same transaction.
  await db.runSql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'genre_trending'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'playlist_type')
      ) THEN
        ALTER TYPE playlist_type ADD VALUE 'genre_trending';
      END IF;
    END $$;
  `);
};

exports.down = async function (db) {
  // NOTE: Postgres does not support removing enum values.
};

exports._meta = { version: 1 };
