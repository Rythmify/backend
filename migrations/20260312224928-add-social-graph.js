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
  // follows table
  await db.runSql(`
    CREATE TABLE "follows" (
      "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "follower_id"  uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "following_id" uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "created_at"   timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT "follows_unique_pair"
        UNIQUE ("follower_id", "following_id"),

      CONSTRAINT "follows_no_self_follow"
        CHECK (follower_id <> following_id)
    );
  `);

  // blocks table
  await db.runSql(`
    CREATE TABLE "blocks" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "blocker_id" uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "blocked_id" uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT "blocks_unique_pair"
        UNIQUE ("blocker_id", "blocked_id"),

      CONSTRAINT "blocks_no_self_block"
        CHECK (blocker_id <> blocked_id)
    );
  `);

  // Indexes
  await db.runSql(`CREATE INDEX ON "follows" ("follower_id");`);
  await db.runSql(`CREATE INDEX ON "follows" ("following_id");`);

  // Triggers
  await db.runSql(`
    CREATE OR REPLACE FUNCTION increment_counter(
      tbl    text,
      col    text,
      row_id uuid,
      delta  integer
    ) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      EXECUTE format(
        'UPDATE %I SET %I = %I + $1 WHERE id = $2',
        tbl, col, col
      ) USING delta, row_id;
    END;
    $$;
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_follow_counts()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('users', 'following_count', NEW.follower_id,   1);
        PERFORM increment_counter('users', 'followers_count', NEW.following_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('users', 'following_count', OLD.follower_id,  -1);
        PERFORM increment_counter('users', 'followers_count', OLD.following_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);

  await db.runSql(`
    CREATE TRIGGER trg_follow_counts
      AFTER INSERT OR DELETE ON "follows"
      FOR EACH ROW EXECUTE FUNCTION trg_follow_counts();
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_follow_counts ON "follows";`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_follow_counts();`);
  await db.runSql(`DROP FUNCTION IF EXISTS increment_counter(text, text, uuid, integer);`);

  await db.runSql(`DROP TABLE IF EXISTS "blocks" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "follows" CASCADE;`);
};

exports._meta = {
  version: 1,
};
