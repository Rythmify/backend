'use strict';

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // Add a few follows and playlist_reposts so seeded listeners see playlist activity in the feed
  await db.runSql(`
    -- make sara (listener: 00000008) follow two playlist creators (idempotent)
    INSERT INTO follows (id, follower_id, following_id, created_at)
    SELECT gen_random_uuid(), '00000008-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000', NOW()-INTERVAL '50 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM follows WHERE follower_id='00000008-0000-0000-0000-000000000000' AND following_id='00000009-0000-0000-0000-000000000000'
    );

    INSERT INTO follows (id, follower_id, following_id, created_at)
    SELECT gen_random_uuid(), '00000008-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000', NOW()-INTERVAL '48 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM follows WHERE follower_id='00000008-0000-0000-0000-000000000000' AND following_id='00000010-0000-0000-0000-000000000000'
    );

    -- add playlist reposts idempotently (avoid unique constraint errors)
    INSERT INTO playlist_reposts (id, playlist_id, user_id, created_at)
    SELECT gen_random_uuid(), 'e0000003-0000-0000-0000-000000000000','00000002-0000-0000-0000-000000000000', NOW()-INTERVAL '20 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM playlist_reposts WHERE playlist_id='e0000003-0000-0000-0000-000000000000' AND user_id='00000002-0000-0000-0000-000000000000'
    );

    INSERT INTO playlist_reposts (id, playlist_id, user_id, created_at)
    SELECT gen_random_uuid(), 'e0000002-0000-0000-0000-000000000000','00000003-0000-0000-0000-000000000000', NOW()-INTERVAL '15 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM playlist_reposts WHERE playlist_id='e0000002-0000-0000-0000-000000000000' AND user_id='00000003-0000-0000-0000-000000000000'
    );
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM playlist_reposts WHERE playlist_id IN ('e0000002-0000-0000-0000-000000000000','e0000003-0000-0000-0000-000000000000');
    DELETE FROM follows WHERE follower_id = '00000008-0000-0000-0000-000000000000' AND following_id IN ('00000009-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000');
  `);
};

exports._meta = { version: 1 };
