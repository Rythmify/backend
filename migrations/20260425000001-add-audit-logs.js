// migrations/20260425000001-add-audit-logs.js
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
    CREATE TABLE "audit_logs" (
      "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "admin_id"    uuid        NOT NULL REFERENCES "users" ("id") ON DELETE SET NULL,
      "action"      varchar     NOT NULL,
      "target_type" varchar     NOT NULL,
      "target_id"   uuid        NOT NULL,
      "metadata"    jsonb       NOT NULL DEFAULT '{}',
      "created_at"  timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.runSql(`CREATE INDEX ON "audit_logs" ("admin_id");`);
  await db.runSql(`CREATE INDEX ON "audit_logs" ("target_id");`);
  await db.runSql(`CREATE INDEX ON "audit_logs" ("action");`);
  await db.runSql(`CREATE INDEX ON "audit_logs" ("created_at");`);
};

exports.down = async function (db) {
  await db.runSql(`DROP TABLE IF EXISTS "audit_logs" CASCADE;`);
};

exports._meta = {
  version: 1,
};