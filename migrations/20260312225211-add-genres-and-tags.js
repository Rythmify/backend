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
  // genres
  await db.runSql(`
    CREATE TABLE "genres" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"       varchar     UNIQUE NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // tags
  await db.runSql(`
    CREATE TABLE "tags" (
      "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"       varchar     UNIQUE NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP TABLE IF EXISTS "tags" CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "genres" CASCADE;`);
};

exports._meta = {
  version: 1,
};
