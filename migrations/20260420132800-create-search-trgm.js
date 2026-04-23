'use strict';

let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // Enable pg_trgm extension for fuzzy (similarity) search
  await db.runSql(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  // GIN trigram indexes — used by similarity() and ILIKE for fuzzy matching
  await db.runSql(`CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm      ON "tracks"    USING GIN (title      gin_trgm_ops) WHERE deleted_at IS NULL;`);
  await db.runSql(`CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm ON "users"     USING GIN (display_name gin_trgm_ops) WHERE deleted_at IS NULL;`);
  await db.runSql(`CREATE INDEX IF NOT EXISTS idx_users_username_trgm     ON "users"     USING GIN (username    gin_trgm_ops) WHERE deleted_at IS NULL;`);
  await db.runSql(`CREATE INDEX IF NOT EXISTS idx_playlists_name_trgm     ON "playlists" USING GIN (name        gin_trgm_ops) WHERE deleted_at IS NULL;`);

  // play_count index — needed for sort=plays on tracks
  await db.runSql(`CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON "tracks" (play_count DESC) WHERE deleted_at IS NULL;`);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS idx_tracks_play_count;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_playlists_name_trgm;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_users_username_trgm;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_users_display_name_trgm;`);
  await db.runSql(`DROP INDEX IF EXISTS idx_tracks_title_trgm;`);
  // Note: we do NOT drop the extension itself — other parts of the app may use it.
};

exports._meta = {
  version: 1,
};