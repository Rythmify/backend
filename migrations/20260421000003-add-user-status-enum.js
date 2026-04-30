'use strict';

let dbm;
let type;
let seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // Create user_status enum type
  await db.runSql(`
    CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
  `);

  // Add status column to users table
  await db.runSql(`
    ALTER TABLE "users"
    ADD COLUMN "status" user_status NOT NULL DEFAULT 'active';
  `);

  // Add index on status for filtering
  await db.runSql(`
    CREATE INDEX "users_status_idx" ON "users" ("status");
  `);

  // Migrate existing data: set status based on is_suspended
  await db.runSql(`
    UPDATE "users"
    SET "status" = CASE
      WHEN is_suspended = true THEN 'suspended'::user_status
      ELSE 'active'::user_status
    END
    WHERE deleted_at IS NULL;
  `);

  // Set status to 'deleted' for soft-deleted users
  await db.runSql(`
    UPDATE "users"
    SET "status" = 'deleted'::user_status
    WHERE deleted_at IS NOT NULL;
  `);
};

exports.down = async function (db) {
  // Remove status column from users table
  await db.runSql(`
    ALTER TABLE "users"
    DROP COLUMN "status";
  `);

  // Drop user_status enum type
  await db.runSql(`
    DROP TYPE user_status;
  `);
};
