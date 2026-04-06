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
  // Create follow_request_status enum type if it doesn't exist
  await db.runSql(`
    DO $$ BEGIN
      CREATE TYPE follow_request_status AS ENUM ('pending', 'accepted', 'rejected');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // follow_requests table for managing follow requests to private accounts
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS "follow_requests" (
      "id"             uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
      "follower_id"    uuid                    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "following_id"   uuid                    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "status"         follow_request_status   NOT NULL DEFAULT 'pending',
      "created_at"     timestamptz             NOT NULL DEFAULT now(),
      "updated_at"     timestamptz             NOT NULL DEFAULT now(),
      CONSTRAINT follow_request_unique UNIQUE ("follower_id", "following_id")
    );
  `);

  // Index on following_id for finding pending requests for a user
  await db.runSql(`
    CREATE INDEX IF NOT EXISTS "idx_follow_requests_following_id_status" 
    ON "follow_requests" ("following_id", "status");
  `);

  // Index on follower_id for finding sent requests
  await db.runSql(`
    CREATE INDEX IF NOT EXISTS "idx_follow_requests_follower_id_status" 
    ON "follow_requests" ("follower_id", "status");
  `);

  // Trigger to update updated_at timestamp
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_update_follow_requests_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.runSql(`
    CREATE TRIGGER trg_follow_requests_update_timestamp
    BEFORE UPDATE ON "follow_requests"
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_follow_requests_timestamp();
  `);
};

exports.down = async function (db) {
  // Drop trigger and function
  await db.runSql(
    'DROP TRIGGER IF EXISTS trg_follow_requests_update_timestamp ON "follow_requests"'
  );
  await db.runSql('DROP FUNCTION IF EXISTS trg_update_follow_requests_timestamp()');

  // Drop indexes
  await db.runSql('DROP INDEX IF EXISTS "idx_follow_requests_following_id_status"');
  await db.runSql('DROP INDEX IF EXISTS "idx_follow_requests_follower_id_status"');

  // Drop table
  await db.runSql('DROP TABLE IF EXISTS "follow_requests"');

  // Drop enum type
  await db.runSql('DROP TYPE IF EXISTS follow_request_status');
};
