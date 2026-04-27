'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  // Add 'track_radio' to playlist_type enum (safe, idempotent)
  await db.runSql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'track_radio'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'playlist_type')
      ) THEN
        ALTER TYPE playlist_type ADD VALUE 'track_radio';
      END IF;
    END $$;
  `);
};

exports.down = async function (db) {
  // NOTE: Postgres does not support removing enum values.
};

exports._meta = { version: 1 };
