'use strict';

// =============================================================
// SEED 06 — listening_history, player_state, activities
//           + final counter sync UPDATE
// At the bottom of this file we run a single UPDATE block that
// syncs ALL counter columns from the actual child-row counts.
// This guarantees exact consistency regardless of trigger order.
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {

  // ----------------------------------------------------------
  // LISTENING HISTORY
  // Heavy plays within last 7 days  → will appear in trending
  // Plays in 8-30 days ago          → feed history / mixes
  // Older plays                      → lifetime play_count only
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO listening_history
      (id, user_id, track_id, duration_played, played_at)
    VALUES

    -- ── WITHIN LAST 7 DAYS (trending window) ──────────────

    -- Midnight Run (c0000001) — trending Electronic — 14 plays
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '5 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '1 day'),

    -- Neon City (c0000003) — trending Electronic — 9 plays
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '5 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '6 days'),

    -- Street Code (c0000008) — trending Hip-Hop — 8 plays
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '1 day'),

    -- Echo Lane (c0000005) — trending Indie — 7 plays
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '5 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '4 days'),

    -- Crystal Matrix (c0000013) — trending Synth-Pop — 6 plays
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '2 days'),

    -- Coffee Shop Rain (c0000015) — trending Lo-Fi — 5 plays
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 182, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 182, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 182, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 182, NOW()-INTERVAL '4 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 182, NOW()-INTERVAL '5 days'),

    -- Blue Hour (c0000011) — trending Jazz — 4 plays
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 285, NOW()-INTERVAL '2 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 285, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 285, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 285, NOW()-INTERVAL '5 days'),

    -- ── 8-30 DAYS AGO (history / personalization) ──────────
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', 187, NOW()-INTERVAL '10 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000004-0000-0000-0000-000000000000', 352, NOW()-INTERVAL '12 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', 210, NOW()-INTERVAL '15 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000010-0000-0000-0000-000000000000', 225, NOW()-INTERVAL '20 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000', 205, NOW()-INTERVAL '14 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000007-0000-0000-0000-000000000000', 172, NOW()-INTERVAL '18 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', 210, NOW()-INTERVAL '22 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000010-0000-0000-0000-000000000000', 225, NOW()-INTERVAL '25 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000012-0000-0000-0000-000000000000', 310, NOW()-INTERVAL '16 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000016-0000-0000-0000-000000000000', 196, NOW()-INTERVAL '20 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000', 352, NOW()-INTERVAL '28 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', 187, NOW()-INTERVAL '22 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000012-0000-0000-0000-000000000000', 310, NOW()-INTERVAL '17 days'),

    -- ── OLDER PLAYS (>30 days — only lifetime play_count) ───
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '60 days'),
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '90 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '50 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '70 days'),
    (gen_random_uuid(),'00000011-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 240, NOW()-INTERVAL '55 days'),
    (gen_random_uuid(),'00000012-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 285, NOW()-INTERVAL '80 days'),
    (gen_random_uuid(),'00000013-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '45 days'),
    (gen_random_uuid(),'00000014-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '65 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 213, NOW()-INTERVAL '200 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 198, NOW()-INTERVAL '150 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 195, NOW()-INTERVAL '180 days'),
    (gen_random_uuid(),'00000005-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 285, NOW()-INTERVAL '200 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 228, NOW()-INTERVAL '120 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 182, NOW()-INTERVAL '100 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','c0000016-0000-0000-0000-000000000000', 196, NOW()-INTERVAL '50 days');
  `);

  // ----------------------------------------------------------
  // PLAYER STATE  (last saved session per user)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO player_state
      (id, user_id, track_id, position_seconds, volume, queue, updated_at)
    VALUES
    (gen_random_uuid(),
     '00000008-0000-0000-0000-000000000000',
     'c0000001-0000-0000-0000-000000000000',
     92.5, 0.80,
     '["c0000001-0000-0000-0000-000000000000","c0000003-0000-0000-0000-000000000000","c0000013-0000-0000-0000-000000000000"]'::jsonb,
     NOW()-INTERVAL '1 hour'),

    (gen_random_uuid(),
     '00000009-0000-0000-0000-000000000000',
     'c0000008-0000-0000-0000-000000000000',
     45.0, 1.00,
     '["c0000008-0000-0000-0000-000000000000","c0000009-0000-0000-0000-000000000000","c0000010-0000-0000-0000-000000000000"]'::jsonb,
     NOW()-INTERVAL '2 hours'),

    (gen_random_uuid(),
     '00000010-0000-0000-0000-000000000000',
     'c0000005-0000-0000-0000-000000000000',
     120.0, 0.70,
     '["c0000005-0000-0000-0000-000000000000","c0000006-0000-0000-0000-000000000000","c0000007-0000-0000-0000-000000000000"]'::jsonb,
     NOW()-INTERVAL '3 hours'),

    (gen_random_uuid(),
     '00000012-0000-0000-0000-000000000000',
     'c0000015-0000-0000-0000-000000000000',
     60.0, 0.60,
     '["c0000015-0000-0000-0000-000000000000","c0000016-0000-0000-0000-000000000000","c0000014-0000-0000-0000-000000000000"]'::jsonb,
     NOW()-INTERVAL '30 minutes');
  `);

  // ----------------------------------------------------------
  // ACTIVITIES
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO activities
      (id, user_id, type, reference_id, reference_type, target_user_id, created_at)
    VALUES
    -- uploads
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','upload','c0000001-0000-0000-0000-000000000000','track',NULL, NOW()-INTERVAL '280 days'),
    (gen_random_uuid(),'00000002-0000-0000-0000-000000000000','upload','c0000003-0000-0000-0000-000000000000','track',NULL, NOW()-INTERVAL '120 days'),
    (gen_random_uuid(),'00000003-0000-0000-0000-000000000000','upload','c0000005-0000-0000-0000-000000000000','track',NULL, NOW()-INTERVAL '200 days'),
    (gen_random_uuid(),'00000004-0000-0000-0000-000000000000','upload','c0000008-0000-0000-0000-000000000000','track',NULL, NOW()-INTERVAL '240 days'),
    (gen_random_uuid(),'00000006-0000-0000-0000-000000000000','upload','c0000013-0000-0000-0000-000000000000','track',NULL, NOW()-INTERVAL '160 days'),
    (gen_random_uuid(),'00000007-0000-0000-0000-000000000000','upload','c0000015-0000-0000-0000-000000000000','track',NULL, NOW()-INTERVAL '130 days'),

    -- likes
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','like','c0000001-0000-0000-0000-000000000000','track','00000002-0000-0000-0000-000000000000', NOW()-INTERVAL '135 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','like','c0000008-0000-0000-0000-000000000000','track','00000004-0000-0000-0000-000000000000', NOW()-INTERVAL '225 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','like','c0000005-0000-0000-0000-000000000000','track','00000003-0000-0000-0000-000000000000', NOW()-INTERVAL '195 days'),

    -- reposts
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','repost','c0000001-0000-0000-0000-000000000000','track','00000002-0000-0000-0000-000000000000', NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','repost','c0000005-0000-0000-0000-000000000000','track','00000003-0000-0000-0000-000000000000', NOW()-INTERVAL '190 days'),

    -- follows
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','follow',NULL,NULL,'00000002-0000-0000-0000-000000000000', NOW()-INTERVAL '140 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','follow',NULL,NULL,'00000004-0000-0000-0000-000000000000', NOW()-INTERVAL '128 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','follow',NULL,NULL,'00000003-0000-0000-0000-000000000000', NOW()-INTERVAL '120 days'),

    -- comments
    (gen_random_uuid(),'00000008-0000-0000-0000-000000000000','comment','f0000001-0000-0000-0000-000000000000','comment','00000002-0000-0000-0000-000000000000', NOW()-INTERVAL '130 days'),
    (gen_random_uuid(),'00000009-0000-0000-0000-000000000000','comment','f0000006-0000-0000-0000-000000000000','comment','00000004-0000-0000-0000-000000000000', NOW()-INTERVAL '225 days'),
    (gen_random_uuid(),'00000010-0000-0000-0000-000000000000','comment','f0000010-0000-0000-0000-000000000000','comment','00000003-0000-0000-0000-000000000000', NOW()-INTERVAL '192 days');
  `);

  // ----------------------------------------------------------
  // SYNC ALL COUNTER COLUMNS FROM ACTUAL CHILD ROWS
  // Run AFTER all engagement seeds have inserted rows.
  // Triggers keep counters live going forward, but we need this
  // one-time resync because we inserted tracks with counters=0
  // before the child rows existed.
  // ----------------------------------------------------------
  await db.runSql(`
    -- tracks
    UPDATE tracks t SET
      like_count    = (SELECT COUNT(*) FROM track_likes    WHERE track_id = t.id),
      repost_count  = (SELECT COUNT(*) FROM track_reposts  WHERE track_id = t.id),
      comment_count = (SELECT COUNT(*) FROM comments       WHERE track_id = t.id AND deleted_at IS NULL),
      play_count    = (SELECT COUNT(*) FROM listening_history WHERE track_id = t.id)
    WHERE t.id::text LIKE 'c00000%';

    -- albums
    UPDATE albums a SET
      like_count   = (SELECT COUNT(*) FROM album_likes   WHERE album_id = a.id),
      repost_count = (SELECT COUNT(*) FROM album_reposts WHERE album_id = a.id),
      track_count  = (SELECT COUNT(*) FROM album_tracks  WHERE album_id = a.id)
    WHERE a.id::text LIKE 'd00000%';

    -- playlists
    UPDATE playlists p SET
      like_count   = (SELECT COUNT(*) FROM playlist_likes   WHERE playlist_id = p.id),
      repost_count = (SELECT COUNT(*) FROM playlist_reposts WHERE playlist_id = p.id),
      track_count  = (SELECT COUNT(*) FROM playlist_tracks  WHERE playlist_id = p.id)
    WHERE p.id::text LIKE 'e00000%';

    -- comments (like_count only — reply_count was set in seed-05)
    UPDATE comments c SET
      like_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id)
    WHERE c.id::text LIKE 'f00000%';

    -- users (followers_count, following_count — trigger handles live, but seed order may vary)
    UPDATE users u SET
      followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = u.id),
      following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id)
    WHERE u.id::text LIKE '0000000%-0000-0000-0000-000000000000';
  `);

};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM activities       WHERE user_id::text LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM player_state     WHERE user_id::text LIKE '0000000%-0000-0000-0000-000000000000';`);
  await db.runSql(`DELETE FROM listening_history WHERE user_id::text LIKE '0000000%-0000-0000-0000-000000000000';`);
  // Reset counters to 0
  await db.runSql(`UPDATE tracks    SET like_count=0,repost_count=0,comment_count=0,play_count=0 WHERE id::text LIKE 'c00000%';`);
  await db.runSql(`UPDATE albums    SET like_count=0,repost_count=0,track_count=0               WHERE id::text LIKE 'd00000%';`);
  await db.runSql(`UPDATE playlists SET like_count=0,repost_count=0,track_count=0               WHERE id::text LIKE 'e00000%';`);
  await db.runSql(`UPDATE comments  SET like_count=0,reply_count=0                              WHERE id::text LIKE 'f00000%';`);
  await db.runSql(`UPDATE users     SET followers_count=0,following_count=0 WHERE id::text LIKE '0000000%-0000-0000-0000-000000000000';`);
};

exports._meta = { version: 1 };