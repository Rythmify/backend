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
  // comments table
  await db.runSql(`
    CREATE TABLE "comments" (
      "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"           uuid        NOT NULL REFERENCES "users"    ("id") ON DELETE CASCADE,
      "track_id"          uuid        NOT NULL REFERENCES "tracks"   ("id") ON DELETE CASCADE,
      "parent_comment_id" uuid        REFERENCES "comments" ("id") ON DELETE SET NULL,
      "content"           text        NOT NULL,
      "track_timestamp"   integer,
      "like_count"        integer     NOT NULL DEFAULT 0,
      "reply_count"       integer     NOT NULL DEFAULT 0,
      "deleted_at"        timestamptz,
      "created_at"        timestamptz NOT NULL DEFAULT now(),
      "updated_at"        timestamptz
    );
  `);

  // track_likes table
  await db.runSql(`
    CREATE TABLE "track_likes" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "track_id"   uuid        NOT NULL REFERENCES "tracks" ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // track_reposts table
  await db.runSql(`
    CREATE TABLE "track_reposts" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "track_id"   uuid        NOT NULL REFERENCES "tracks" ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // comment_likes table
  await db.runSql(`
    CREATE TABLE "comment_likes" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users"    ("id") ON DELETE CASCADE,
      "comment_id" uuid        NOT NULL REFERENCES "comments" ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await db.runSql(`CREATE INDEX ON "comments" ("track_id");`);
  await db.runSql(`CREATE INDEX ON "comments" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "comments" ("parent_comment_id");`);
  await db.runSql(`CREATE INDEX ON "comments" ("deleted_at") WHERE "deleted_at" IS NOT NULL;`);

  await db.runSql(`CREATE UNIQUE INDEX ON "track_likes"   ("user_id", "track_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "track_reposts" ("user_id", "track_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "comment_likes" ("user_id", "comment_id");`);

  // Triggers
  await db.runSql(`
    CREATE TRIGGER trg_comments_updated_at
      BEFORE UPDATE ON "comments"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // track like_count
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_track_like_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('tracks', 'like_count', NEW.track_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('tracks', 'like_count', OLD.track_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_track_like_count
      AFTER INSERT OR DELETE ON "track_likes"
      FOR EACH ROW EXECUTE FUNCTION trg_track_like_count();
  `);

  // track repost_count
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_track_repost_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('tracks', 'repost_count', NEW.track_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('tracks', 'repost_count', OLD.track_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_track_repost_count
      AFTER INSERT OR DELETE ON "track_reposts"
      FOR EACH ROW EXECUTE FUNCTION trg_track_repost_count();
  `);

  // track comment_count
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_track_comment_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('tracks', 'comment_count', NEW.track_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('tracks', 'comment_count', OLD.track_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_track_comment_count
      AFTER INSERT OR DELETE ON "comments"
      FOR EACH ROW EXECUTE FUNCTION trg_track_comment_count();
  `);

  // comment like_count
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_comment_like_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('comments', 'like_count', NEW.comment_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('comments', 'like_count', OLD.comment_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_comment_like_count
      AFTER INSERT OR DELETE ON "comment_likes"
      FOR EACH ROW EXECUTE FUNCTION trg_comment_like_count();
  `);

  // comment reply_count
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_comment_reply_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        PERFORM increment_counter('comments', 'reply_count', NEW.parent_comment_id,  1);
      ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        PERFORM increment_counter('comments', 'reply_count', OLD.parent_comment_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_comment_reply_count
      AFTER INSERT OR DELETE ON "comments"
      FOR EACH ROW EXECUTE FUNCTION trg_comment_reply_count();
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_comment_reply_count ON "comments";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_comment_like_count  ON "comment_likes";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_track_comment_count ON "comments";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_track_repost_count  ON "track_reposts";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_track_like_count    ON "track_likes";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_comments_updated_at ON "comments";`);

  await db.runSql(`DROP FUNCTION IF EXISTS trg_comment_reply_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_comment_like_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_track_comment_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_track_repost_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_track_like_count();`);

  await db.runSql(`DROP TABLE IF EXISTS "comment_likes"  CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "track_reposts"  CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "track_likes"    CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "comments"       CASCADE;`);
};

exports._meta = {
  version: 1,
};
