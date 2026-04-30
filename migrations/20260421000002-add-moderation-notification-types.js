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
  // Add new notification types for moderation
  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'report_received' AFTER 'new_post_by_followed';
  `);

  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'report_resolved' AFTER 'report_received';
  `);

  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'appeal_submitted' AFTER 'report_resolved';
  `);

  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'appeal_reviewed' AFTER 'appeal_submitted';
  `);

  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'user_warned' AFTER 'appeal_reviewed';
  `);

  await db.runSql(`
    ALTER TYPE "notification_type" ADD VALUE 'user_suspended' AFTER 'user_warned';
  `);
};

exports.down = async function (db) {
  // Note: PostgreSQL doesn't support removing values from existing enums
  // So we skip the down migration for enum values already added
};

exports._meta = {
  version: 1,
};
