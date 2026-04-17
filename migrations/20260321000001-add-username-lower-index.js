'use strict';

let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_users_lower_username 
    ON users (LOWER(username));
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP INDEX IF EXISTS idx_users_lower_username;
  `);
};

exports._meta = {
  version: 1,
};
