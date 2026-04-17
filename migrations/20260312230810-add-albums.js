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
  // albums table
  await db.runSql(`
    CREATE TABLE "albums" (
      "id"            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "title"         varchar     NOT NULL,
      "description"   text,
      "cover_image"   varchar,
      "artist_id"     uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "genre_id"      uuid        REFERENCES "genres" ("id") ON DELETE SET NULL,
      "is_public"     boolean     NOT NULL DEFAULT true,
      "release_date"  date,
      "like_count"    integer     NOT NULL DEFAULT 0,
      "repost_count"  integer     NOT NULL DEFAULT 0,
      "track_count"   integer     NOT NULL DEFAULT 0,
      "search_vector" tsvector,
      "deleted_at"    timestamptz,
      "created_at"    timestamptz NOT NULL DEFAULT now(),
      "updated_at"    timestamptz
    );
  `);

  // album_tracks table
  await db.runSql(`
    CREATE TABLE "album_tracks" (
      "id"       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
      "album_id" uuid    NOT NULL REFERENCES "albums" ("id") ON DELETE CASCADE,
      "track_id" uuid    NOT NULL REFERENCES "tracks" ("id") ON DELETE CASCADE,
      "position" integer
    );
  `);

  // album_likes table
  await db.runSql(`
    CREATE TABLE "album_likes" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "album_id"   uuid        NOT NULL REFERENCES "albums" ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // album_reposts table
  await db.runSql(`
    CREATE TABLE "album_reposts" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "album_id"   uuid        NOT NULL REFERENCES "albums" ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await db.runSql(`CREATE INDEX ON "albums" ("artist_id");`);
  await db.runSql(`CREATE INDEX ON "albums" ("genre_id");`);
  await db.runSql(`CREATE INDEX ON "albums" ("deleted_at") WHERE "deleted_at" IS NOT NULL;`);
  await db.runSql(`CREATE INDEX ON "albums" USING GIN ("search_vector");`);

  await db.runSql(`CREATE UNIQUE INDEX ON "album_tracks"  ("album_id", "track_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "album_likes"   ("user_id", "album_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "album_reposts" ("user_id", "album_id");`);

  // Triggers
  await db.runSql(`
    CREATE TRIGGER trg_albums_updated_at
      BEFORE UPDATE ON "albums"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_albums_search_vector()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english',
        NEW.title || ' ' || COALESCE(NEW.description, '')
      );
      RETURN NEW;
    END;
    $$;
  `);

  await db.runSql(`
    CREATE TRIGGER trg_albums_search_vector
      BEFORE INSERT OR UPDATE OF title, description ON "albums"
      FOR EACH ROW EXECUTE FUNCTION trg_albums_search_vector();
  `);

  // Counter triggers
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_album_like_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('albums', 'like_count', NEW.album_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('albums', 'like_count', OLD.album_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_album_like_count
      AFTER INSERT OR DELETE ON "album_likes"
      FOR EACH ROW EXECUTE FUNCTION trg_album_like_count();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_album_repost_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('albums', 'repost_count', NEW.album_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('albums', 'repost_count', OLD.album_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_album_repost_count
      AFTER INSERT OR DELETE ON "album_reposts"
      FOR EACH ROW EXECUTE FUNCTION trg_album_repost_count();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_album_track_count()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM increment_counter('albums', 'track_count', NEW.album_id,  1);
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_counter('albums', 'track_count', OLD.album_id, -1);
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_album_track_count
      AFTER INSERT OR DELETE ON "album_tracks"
      FOR EACH ROW EXECUTE FUNCTION trg_album_track_count();
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_album_track_count  ON "album_tracks";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_album_repost_count ON "album_reposts";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_album_like_count   ON "album_likes";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_albums_search_vector ON "albums";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_albums_updated_at  ON "albums";`);

  await db.runSql(`DROP FUNCTION IF EXISTS trg_album_track_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_album_repost_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_album_like_count();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_albums_search_vector();`);

  await db.runSql(`DROP TABLE IF EXISTS "album_reposts" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "album_likes"   CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "album_tracks"  CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "albums"        CASCADE;`);
};

exports._meta = {
  version: 1,
};
