'use strict';

let dbm;
let type;
let seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // Full composite index for deterministic comment sorting and waveform filtering
  // Covers: filtering by track_id + timestamp range + complete sorting (no in-memory sort)
  // Sorting order: track_timestamp ASC, created_at ASC, id ASC
  // This ensures: zero randomness, fast pagination, optimal performance
  await db.runSql(`
    CREATE INDEX ON "comments" ("track_id", "track_timestamp", "created_at", "id");
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS "comments_track_id_track_timestamp_created_at_id_idx";`);
};

exports._meta = {
  version: 1,
};
