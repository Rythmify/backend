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
  // users table
  await db.runSql(`
    CREATE TABLE "users" (
      "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "email"             citext      UNIQUE NOT NULL,
      "password_hashed"   varchar,
      "username"          varchar(30) UNIQUE,
      "display_name"      varchar(50) NOT NULL,
      "first_name"        varchar(50),
      "last_name"         varchar(50),
      "bio"               text,
      "city"              varchar(100),
      "country"           varchar(2),
      "gender"            gender_type,
      "date_of_birth"     date,
      "role"              user_role   NOT NULL DEFAULT 'listener',
      "profile_picture"   varchar,
      "cover_photo"       varchar,
      "is_private"        boolean     NOT NULL DEFAULT false,
      "is_verified"       boolean     NOT NULL DEFAULT false,
      "is_suspended"      boolean     NOT NULL DEFAULT false,
      "suspended_at"      timestamptz,
      "suspension_reason" varchar(500),
      "followers_count"   integer     NOT NULL DEFAULT 0,
      "following_count"   integer     NOT NULL DEFAULT 0,
      "twofa_enabled"     boolean     NOT NULL DEFAULT false,
      "twofa_secret"      varchar,
      "last_login_at"     timestamptz,
      "search_vector"     tsvector,
      "deleted_at"        timestamptz,
      "created_at"        timestamptz NOT NULL DEFAULT now(),
      "updated_at"        timestamptz,

      CONSTRAINT "users_username_format"
        CHECK (username ~ '^[a-z0-9_-]+$'),

      CONSTRAINT "users_suspension_consistency"
        CHECK (
          (is_suspended = false AND suspended_at IS NULL) OR
          (is_suspended = true  AND suspended_at IS NOT NULL)
        )
    );
  `);

  // oauth_connections table
  await db.runSql(`
    CREATE TABLE "oauth_connections" (
      "id"               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"          uuid           NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "provider"         oauth_provider NOT NULL,
      "provider_user_id" varchar        NOT NULL,
      "access_token"     varchar,
      "refresh_token"    varchar,
      "expires_at"       timestamptz,
      "created_at"       timestamptz    NOT NULL DEFAULT now(),
      "updated_at"       timestamptz,

      CONSTRAINT "oauth_connections_provider_user_unique"
        UNIQUE ("provider", "provider_user_id"),

      CONSTRAINT "oauth_connections_user_provider_unique"
        UNIQUE ("user_id", "provider")
    );
  `);

  // verification_tokens table
  await db.runSql(`
    CREATE TABLE "verification_tokens" (
      "id"         uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid                    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "token"      varchar                 UNIQUE NOT NULL,
      "type"       verification_token_type NOT NULL,
      "expires_at" timestamptz             NOT NULL,
      "used_at"    timestamptz,
      "revoked"    boolean                 NOT NULL DEFAULT false,
      "created_at" timestamptz             NOT NULL DEFAULT now()
    );
  `);

  // refresh_tokens table
  await db.runSql(`
    CREATE TABLE "refresh_tokens" (
      "id"            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"       uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "refresh_token" varchar     UNIQUE NOT NULL,
      "expires_at"    timestamptz NOT NULL,
      "revoked"       boolean     NOT NULL DEFAULT false,
      "created_at"    timestamptz NOT NULL DEFAULT now()
    );
  `);

  // web_profiles table
  await db.runSql(`
    CREATE TABLE "web_profiles" (
      "id"         uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid                 NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "platform"   web_profile_platform NOT NULL,
      "url"        varchar              NOT NULL,
      "created_at" timestamptz          NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await db.runSql(`CREATE INDEX ON "users" ("email");`);
  await db.runSql(`CREATE INDEX ON "users" ("username");`);
  await db.runSql(`CREATE INDEX ON "users" ("role");`);
  await db.runSql(`CREATE INDEX ON "users" USING GIN ("search_vector");`);
  await db.runSql(`CREATE INDEX ON "users" ("deleted_at") WHERE "deleted_at" IS NOT NULL;`);
  await db.runSql(`CREATE INDEX ON "oauth_connections" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "verification_tokens" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "refresh_tokens" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "web_profiles" ("user_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "web_profiles" ("user_id", "platform");`);

  // Triggers
  await db.runSql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
  `);

  await db.runSql(`
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON "users"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_users_search_vector()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english',
        NEW.display_name || ' ' || COALESCE(NEW.username, '')
      );
      RETURN NEW;
    END;
    $$;
  `);

  await db.runSql(`
    CREATE TRIGGER trg_users_search_vector
      BEFORE INSERT OR UPDATE OF display_name, username ON "users"
      FOR EACH ROW EXECUTE FUNCTION trg_users_search_vector();
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_users_search_vector ON "users";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_users_updated_at ON "users";`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_users_search_vector();`);
  await db.runSql(`DROP FUNCTION IF EXISTS set_updated_at() CASCADE;`);

  await db.runSql(`DROP TABLE IF EXISTS "web_profiles" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "verification_tokens" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "oauth_connections" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "users" CASCADE;`);
};

exports._meta = {
  version: 1,
};
