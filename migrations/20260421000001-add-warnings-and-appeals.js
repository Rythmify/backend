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
  // Create appeal_status enum first (needed for appeals table)
  await db.runSql(`
    CREATE TYPE "appeal_status" AS ENUM (
      'pending', 'upheld', 'overturned'
    );
  `);

  // warnings table - Track admin warnings to users
  await db.runSql(`
    CREATE TABLE "warnings" (
      "id"            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"       uuid          NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "admin_id"      uuid          NOT NULL REFERENCES "users" ("id") ON DELETE SET NULL,
      "reason"        varchar       NOT NULL,
      "message"       text,
      "warning_count" integer       NOT NULL DEFAULT 1,
      "created_at"    timestamptz   NOT NULL DEFAULT now(),
      
      CONSTRAINT "warnings_valid_admin_role"
        CHECK (admin_id IS NOT NULL)
    );
  `);

  // appeals table - Track report appeals and decisions
  await db.runSql(`
    CREATE TABLE "appeals" (
      "id"              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      "report_id"       uuid          NOT NULL REFERENCES "reports" ("id") ON DELETE CASCADE,
      "user_id"         uuid          NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "appeal_reason"   text          NOT NULL,
      "status"          appeal_status NOT NULL DEFAULT 'pending',
      "admin_notes"     text,
      "decided_by"      uuid          REFERENCES "users" ("id") ON DELETE SET NULL,
      "decision"        varchar(20),
      "decided_at"      timestamptz,
      "created_at"      timestamptz   NOT NULL DEFAULT now(),
      
      CONSTRAINT "appeals_unique_per_report"
        UNIQUE ("report_id"),
      CONSTRAINT "appeals_decision_requires_decided_by"
        CHECK ((status = 'pending' AND decided_by IS NULL) OR (status != 'pending' AND decided_by IS NOT NULL))
    );
  `);

  // Indexes for performance
  await db.runSql(`CREATE INDEX ON "warnings"  ("user_id");`);
  await db.runSql(`CREATE INDEX ON "warnings"  ("admin_id");`);
  await db.runSql(`CREATE INDEX ON "warnings"  ("created_at");`);
  await db.runSql(`CREATE INDEX ON "appeals"   ("report_id");`);
  await db.runSql(`CREATE INDEX ON "appeals"   ("user_id");`);
  await db.runSql(`CREATE INDEX ON "appeals"   ("status");`);
  await db.runSql(`CREATE INDEX ON "appeals"   ("created_at");`);
};

exports.down = async function (db) {
  await db.runSql(`DROP TABLE IF EXISTS "appeals"   CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "warnings"  CASCADE;`);
  await db.runSql(`DROP TYPE IF EXISTS "appeal_status" CASCADE;`);
};

exports._meta = {
  version: 1,
};
