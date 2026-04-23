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
  await db.runSql(`
    ALTER TYPE messages_from_type ADD VALUE IF NOT EXISTS 'nobody';
  `);
};

exports.down = async function (db) {
  // PostgreSQL does not support removing a single enum value — intentional no-op
  console.warn('Cannot roll back enum value addition in PostgreSQL.');
};

exports._meta = {
  version: 1,
};
