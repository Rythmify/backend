'use strict';

// =============================================================
// SEED 05 — track_likes, track_reposts, album_likes,
//            album_reposts, playlist_likes, playlist_reposts,
//            comments, comment_likes
//
// Depends on: seed-01 (users), seed-03 (tracks),
//             seed-04 (albums, playlists)
//
// All like/repost triggers auto-increment the counter columns
// on tracks / albums / playlists — no manual UPDATE needed.
// comment_like_count and reply_count are also trigger-driven.
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {

  // ----------------------------------------------------------
  // TRACK LIKES
  // Each row → trg_track_like_count increments tracks.like_count
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO track_likes (id, user_id, track_id, created_at) VALUES
    -- Midnight Run (c0000001) — most-liked
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '128 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '120 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '118 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '110 days'),

    -- Neon City (c0000003)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '112 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '108 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '105 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '100 days'),

    -- Echo Lane (c0000005)
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '195 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '190 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '185 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '180 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '175 days'),

    -- Street Code (c0000008)
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '230 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '225 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '220 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '215 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '210 days'),

    -- Crystal Matrix (c0000013)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '155 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '150 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '145 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '140 days'),

    -- Solar Drift (c0000002)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '215 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '210 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '205 days'),

    -- Blue Hour (c0000011)
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', NOW()-INTERVAL '285 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', NOW()-INTERVAL '280 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', NOW()-INTERVAL '275 days'),

    -- Rooftop Sessions (c0000009)
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', NOW()-INTERVAL '165 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', NOW()-INTERVAL '160 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', NOW()-INTERVAL '155 days'),

    -- Coffee Shop Rain (c0000015)
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', NOW()-INTERVAL '122 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', NOW()-INTERVAL '120 days'),

    -- Void Walker (c0000014)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000', NOW()-INTERVAL '38 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000', NOW()-INTERVAL '35 days'),

    -- Paper Planes (c0000006)
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '155 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '152 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '150 days');
  `);

  // ----------------------------------------------------------
  // TRACK REPOSTS
  // trg_track_repost_count increments tracks.repost_count
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO track_reposts (id, user_id, track_id, created_at) VALUES
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '128 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '125 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '108 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '105 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '190 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '185 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '225 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', NOW()-INTERVAL '220 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '150 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '148 days');
  `);

  // ----------------------------------------------------------
  // ALBUM LIKES  (trg_album_like_count)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO album_likes (id, user_id, album_id, created_at) VALUES
    -- Midnight Sessions
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '118 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '112 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '110 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '108 days'),
    -- Wander Notes
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','d0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '75 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','d0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '72 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','d0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '70 days'),
    -- Concrete Jungle
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','d0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '195 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','d0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '190 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','d0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '185 days'),
    -- After Hours
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','d0000004-0000-0000-0000-000000000000', NOW()-INTERVAL '235 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','d0000004-0000-0000-0000-000000000000', NOW()-INTERVAL '230 days'),
    -- Synthetic Dreams
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','d0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '90 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','d0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '88 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','d0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '85 days'),
    -- Still Hours
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','d0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '35 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','d0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '33 days');
  `);

  // ----------------------------------------------------------
  // ALBUM REPOSTS  (trg_album_repost_count)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO album_reposts (id, user_id, album_id, created_at) VALUES
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '115 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '112 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','d0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '73 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','d0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '188 days');
  `);

  // ----------------------------------------------------------
  // PLAYLIST LIKES  (trg_playlist_like_count)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO playlist_likes (id, user_id, playlist_id, created_at) VALUES
    -- Late Night Electronic (e0000001)
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '138 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '132 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '130 days'),
    -- Morning Indie Vibes (e0000002)
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','e0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '118 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','e0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '115 days'),
    -- Hip-Hop Essentials (e0000003)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','e0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '108 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','e0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '105 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','e0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '102 days'),
    -- Jazz After Hours (e0000004)
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','e0000004-0000-0000-0000-000000000000', NOW()-INTERVAL '98 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','e0000004-0000-0000-0000-000000000000', NOW()-INTERVAL '96 days'),
    -- Study Focus Mix (e0000005)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','e0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '88 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','e0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '86 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','e0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '84 days'),
    -- Electronic Bangers 2025 (e0000006)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','e0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '72 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','e0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '70 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','e0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '68 days');
  `);

  // ----------------------------------------------------------
  // PLAYLIST REPOSTS  (trg_playlist_repost_count)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO playlist_reposts (id, user_id, playlist_id, created_at) VALUES
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '136 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '132 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','e0000003-0000-0000-0000-000000000000', NOW()-INTERVAL '104 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','e0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '70 days');
  `);

  // ----------------------------------------------------------
  // COMMENTS  (fixed IDs: f000000N-...)
  // trg_track_comment_count fires on INSERT → tracks.comment_count++
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO comments
      (id, user_id, track_id, parent_comment_id, content,
       track_timestamp, like_count, reply_count, created_at)
    VALUES

    -- Midnight Run comments
    ('f0000001-0000-0000-0000-000000000000',
     '00000008-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000000',
     NULL, 'This drop at 1:32 is INSANE! 🔥 Been on repeat all night.',
     92, 0, 0, NOW()-INTERVAL '130 days'),

    ('f0000002-0000-0000-0000-000000000000',
     '00000009-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000000',
     NULL, 'Karim never misses. This belongs in every festival set.',
     0, 0, 0, NOW()-INTERVAL '128 days'),

    ('f0000003-0000-0000-0000-000000000000',
     '00000013-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000000',
     NULL, 'Production quality is top tier. The mix on the low end 🤌',
     155, 0, 0, NOW()-INTERVAL '125 days'),

    -- Reply to f0000001
    ('f0000004-0000-0000-0000-000000000000',
     '00000011-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000000',
     'f0000001-0000-0000-0000-000000000000',
     'Totally agree — that breakdown wrecked me.',
     NULL, 0, 0, NOW()-INTERVAL '129 days'),

    ('f0000005-0000-0000-0000-000000000000',
     '00000002-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000000',
     'f0000001-0000-0000-0000-000000000000',
     'Thanks! Appreciate the love 🙏 working on a follow-up.',
     NULL, 0, 0, NOW()-INTERVAL '128 days'),

    -- Street Code comments
    ('f0000006-0000-0000-0000-000000000000',
     '00000009-0000-0000-0000-000000000000', 'c0000008-0000-0000-0000-000000000000',
     NULL, 'Hardest thing I heard this month. 808s are lethal.',
     0, 0, 0, NOW()-INTERVAL '225 days'),

    ('f0000007-0000-0000-0000-000000000000',
     '00000011-0000-0000-0000-000000000000', 'c0000008-0000-0000-0000-000000000000',
     NULL, 'Need a full EP like yesterday.',
     0, 0, 0, NOW()-INTERVAL '222 days'),

    ('f0000008-0000-0000-0000-000000000000',
     '00000013-0000-0000-0000-000000000000', 'c0000008-0000-0000-0000-000000000000',
     NULL, 'The hi-hat pattern is different, fire 🔥',
     45, 0, 0, NOW()-INTERVAL '220 days'),

    -- Reply to f0000007
    ('f0000009-0000-0000-0000-000000000000',
     '00000004-0000-0000-0000-000000000000', 'c0000008-0000-0000-0000-000000000000',
     'f0000007-0000-0000-0000-000000000000',
     'EP is in the works 👀 stay tuned.',
     NULL, 0, 0, NOW()-INTERVAL '220 days'),

    -- Echo Lane comments
    ('f0000010-0000-0000-0000-000000000000',
     '00000010-0000-0000-0000-000000000000', 'c0000005-0000-0000-0000-000000000000',
     NULL, 'Nour your voice is something else. This made me cry on the bus.',
     0, 0, 0, NOW()-INTERVAL '192 days'),

    ('f0000011-0000-0000-0000-000000000000',
     '00000012-0000-0000-0000-000000000000', 'c0000005-0000-0000-0000-000000000000',
     NULL, 'The guitar tone at 0:48 is perfect. How do you record?',
     48, 0, 0, NOW()-INTERVAL '188 days'),

    -- Reply to f0000011
    ('f0000012-0000-0000-0000-000000000000',
     '00000003-0000-0000-0000-000000000000', 'c0000005-0000-0000-0000-000000000000',
     'f0000011-0000-0000-0000-000000000000',
     'SM57 into an old Focusrite. Nothing fancy — just good light and vibes 😂',
     NULL, 0, 0, NOW()-INTERVAL '186 days'),

    -- Blue Hour comments
    ('f0000013-0000-0000-0000-000000000000',
     '00000010-0000-0000-0000-000000000000', 'c0000011-0000-0000-0000-000000000000',
     NULL, 'The saxophone in this is 🤌 Layla you are an institution.',
     120, 0, 0, NOW()-INTERVAL '280 days'),

    ('f0000014-0000-0000-0000-000000000000',
     '00000014-0000-0000-0000-000000000000', 'c0000011-0000-0000-0000-000000000000',
     NULL, 'This is my 3am playlist every single night.',
     0, 0, 0, NOW()-INTERVAL '275 days'),

    -- Crystal Matrix comments
    ('f0000015-0000-0000-0000-000000000000',
     '00000008-0000-0000-0000-000000000000', 'c0000013-0000-0000-0000-000000000000',
     NULL, 'Takes me straight back to the 80s but sounds completely fresh.',
     0, 0, 0, NOW()-INTERVAL '152 days'),

    ('f0000016-0000-0000-0000-000000000000',
     '00000002-0000-0000-0000-000000000000', 'c0000013-0000-0000-0000-000000000000',
     NULL, 'Ahmed you killed it on this one. Collab soon?',
     0, 0, 0, NOW()-INTERVAL '148 days'),

    -- Reply to f0000016
    ('f0000017-0000-0000-0000-000000000000',
     '00000006-0000-0000-0000-000000000000', 'c0000013-0000-0000-0000-000000000000',
     'f0000016-0000-0000-0000-000000000000',
     'DMs open 👀',
     NULL, 0, 0, NOW()-INTERVAL '147 days'),

    -- Coffee Shop Rain comments
    ('f0000018-0000-0000-0000-000000000000',
     '00000010-0000-0000-0000-000000000000', 'c0000015-0000-0000-0000-000000000000',
     NULL, 'I passed my exams listening to this on loop. Thank you Rana ❤️',
     0, 0, 0, NOW()-INTERVAL '120 days');
  `);

  // ----------------------------------------------------------
  // COMMENT LIKES  (trg_comment_like_count & trg_comment_reply_count)
  // Because replies were inserted above WITHOUT parent_comment_id,
  // we must now UPDATE reply_count and like_count using the trigger
  // mechanism — we do it by inserting comment_likes rows so the
  // trigger keeps everything consistent.
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO comment_likes (id, user_id, comment_id, created_at) VALUES
    -- f0000001 (Midnight Run - Sara's comment)
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','f0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '129 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','f0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '128 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','f0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '127 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','f0000001-0000-0000-0000-000000000000', NOW()-INTERVAL '126 days'),

    -- f0000002 (Midnight Run - Mo's comment)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','f0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '127 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','f0000002-0000-0000-0000-000000000000', NOW()-INTERVAL '126 days'),

    -- f0000005 (Karim's reply)
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','f0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '127 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','f0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '126 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','f0000005-0000-0000-0000-000000000000', NOW()-INTERVAL '125 days'),

    -- f0000006 (Street Code - Mo's comment)
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','f0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '222 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','f0000006-0000-0000-0000-000000000000', NOW()-INTERVAL '220 days'),

    -- f0000010 (Echo Lane - Fatma's comment)
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','f0000010-0000-0000-0000-000000000000', NOW()-INTERVAL '190 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','f0000010-0000-0000-0000-000000000000', NOW()-INTERVAL '188 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','f0000010-0000-0000-0000-000000000000', NOW()-INTERVAL '186 days'),

    -- f0000013 (Blue Hour - Fatma's comment)
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','f0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '278 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','f0000013-0000-0000-0000-000000000000', NOW()-INTERVAL '275 days');
  `);

  // ----------------------------------------------------------
  // FIX reply_count on parent comments
  // The comment rows were inserted without parent_comment_id
  // so the trigger did not fire. Update reply_count directly.
  // ----------------------------------------------------------
  await db.runSql(`
    UPDATE comments SET reply_count = 2 WHERE id = 'f0000001-0000-0000-0000-000000000000';
    UPDATE comments SET reply_count = 1 WHERE id = 'f0000007-0000-0000-0000-000000000000';
    UPDATE comments SET reply_count = 1 WHERE id = 'f0000011-0000-0000-0000-000000000000';
    UPDATE comments SET reply_count = 1 WHERE id = 'f0000016-0000-0000-0000-000000000000';
  `);

};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM comment_likes   WHERE comment_id LIKE 'f00000%';`);
  await db.runSql(`DELETE FROM comments        WHERE id         LIKE 'f00000%';`);
  await db.runSql(`DELETE FROM playlist_reposts WHERE playlist_id LIKE 'e00000%';`);
  await db.runSql(`DELETE FROM playlist_likes   WHERE playlist_id LIKE 'e00000%';`);
  await db.runSql(`DELETE FROM album_reposts    WHERE album_id    LIKE 'd00000%';`);
  await db.runSql(`DELETE FROM album_likes      WHERE album_id    LIKE 'd00000%';`);
  await db.runSql(`DELETE FROM track_reposts    WHERE track_id    LIKE 'c00000%';`);
  await db.runSql(`DELETE FROM track_likes      WHERE track_id    LIKE 'c00000%';`);
};

exports._meta = { version: 1 };