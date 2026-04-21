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
    ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS new_message_email boolean NOT NULL DEFAULT false;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    ALTER TABLE notification_preferences
    DROP COLUMN IF EXISTS new_message_email;
  `);
};

exports._meta = {
  version: 1,
};