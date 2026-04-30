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
  // Add notification type for when user becomes an artist pro
  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'artist_pro_activated' AFTER 'user_suspended';
  `);
};

exports.down = async function (db) {
};

exports._meta = {
  version: 1,
};
