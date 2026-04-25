'use strict';

let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // Keep the most recently touched row for each (user_id, token) pair.
  await db.runSql(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, token
          ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC
        ) AS rn
      FROM push_tokens
    )
    DELETE FROM push_tokens p
    USING ranked r
    WHERE p.id = r.id
      AND r.rn > 1;
  `);

  await db.runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_id_token_unique
    ON push_tokens (user_id, token);
  `);
};

exports.down = async function (db) {
  await db.runSql(`DROP INDEX IF EXISTS push_tokens_user_id_token_unique;`);
};

exports._meta = {
  version: 1,
};
