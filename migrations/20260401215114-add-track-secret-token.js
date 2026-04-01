'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  await db.runSql(`
    ALTER TABLE "tracks"
    ADD COLUMN "secret_token" varchar;
  `);

  await db.runSql(`
    UPDATE "tracks"
    SET "secret_token" = gen_random_uuid()::text
    WHERE "is_public" = false
      AND "secret_token" IS NULL;
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX "tracks_secret_token_unique"
    ON "tracks" ("secret_token")
    WHERE "secret_token" IS NOT NULL;
  `);

  await db.runSql(`
    ALTER TABLE "tracks"
    ADD CONSTRAINT "tracks_private_requires_secret_token"
    CHECK (
      ("is_public" = true)
      OR
      ("is_public" = false AND "secret_token" IS NOT NULL)
    );
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    ALTER TABLE "tracks"
    DROP CONSTRAINT IF EXISTS "tracks_private_requires_secret_token";
  `);

  await db.runSql(`
    DROP INDEX IF EXISTS "tracks_secret_token_unique";
  `);

  await db.runSql(`
    ALTER TABLE "tracks"
    DROP COLUMN IF EXISTS "secret_token";
  `);
};

exports._meta = {
  version: 1,
};
