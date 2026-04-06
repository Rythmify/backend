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
  // Fix race condition in reply_count updates
  // Problem: When 2 users add replies to the same comment simultaneously,
  // the counter might not increment correctly (race condition)
  // Solution: Use pg_advisory_xact_lock to lock parent comment during update

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_comment_reply_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      lock_id bigint;
    BEGIN
      IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        -- Convert UUID to bigint for locking
        -- This creates a unique lock per parent comment
        lock_id := ('x' || substring(NEW.parent_comment_id::text, 1, 16))::bit(64)::bigint;
        -- Acquire advisory lock (blocks other transactions trying to lock same parent)
        PERFORM pg_advisory_xact_lock(lock_id);
        -- Now safely increment counter
        UPDATE comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_comment_id;
      ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        -- Same locking mechanism for deletes
        lock_id := ('x' || substring(OLD.parent_comment_id::text, 1, 16))::bit(64)::bigint;
        PERFORM pg_advisory_xact_lock(lock_id);
        UPDATE comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_comment_id;
      END IF;
      RETURN NULL;
    END;
    $$;
  `);

  // Recreate the trigger with the fixed function
  await db.runSql(`
    DROP TRIGGER IF EXISTS trg_comment_reply_count ON "comments";
  `);

  await db.runSql(`
    CREATE TRIGGER trg_comment_reply_count
      AFTER INSERT OR DELETE ON "comments"
      FOR EACH ROW EXECUTE FUNCTION trg_comment_reply_count();
  `);
};

exports.down = async function (db) {
  // Revert to the original (non-locking) version
  await db.runSql(`
    DROP TRIGGER IF EXISTS trg_comment_reply_count ON "comments";
  `);

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

exports._meta = {
  version: 1,
};
