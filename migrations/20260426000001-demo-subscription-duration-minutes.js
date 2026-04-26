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
    ALTER TABLE subscription_plans
      ADD COLUMN IF NOT EXISTS duration_minutes integer;
  `);

  await db.runSql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subscription_plans_duration_minutes_positive'
      ) THEN
        ALTER TABLE subscription_plans
          ADD CONSTRAINT subscription_plans_duration_minutes_positive
          CHECK (duration_minutes IS NULL OR duration_minutes > 0);
      END IF;
    END $$;
  `);

  await db.runSql(`
    UPDATE subscription_plans
    SET duration_days = NULL,
        duration_minutes = NULL,
        track_limit = 3,
        playlist_limit = 2
    WHERE name = 'free';
  `);

  await db.runSql(`
    UPDATE subscription_plans
    SET duration_days = NULL,
        duration_minutes = 5,
        track_limit = NULL,
        playlist_limit = NULL
    WHERE name = 'premium';
  `);

  await db.runSql(`
    ALTER TABLE user_subscriptions
      ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz,
      ALTER COLUMN end_date TYPE timestamptz USING end_date::timestamptz;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    UPDATE subscription_plans
    SET duration_days = 30
    WHERE name = 'premium';
  `);

  // Keep subscription dates as timestamptz on rollback. Truncating active 5-minute
  // windows back to date can violate the existing end_date > start_date check.

  await db.runSql(`
    ALTER TABLE subscription_plans
      DROP CONSTRAINT IF EXISTS subscription_plans_duration_minutes_positive;
  `);

  await db.runSql(`
    ALTER TABLE subscription_plans
      DROP COLUMN IF EXISTS duration_minutes;
  `);
};

exports._meta = {
  version: 1,
};
