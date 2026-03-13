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
  // tracks table
  await db.runSql(`
    CREATE TABLE "tracks" (
      "id"                       uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
      "title"                    varchar(200)         NOT NULL,
      "description"              text,
      "genre_id"                 uuid                 REFERENCES "genres" ("id") ON DELETE SET NULL,
      "cover_image"              varchar,
      "waveform_url"             varchar,
      "audio_url"                varchar              NOT NULL,
      "stream_url"               varchar,
      "preview_url"              varchar,
      "duration"                 integer,
      "file_size"                integer,
      "bitrate"                  integer,
      "status"                   track_status         NOT NULL DEFAULT 'processing',
      "is_public"                boolean              NOT NULL DEFAULT true,
      "is_trending"              boolean              NOT NULL DEFAULT false,
      "is_featured"              boolean              NOT NULL DEFAULT false,
      "is_hidden"                boolean              NOT NULL DEFAULT false,
      "user_id"                  uuid                 NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,

      -- Artists & metadata
      "release_date"             date,
      "isrc"                     varchar(12),
      "p_line"                   varchar,
      "buy_link"                 varchar,
      "record_label"             varchar(200),
      "publisher"                varchar(200),
      "explicit_content"         boolean              NOT NULL DEFAULT false,
      "license_type"             license_type         NOT NULL DEFAULT 'all_rights_reserved',

      -- Access settings
      "enable_downloads"         boolean              NOT NULL DEFAULT false,
      "enable_offline_listening" boolean              NOT NULL DEFAULT false,
      "include_in_rss_feed"      boolean              NOT NULL DEFAULT true,
      "display_embed_code"       boolean              NOT NULL DEFAULT true,
      "enable_app_playback"      boolean              NOT NULL DEFAULT true,

      -- Engagement privacy
      "allow_comments"           boolean              NOT NULL DEFAULT true,
      "show_comments_public"     boolean              NOT NULL DEFAULT true,
      "show_insights_public"     boolean              NOT NULL DEFAULT true,
      "geo_restriction_type"     geo_restriction_type NOT NULL DEFAULT 'worldwide',
      "geo_regions"              jsonb,

      -- Engagement counters
      "play_count"               integer              NOT NULL DEFAULT 0,
      "like_count"               integer              NOT NULL DEFAULT 0,
      "comment_count"            integer              NOT NULL DEFAULT 0,
      "repost_count"             integer              NOT NULL DEFAULT 0,

      "search_vector"            tsvector,
      "deleted_at"               timestamptz,
      "created_at"               timestamptz          NOT NULL DEFAULT now(),
      "updated_at"               timestamptz
    );
  `);

  // track_tags table
  await db.runSql(`
    CREATE TABLE "track_tags" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "track_id"   uuid        NOT NULL REFERENCES "tracks" ("id") ON DELETE CASCADE,
      "tag_id"     uuid        NOT NULL REFERENCES "tags"   ("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // track_artists table
  await db.runSql(`
    CREATE TABLE "track_artists" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "track_id"   uuid        NOT NULL REFERENCES "tracks" ("id") ON DELETE CASCADE,
      "artist_id"  uuid        NOT NULL REFERENCES "users"  ("id") ON DELETE CASCADE,
      "position"   integer     NOT NULL DEFAULT 1,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await db.runSql(`CREATE INDEX ON "tracks" ("user_id");`);
  await db.runSql(`CREATE INDEX ON "tracks" ("status");`);
  await db.runSql(`CREATE INDEX ON "tracks" ("is_public");`);
  await db.runSql(`CREATE INDEX ON "tracks" ("is_hidden");`);
  await db.runSql(`CREATE INDEX ON "tracks" ("created_at");`);
  await db.runSql(`CREATE INDEX ON "tracks" ("genre_id");`);
  await db.runSql(`CREATE INDEX ON "tracks" USING GIN ("search_vector");`);
  await db.runSql(`CREATE INDEX ON "tracks" USING GIN ("geo_regions");`);
  await db.runSql(`CREATE INDEX ON "tracks" ("deleted_at") WHERE "deleted_at" IS NOT NULL;`);

  await db.runSql(`CREATE UNIQUE INDEX ON "track_tags"    ("track_id", "tag_id");`);
  await db.runSql(`CREATE INDEX ON "track_tags"           ("tag_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "track_artists" ("track_id", "artist_id");`);
  await db.runSql(`CREATE UNIQUE INDEX ON "track_artists" ("track_id", "position");`);

  // Triggers 
  await db.runSql(`
    CREATE TRIGGER trg_tracks_updated_at
      BEFORE UPDATE ON "tracks"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_tracks_search_vector()
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
    CREATE TRIGGER trg_tracks_search_vector
      BEFORE INSERT OR UPDATE OF title, description ON "tracks"
      FOR EACH ROW EXECUTE FUNCTION trg_tracks_search_vector();
  `);
};

exports.down = async function(db) {
  await db.runSql(`DROP TRIGGER IF EXISTS trg_tracks_search_vector ON "tracks";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_tracks_updated_at ON "tracks";`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_tracks_search_vector();`);

  await db.runSql(`DROP TABLE IF EXISTS "track_artists" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "track_tags"    CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "tracks"        CASCADE;`);
};

exports._meta = {
  "version": 1
};
