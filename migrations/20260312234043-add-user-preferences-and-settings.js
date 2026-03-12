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
  // user_preferences table
  await db.runSql(`
    CREATE TABLE "user_preferences" (
      "id"               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"          uuid          UNIQUE NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "autoplay"         boolean       NOT NULL DEFAULT true,
      "explicit_content" boolean       NOT NULL DEFAULT false,
      "audio_quality"    audio_quality NOT NULL DEFAULT 'normal',
      "language"         varchar       NOT NULL DEFAULT 'en',
      "theme"            varchar       NOT NULL DEFAULT 'dark',
      "created_at"       timestamptz   NOT NULL DEFAULT now(),
      "updated_at"       timestamptz
    );
  `);

  // user_content_settings table
  await db.runSql(`
    CREATE TABLE "user_content_settings" (
      "id"                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"                uuid         UNIQUE NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "rss_title"              varchar(200),
      "rss_language"           varchar(10)  NOT NULL DEFAULT 'en',
      "rss_category"           varchar(100),
      "rss_explicit"           boolean      NOT NULL DEFAULT false,
      "rss_show_email"         boolean      NOT NULL DEFAULT false,
      "default_include_in_rss" boolean      NOT NULL DEFAULT true,
      "default_license_type"   license_type NOT NULL DEFAULT 'all_rights_reserved',
      "created_at"             timestamptz  NOT NULL DEFAULT now(),
      "updated_at"             timestamptz
    );
  `);

  // user_privacy_settings table
  await db.runSql(`
    CREATE TABLE "user_privacy_settings" (
      "id"                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"                      uuid        UNIQUE NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "receive_messages_from_anyone" boolean     NOT NULL DEFAULT true,
      "show_activities_in_discovery" boolean     NOT NULL DEFAULT true,
      "show_as_top_fan"              boolean     NOT NULL DEFAULT true,
      "show_top_fans_on_tracks"      boolean     NOT NULL DEFAULT true,
      "created_at"                   timestamptz NOT NULL DEFAULT now(),
      "updated_at"                   timestamptz
    );
  `);

  // user_favorite_genres table
  await db.runSql(`
    CREATE TABLE "user_favorite_genres" (
      "id"       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"  uuid NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "genre_id" uuid NOT NULL REFERENCES "genres" ("id") ON DELETE CASCADE
    );
  `);

  // user_favorite_tags table
  await db.runSql(`
    CREATE TABLE "user_favorite_tags" (
      "id"      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "tag_id"  uuid NOT NULL REFERENCES "tags"  ("id") ON DELETE CASCADE
    );
  `);

  // recent_searches table
  await db.runSql(`
    CREATE TABLE "recent_searches" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "query"      varchar,
      "type"       search_type,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await db.runSql(`CREATE UNIQUE INDEX ON "user_favorite_genres" ("user_id", "genre_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "user_favorite_tags"   ("user_id", "tag_id");`);
  await db.runSql(`CREATE INDEX ON "recent_searches" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "recent_searches" ("created_at");`);

  // Triggers
  await db.runSql(`
    CREATE TRIGGER trg_user_preferences_updated_at
      BEFORE UPDATE ON "user_preferences"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
  await db.runSql(`
    CREATE TRIGGER trg_user_content_settings_updated_at
      BEFORE UPDATE ON "user_content_settings"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
  await db.runSql(`
    CREATE TRIGGER trg_user_privacy_settings_updated_at
      BEFORE UPDATE ON "user_privacy_settings"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // Cap recent_searches at 20 per user
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_recent_searches_cap()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM recent_searches
      WHERE user_id = NEW.user_id
        AND id NOT IN (
          SELECT id FROM recent_searches
          WHERE user_id = NEW.user_id
          ORDER BY created_at DESC
          LIMIT 20
        );
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_recent_searches_cap
      AFTER INSERT ON "recent_searches"
      FOR EACH ROW EXECUTE FUNCTION trg_recent_searches_cap();
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_recent_searches_cap              ON "recent_searches";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_user_privacy_settings_updated_at ON "user_privacy_settings";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_user_content_settings_updated_at ON "user_content_settings";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_user_preferences_updated_at      ON "user_preferences";`);

  await db.runSql(`DROP FUNCTION IF EXISTS trg_recent_searches_cap();`);

  await db.runSql(`DROP TABLE IF EXISTS "recent_searches"       CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "user_favorite_tags"    CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "user_favorite_genres"  CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "user_privacy_settings" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "user_content_settings" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "user_preferences"      CASCADE;`);
};

exports._meta = {
  "version": 1
};
