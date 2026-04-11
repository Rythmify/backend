'use strict';

// =============================================================
// SEED 07 — notifications, notification_preferences, push_tokens
// Depends on: seed-01 (users), seed-03 (tracks), seed-05 (comments)
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // ----------------------------------------------------------
  // NOTIFICATIONS
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO notifications
      (id, user_id, action_user_id, type, reference_id, reference_type, is_read, created_at)
    VALUES

    -- DJ Karim gets notified: likes on Midnight Run
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'like','c0000001-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000',
     'like','c0000001-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
     'like','c0000001-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '128 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000011-0000-0000-0000-000000000000',
     'like','c0000001-0000-0000-0000-000000000000','track', false, NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000013-0000-0000-0000-000000000000',
     'like','c0000001-0000-0000-0000-000000000000','track', false, NOW()-INTERVAL '118 days'),

    -- DJ Karim gets notified: reposts
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'repost','c0000001-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000003-0000-0000-0000-000000000000',
     'repost','c0000001-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '125 days'),

    -- DJ Karim gets notified: new followers
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'follow',NULL,NULL, true,  NOW()-INTERVAL '140 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000',
     'follow',NULL,NULL, true,  NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000011-0000-0000-0000-000000000000',
     'follow',NULL,NULL, false, NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
     'follow',NULL,NULL, false, NOW()-INTERVAL '90 days'),

    -- DJ Karim gets notified: comments on Midnight Run
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'comment','f0000001-0000-0000-0000-000000000000','comment', true,  NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000',
     'comment','f0000002-0000-0000-0000-000000000000','comment', true,  NOW()-INTERVAL '128 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','00000013-0000-0000-0000-000000000000',
     'comment','f0000003-0000-0000-0000-000000000000','comment', false, NOW()-INTERVAL '125 days'),

    -- Nour gets notified: likes on Echo Lane
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
     'like','c0000005-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '195 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
     'like','c0000005-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '190 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000014-0000-0000-0000-000000000000',
     'like','c0000005-0000-0000-0000-000000000000','track', false, NOW()-INTERVAL '185 days'),

    -- Nour gets notified: new followers
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'follow',NULL,NULL, true,  NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
     'follow',NULL,NULL, true,  NOW()-INTERVAL '120 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
     'follow',NULL,NULL, false, NOW()-INTERVAL '95 days'),

    -- Nour gets notified: comment on Echo Lane
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
     'comment','f0000010-0000-0000-0000-000000000000','comment', false, NOW()-INTERVAL '192 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
     'comment','f0000011-0000-0000-0000-000000000000','comment', false, NOW()-INTERVAL '188 days'),

    -- BeatMaker gets notified: likes on Street Code
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000',
     'like','c0000008-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '230 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','00000011-0000-0000-0000-000000000000',
     'like','c0000008-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '225 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','00000013-0000-0000-0000-000000000000',
     'like','c0000008-0000-0000-0000-000000000000','track', false, NOW()-INTERVAL '220 days'),

    -- BeatMaker gets notified: comment on Street Code
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000',
     'comment','f0000006-0000-0000-0000-000000000000','comment', false, NOW()-INTERVAL '225 days'),

    -- Layla gets notified: likes & follow
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
     'like','c0000011-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '285 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
     'like','c0000011-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '280 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'follow',NULL,NULL, true, NOW()-INTERVAL '92 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','00000013-0000-0000-0000-000000000000',
     'follow',NULL,NULL, false,NOW()-INTERVAL '82 days'),

    -- SynthLord gets notified: likes & follow
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
     'like','c0000013-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '155 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','00000009-0000-0000-0000-000000000000',
     'like','c0000013-0000-0000-0000-000000000000','track', false, NOW()-INTERVAL '150 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','00000007-0000-0000-0000-000000000000',
     'follow',NULL,NULL, false, NOW()-INTERVAL '125 days'),

    -- Rana gets notified: likes on Coffee Shop Rain
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
     'like','c0000015-0000-0000-0000-000000000000','track', true,  NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
     'like','c0000015-0000-0000-0000-000000000000','track', false, NOW()-INTERVAL '122 days');
  `);

  // ----------------------------------------------------------
  // NOTIFICATION PREFERENCES (one row per user — all defaults)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO notification_preferences (id, user_id, created_at)
    SELECT gen_random_uuid(), id, NOW()
    FROM users
    WHERE id::text LIKE '0000000%-0000-0000-0000-000000000000'
    ON CONFLICT (user_id) DO NOTHING;
  `);

  // ----------------------------------------------------------
  // PUSH TOKENS
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO push_tokens (id, user_id, token, platform, created_at) VALUES
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000',
     'ExponentPushToken[xxxxSARAxxx001]','android', NOW()-INTERVAL '140 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000',
     'ExponentPushToken[xxxxSARAxxx002]','ios',     NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000',
     'ExponentPushToken[xxxxSARAxxx003]','android', NOW()-INTERVAL '120 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000',
     'ExponentPushToken[xxxxSARAxxx004]','ios',     NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000',
     'ExponentPushToken[xxxxSARAxxx005]','ios',     NOW()-INTERVAL '340 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000',
     'ExponentPushToken[xxxxSARAxxx006]','android', NOW()-INTERVAL '290 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(
    `DELETE FROM push_tokens              WHERE user_id::text LIKE '0000000%-0000-0000-0000-000000000000';`
  );
  await db.runSql(
    `DELETE FROM notification_preferences WHERE user_id::text LIKE '0000000%-0000-0000-0000-000000000000';`
  );
  await db.runSql(
    `DELETE FROM notifications            WHERE user_id::text LIKE '0000000%-0000-0000-0000-000000000000';`
  );
};

exports._meta = { version: 1 };
