'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE "listening_history"
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS listening_history_deleted_at_idx
    ON "listening_history" ("deleted_at")
    WHERE "deleted_at" IS NOT NULL;
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS listening_history_deleted_at_idx;`);
  await db.runSql(`ALTER TABLE "listening_history" DROP COLUMN IF EXISTS "deleted_at";`);
};

exports._meta = { version: 1 };
