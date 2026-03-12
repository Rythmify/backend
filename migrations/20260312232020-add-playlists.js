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
  // playlists table
  await db.runSql(`
    CREATE TABLE "playlists" (
      "id"            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"          varchar       NOT NULL,
      "description"   text,
      "cover_image"   varchar,
      "type"          playlist_type NOT NULL DEFAULT 'regular',
      "is_public"     boolean       NOT NULL DEFAULT true,
      "secret_token"  varchar       UNIQUE,
      "user_id"       uuid          NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "like_count"    integer       NOT NULL DEFAULT 0,
      "repost_count"  integer       NOT NULL DEFAULT 0,
      "track_count"   integer       NOT NULL DEFAULT 0,
      "search_vector" tsvector,
      "deleted_at"    timestamptz,
      "created_at"    timestamptz   NOT NULL DEFAULT now(),
      "updated_at"    timestamptz
    );
  `);

  // playlist_tracks table
  await db.runSql(`
    CREATE TABLE "playlist_tracks" (
      "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "playlist_id" uuid        NOT NULL REFERENCES "playlists" ("id") ON DELETE CASCADE,
      "track_id"    uuid        NOT NULL REFERENCES "tracks"    ("id") ON DELETE CASCADE,
      "position"    integer,
      "added_at"    timestamptz NOT NULL DEFAULT now()
    );
  `);

  // playlist_likes table
  await db.runSql(`
    CREATE TABLE "playlist_likes" (
      "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"     uuid        NOT NULL REFERENCES "users"     ("id") ON DELETE CASCADE,
      "playlist_id" uuid        NOT NULL REFERENCES "playlists" ("id") ON DELETE CASCADE,
      "created_at"  timestamptz NOT NULL DEFAULT now()
    );
  `);

  // playlist_reposts table
  await db.runSql(`
    CREATE TABLE "playlist_reposts" (
      "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"     uuid        NOT NULL REFERENCES "users"     ("id") ON DELETE CASCADE,
      "playlist_id" uuid        NOT NULL REFERENCES "playlists" ("id") ON DELETE CASCADE,
      "created_at"  timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Indexes 
  await db.runSql(`CREATE INDEX ON "playlists" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "playlists" ("deleted_at") WHERE "deleted_at" IS NOT NULL;`);
  await db.runSql(`CREATE INDEX ON "playlists" USING GIN ("search_vector");`);

  await db.runSql(`CREATE UNIQUE INDEX ON "playlist_tracks"  ("playlist_id", "track_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "playlist_likes"   ("user_id", "playlist_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "playlist_reposts" ("user_id", "playlist_id");`);

  // Triggers 
  await db.runSql(`
    CREATE TRIGGER trg_playlists_updated_at
      BEFORE UPDATE ON "playlists"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_playlists_search_vector()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english',
        NEW.name || ' ' || COALESCE(NEW.description, '')
      );
      RETURN NEW;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_playlists_search_vector
      BEFORE INSERT OR UPDATE OF name, description ON "playlists"
      FOR EACH ROW EXECUTE FUNCTION trg_playlists_search_vector();
  `);

  // Counter triggers 
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_playlist_like_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('playlists', 'like_count', NEW.playlist_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('playlists', 'like_count', OLD.playlist_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_playlist_like_count
      AFTER INSERT OR DELETE ON "playlist_likes"
      FOR EACH ROW EXECUTE FUNCTION trg_playlist_like_count();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_playlist_repost_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('playlists', 'repost_count', NEW.playlist_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('playlists', 'repost_count', OLD.playlist_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_playlist_repost_count
      AFTER INSERT OR DELETE ON "playlist_reposts"
      FOR EACH ROW EXECUTE FUNCTION trg_playlist_repost_count();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_playlist_track_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('playlists', 'track_count', NEW.playlist_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('playlists', 'track_count', OLD.playlist_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_playlist_track_count
      AFTER INSERT OR DELETE ON "playlist_tracks"
      FOR EACH ROW EXECUTE FUNCTION trg_playlist_track_count();
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_playlist_track_count  ON "playlist_tracks";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_playlist_repost_count ON "playlist_reposts";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_playlist_like_count   ON "playlist_likes";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_playlists_search_vector ON "playlists";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_playlists_updated_at  ON "playlists";`);

  await db.runSql(`DROP FUNCTION IF EXISTS trg_playlist_track_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_playlist_repost_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_playlist_like_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_playlists_search_vector();`);

  await db.runSql(`DROP TABLE IF EXISTS "playlist_reposts" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "playlist_likes"   CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "playlist_tracks"  CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "playlists"        CASCADE;`);
};

exports._meta = {
  "version": 1
};
