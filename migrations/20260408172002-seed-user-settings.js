'use strict';

// =============================================================
// SEED 10 — user_preferences, user_content_settings,
//           user_privacy_settings, user_favorite_genres,
//           user_favorite_tags, recent_searches
//
// Depends on: seed-01 (users), seed-02 (genres, tags)
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {

  // ----------------------------------------------------------
  // USER PREFERENCES  (one row per user)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO user_preferences
      (id, user_id, autoplay, explicit_content, audio_quality, language, theme, created_at)
    VALUES
    -- Artists
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000', true,  true,  'high',   'en', 'dark',  NOW()-INTERVAL '340 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000', true,  false, 'high',   'en', 'dark',  NOW()-INTERVAL '290 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000', true,  true,  'high',   'en', 'dark',  NOW()-INTERVAL '260 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000', true,  false, 'high',   'en', 'light', NOW()-INTERVAL '230 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000', true,  false, 'high',   'en', 'dark',  NOW()-INTERVAL '200 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000', false, false, 'normal', 'en', 'dark',  NOW()-INTERVAL '170 days'),
    -- Listeners
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000', true,  false, 'high',   'en', 'dark',  NOW()-INTERVAL '145 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000', true,  true,  'normal', 'en', 'dark',  NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000', true,  false, 'normal', 'en', 'light', NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000', true,  true,  'high',   'en', 'dark',  NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000', false, false, 'low',    'en', 'light', NOW()-INTERVAL '95 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000', true,  false, 'normal', 'en', 'dark',  NOW()-INTERVAL '85 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000', true,  false, 'high',   'en', 'dark',  NOW()-INTERVAL '75 days'),
    -- Admin
    (gen_random_uuid(),'00000001-0000-0000-0000-000000000000', false, false, 'normal', 'en', 'dark',  NOW()-INTERVAL '390 days')
    ON CONFLICT (user_id) DO NOTHING;
  `);

  // ----------------------------------------------------------
  // USER CONTENT SETTINGS  (artists only — relevant for RSS)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO user_content_settings
      (id, user_id, rss_title, rss_language, rss_category,
       rss_explicit, rss_show_email, default_include_in_rss,
       default_license_type, created_at)
    VALUES
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000',
     'DJ Karim Music Feed', 'en', 'Electronic Music',
     false, false, true, 'all_rights_reserved', NOW()-INTERVAL '340 days'),

    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000',
     'Nour El Sound - New Music', 'en', 'Indie',
     false, false, true, 'creative_commons', NOW()-INTERVAL '290 days'),

    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000',
     'BeatMaker99 Official Feed', 'en', 'Hip-Hop',
     true, false, true, 'all_rights_reserved', NOW()-INTERVAL '260 days'),

    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000',
     'Layla Jazz Audio Feed', 'en', 'Jazz',
     false, false, true, 'all_rights_reserved', NOW()-INTERVAL '230 days'),

    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000',
     'SynthLord Releases', 'en', 'Electronic',
     false, false, true, 'all_rights_reserved', NOW()-INTERVAL '200 days'),

    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000',
     'Rana Beats Lo-Fi Feed', 'en', 'Lo-Fi',
     false, false, true, 'creative_commons', NOW()-INTERVAL '170 days')
    ON CONFLICT (user_id) DO NOTHING;
  `);

  // ----------------------------------------------------------
  // USER PRIVACY SETTINGS
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO user_privacy_settings
      (id, user_id,
       receive_messages_from_anyone,
       show_activities_in_discovery,
       show_as_top_fan,
       show_top_fans_on_tracks,
       created_at)
    VALUES
    -- Artists — generally open
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '340 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '290 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000', true,  true,  false, true,  NOW()-INTERVAL '260 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000', false, true,  true,  true,  NOW()-INTERVAL '230 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '200 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000', true,  true,  true,  false, NOW()-INTERVAL '170 days'),
    -- Listeners
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '145 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000', true,  false, true,  true,  NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000', false, true,  true,  true,  NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000', false, false, false, false, NOW()-INTERVAL '95 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '85 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000', true,  true,  true,  true,  NOW()-INTERVAL '75 days'),
    -- Admin
    (gen_random_uuid(),'00000001-0000-0000-0000-000000000000', false, false, false, false, NOW()-INTERVAL '390 days')
    ON CONFLICT (user_id) DO NOTHING;
  `);

  // ----------------------------------------------------------
  // USER FAVORITE GENRES
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO user_favorite_genres (id, user_id, genre_id) VALUES
    -- Sara: Electronic, Indie, Synth-Pop
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','a0000001-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','a0000003-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','a0000006-0000-0000-0000-000000000000'),
    -- Mo: Hip-Hop, Electronic, Lo-Fi
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','a0000002-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','a0000001-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','a0000007-0000-0000-0000-000000000000'),
    -- Fatma: Indie, Jazz, R&B
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','a0000003-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','a0000004-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','a0000008-0000-0000-0000-000000000000'),
    -- Youssef: Hip-Hop, Electronic
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','a0000002-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','a0000001-0000-0000-0000-000000000000'),
    -- Hana: Indie, Lo-Fi, Jazz, Ambient
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','a0000003-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','a0000007-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','a0000004-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','a0000005-0000-0000-0000-000000000000'),
    -- Kareem: Electronic, Synth-Pop, Ambient
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','a0000001-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','a0000006-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','a0000005-0000-0000-0000-000000000000'),
    -- Nadia: Jazz, R&B, Indie
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','a0000004-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','a0000008-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','a0000003-0000-0000-0000-000000000000');
  `);

  // ----------------------------------------------------------
  // USER FAVORITE TAGS
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO user_favorite_tags (id, user_id, tag_id) VALUES
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','b0000006-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','b0000005-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','b0000007-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','b0000006-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','b0000015-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','b0000009-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','b0000014-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','b0000004-0000-0000-0000-000000000000');
  `);

  // ----------------------------------------------------------
  // RECENT SEARCHES  (trg_recent_searches_cap caps at 20/user)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO recent_searches (id, user_id, query, type, created_at) VALUES
    -- Sara
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','midnight run',  'track',    NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','dj karim',      'user',     NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','late night electronic','playlist', NOW()-INTERVAL '5 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','neon city',     'track',    NOW()-INTERVAL '7 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','electronic',    'track',    NOW()-INTERVAL '10 days'),
    -- Mo
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','street code',   'track',    NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','beatmaker99',   'user',     NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','rooftop sessions','track', NOW()-INTERVAL '8 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','hip-hop essentials','playlist', NOW()-INTERVAL '12 days'),
    -- Fatma
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','echo lane',     'track',    NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','nour el sound', 'user',     NOW()-INTERVAL '5 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','blue hour',     'track',    NOW()-INTERVAL '9 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','indie',         'track',    NOW()-INTERVAL '14 days'),
    -- Youssef
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','grind time',    'track',    NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','hip hop',       'track',    NOW()-INTERVAL '6 days'),
    -- Hana
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','coffee shop rain','track', NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','study focus mix','playlist',NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','lofi',          'track',    NOW()-INTERVAL '7 days'),
    -- Kareem
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','crystal matrix','track',   NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','synthlord',     'user',     NOW()-INTERVAL '5 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','electronic bangers 2025','playlist', NOW()-INTERVAL '9 days'),
    -- Nadia
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','velvet smoke',  'track',    NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','layla jazz',    'user',     NOW()-INTERVAL '6 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','jazz after hours','playlist', NOW()-INTERVAL '11 days');
  `);

};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM recent_searches       WHERE user_id LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM user_favorite_tags    WHERE user_id LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM user_favorite_genres  WHERE user_id LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM user_privacy_settings WHERE user_id LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM user_content_settings WHERE user_id LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM user_preferences      WHERE user_id LIKE '0000000%-0000-0000-0000-000000000000';`);
};

exports._meta = { version: 1 };