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
  // push_tokens table
  await db.runSql(`
    CREATE TABLE "push_tokens" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "token"      varchar     NOT NULL,
      "platform"   varchar     NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz
    );
  `);

  // notifications table
  await db.runSql(`
    CREATE TABLE "notifications" (
      "id"             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"        uuid              NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "action_user_id" uuid              REFERENCES "users" ("id") ON DELETE CASCADE,
      "type"           notification_type NOT NULL,
      "reference_id"   uuid,
      "reference_type" reference_type,
      "is_read"        boolean           NOT NULL DEFAULT false,
      "created_at"     timestamptz       NOT NULL DEFAULT now(),

      CONSTRAINT "notifications_no_self_notify"
        CHECK (user_id <> action_user_id)
    );
  `);

  // notification_preferences table
  await db.runSql(`
    CREATE TABLE "notification_preferences" (
      "id"      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid UNIQUE NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,

      -- Follower notifications
      "new_follower_in_app"          boolean NOT NULL DEFAULT true,
      "new_follower_push"            boolean NOT NULL DEFAULT true,
      "new_follower_email"           boolean NOT NULL DEFAULT false,

      -- Repost notifications
      "repost_of_your_post_in_app"   boolean NOT NULL DEFAULT true,
      "repost_of_your_post_push"     boolean NOT NULL DEFAULT true,
      "repost_of_your_post_email"    boolean NOT NULL DEFAULT false,

      -- New post by followed
      "new_post_by_followed_in_app"  boolean NOT NULL DEFAULT true,
      "new_post_by_followed_push"    boolean NOT NULL DEFAULT false,
      "new_post_by_followed_email"   boolean NOT NULL DEFAULT false,

      -- Likes and plays
      "likes_and_plays_in_app"       boolean NOT NULL DEFAULT true,
      "likes_and_plays_push"         boolean NOT NULL DEFAULT false,
      "likes_and_plays_email"        boolean NOT NULL DEFAULT false,

      -- Comments
      "comment_on_post_in_app"       boolean NOT NULL DEFAULT true,
      "comment_on_post_push"         boolean NOT NULL DEFAULT true,
      "comment_on_post_email"        boolean NOT NULL DEFAULT false,

      -- Recommended content
      "recommended_content_in_app"   boolean NOT NULL DEFAULT true,
      "recommended_content_push"     boolean NOT NULL DEFAULT false,
      "recommended_content_email"    boolean NOT NULL DEFAULT false,

      -- Messages
      "new_message_in_app"           boolean NOT NULL DEFAULT true,
      "new_message_push"             boolean NOT NULL DEFAULT true,
      "messages_from"                messages_from_type NOT NULL DEFAULT 'everyone',

      -- Updates & marketing
      "feature_updates_push"         boolean NOT NULL DEFAULT true,
      "feature_updates_email"        boolean NOT NULL DEFAULT true,
      "surveys_and_feedback_push"    boolean NOT NULL DEFAULT false,
      "surveys_and_feedback_email"   boolean NOT NULL DEFAULT false,
      "promotional_content_push"     boolean NOT NULL DEFAULT false,
      "promotional_content_email"    boolean NOT NULL DEFAULT false,
      "newsletter_email"             boolean NOT NULL DEFAULT false,

      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz
    );
  `);

  // Indexes 
  await db.runSql(`CREATE INDEX ON "push_tokens"   ("user_id");`);
  await db.runSql(`CREATE INDEX ON "notifications" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "notifications" ("action_user_id");`);
  await db.runSql(`CREATE INDEX ON "notifications" ("is_read");`);
  await db.runSql(`CREATE INDEX ON "notifications" ("created_at");`);

  // Triggers
  await db.runSql(`
    CREATE TRIGGER trg_push_tokens_updated_at
      BEFORE UPDATE ON "push_tokens"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
  await db.runSql(`
    CREATE TRIGGER trg_notification_preferences_updated_at
      BEFORE UPDATE ON "notification_preferences"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON "notification_preferences";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_push_tokens_updated_at ON "push_tokens";`);

  await db.runSql(`DROP TABLE IF EXISTS "notification_preferences" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "notifications"            CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "push_tokens"              CASCADE;`);
};

exports._meta = {
  "version": 1
};
