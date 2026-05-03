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

exports.up = function (db) {
  return db.runSql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS pending_email TEXT DEFAULT NULL;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS pending_email;
  `);
};

exports._meta = {
  version: 1,
};
