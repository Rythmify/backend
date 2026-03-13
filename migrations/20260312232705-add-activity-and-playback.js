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
  // activities table
  await db.runSql(`
    CREATE TABLE "activities" (
      "id"             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"        uuid           NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "type"           activity_type  NOT NULL,
      "reference_id"   uuid,
      "reference_type" reference_type,
      "target_user_id" uuid           REFERENCES "users" ("id") ON DELETE CASCADE,
      "created_at"     timestamptz    NOT NULL DEFAULT now()
    );
  `);

  // listening_history table
  await db.runSql(`
    CREATE TABLE "listening_history" (
      "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"         uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "track_id"        uuid        NOT NULL REFERENCES "tracks" ("id") ON DELETE CASCADE,
      "duration_played" integer     NOT NULL DEFAULT 0,
      "played_at"       timestamptz NOT NULL DEFAULT now()
    );
  `);

  // player_state table
  await db.runSql(`
    CREATE TABLE "player_state" (
      "id"               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"          uuid          UNIQUE NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "track_id"         uuid          REFERENCES "tracks" ("id") ON DELETE SET NULL,
      "position_seconds" numeric(10,2) NOT NULL DEFAULT 0,
      "volume"           numeric(4,2)  NOT NULL DEFAULT 1.0,
      "queue"            jsonb,
      "updated_at"       timestamptz   NOT NULL DEFAULT now(),

      CONSTRAINT "player_state_volume_range"
        CHECK (volume >= 0 AND volume <= 1)
    );
  `);

  // Indexes
  await db.runSql(`CREATE INDEX ON "activities"        ("user_id");`);
  await db.runSql(`CREATE INDEX ON "activities"        ("target_user_id");`);
  await db.runSql(`CREATE INDEX ON "activities"        ("created_at");`);
  await db.runSql(`CREATE INDEX ON "listening_history" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "listening_history" ("track_id");`);
  await db.runSql(`CREATE INDEX ON "listening_history" ("played_at");`);

  // Triggers 
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_track_play_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM increment_counter('tracks', 'play_count', NEW.track_id, 1);
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_track_play_count
      AFTER INSERT ON "listening_history"
      FOR EACH ROW EXECUTE FUNCTION trg_track_play_count();
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_track_play_count ON "listening_history";`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_track_play_count();`);

  await db.runSql(`DROP TABLE IF EXISTS "player_state"      CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "listening_history" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "activities"        CASCADE;`);
};

exports._meta = {
  "version": 1
};
