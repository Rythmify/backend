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
  // If the original migration already ran, normalize audit_logs indexes.
  await db.runSql(`DROP INDEX IF EXISTS "audit_logs_admin_id_idx";`);
  await db.runSql(`DROP INDEX IF EXISTS "audit_logs_created_at_idx";`);
  await db.runSql(
    `CREATE INDEX IF NOT EXISTS "audit_logs_admin_created_idx" ON "audit_logs" ("admin_id", "created_at");`
  );
  await db.runSql(
    `CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");`
  );

  // FK correction note:
  // PostgreSQL cannot safely mutate unknown existing constraints without exact names from runtime metadata.
  // If prior migrations already applied ON DELETE SET NULL while admin_id is NOT NULL, apply one of these
  // manual DBA steps per environment:
  // 1) Drop/recreate the affected FK constraints with ON DELETE RESTRICT, or
  // 2) Recreate the affected tables with corrected FK definitions.
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS "audit_logs_admin_created_idx";`);
  await db.runSql(`DROP INDEX IF EXISTS "audit_logs_created_at_idx";`);
  await db.runSql(`CREATE INDEX IF NOT EXISTS "audit_logs_admin_id_idx" ON "audit_logs" ("admin_id");`);
  await db.runSql(`CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");`);
};

exports._meta = {
  version: 1,
};
