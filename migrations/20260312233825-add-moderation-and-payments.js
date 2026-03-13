'use strict';

let dbm;
let type;
let seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  // reports table
  await db.runSql(`
    CREATE TABLE "reports" (
      "id"            uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
      "reporter_id"   uuid                 NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "resource_type" report_resource_type NOT NULL,
      "resource_id"   uuid                 NOT NULL,
      "reason"        varchar              NOT NULL,
      "description"   varchar(1000),
      "status"        report_status        NOT NULL DEFAULT 'pending',
      "resolved_by"   uuid                 REFERENCES "users" ("id") ON DELETE SET NULL,
      "admin_note"    text,
      "resolved_at"   timestamptz,
      "created_at"    timestamptz          NOT NULL DEFAULT now(),

      CONSTRAINT "reports_unique_per_user_resource"
        UNIQUE ("reporter_id", "resource_type", "resource_id")
    );
  `);

  // subscription_plans table
  await db.runSql(`
    CREATE TABLE "subscription_plans" (
      "id"             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"           subscription_plan NOT NULL UNIQUE,
      "price"          numeric(10,2)     NOT NULL DEFAULT 0,
      "duration_days"  integer,
      "track_limit"    integer,
      "playlist_limit" integer
    );
  `);

  // user_subscriptions table
  await db.runSql(`
    CREATE TABLE "user_subscriptions" (
      "id"                   uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"              uuid                NOT NULL REFERENCES "users"              ("id") ON DELETE CASCADE,
      "subscription_plan_id" uuid                NOT NULL REFERENCES "subscription_plans" ("id") ON DELETE RESTRICT,
      "status"               subscription_status NOT NULL DEFAULT 'pending',
      "start_date"           date                NOT NULL,
      "end_date"             date,
      "auto_renew"           boolean             NOT NULL DEFAULT false,
      "created_at"           timestamptz         NOT NULL DEFAULT now(),

      CONSTRAINT "user_subscriptions_date_order"
        CHECK (end_date IS NULL OR end_date > start_date)
    );
  `);

  // transactions table
  await db.runSql(`
    CREATE TABLE "transactions" (
      "id"                   uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_subscription_id" uuid           NOT NULL REFERENCES "user_subscriptions" ("id") ON DELETE CASCADE,
      "amount"               numeric(10,2)  NOT NULL,
      "payment_method"       payment_method NOT NULL DEFAULT 'mock',
      "payment_status"       payment_status NOT NULL DEFAULT 'pending',
      "paid_at"              timestamptz,
      "created_at"           timestamptz    NOT NULL DEFAULT now()
    );
  `);

  // Indexes 
  await db.runSql(`CREATE INDEX ON "reports"            ("reporter_id");`);
  await db.runSql(`CREATE INDEX ON "reports"            ("status");`);
  await db.runSql(`CREATE INDEX ON "user_subscriptions" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "user_subscriptions" ("status");`);
  await db.runSql(`CREATE INDEX ON "transactions"       ("user_subscription_id");`);
  await db.runSql(`CREATE INDEX ON "transactions"       ("payment_status");`);
};

exports.down = async function(db) {
  await db.runSql(`DROP TABLE IF EXISTS "transactions"       CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "user_subscriptions" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "subscription_plans" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "reports"            CASCADE;`);
};

exports._meta = {
  "version": 1
};
