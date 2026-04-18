'use strict';

// =============================================================
// SEED 04 — albums, album_tracks, playlists, playlist_tracks
// Depends on: seed-01 (users), seed-02 (genres), seed-03 (tracks)
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // ----------------------------------------------------------
  // ALBUMS  (fixed IDs: d000000N-...)
  // like_count, repost_count, track_count start at 0 —
  // triggers fired by album_likes / album_reposts / album_tracks
  // will keep them correct.
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO albums
      (id, title, description, artist_id, genre_id, is_public,
       release_date, like_count, repost_count, track_count,
       created_at)
    VALUES

    ('d0000001-0000-0000-0000-000000000000',
     'Midnight Sessions',
     'DJ Karim''s debut album. Four tracks of pure underground electronic.',
     '00000002-0000-0000-0000-000000000000',
     'a0000001-0000-0000-0000-000000000000',
     true, '2025-03-01',
     0, 0, 0, NOW()-INTERVAL '120 days'),

    ('d0000002-0000-0000-0000-000000000000',
     'Wander Notes',
     'Nour''s debut collection. Acoustic indie for the restless soul.',
     '00000003-0000-0000-0000-000000000000',
     'a0000003-0000-0000-0000-000000000000',
     true, '2025-02-14',
     0, 0, 0, NOW()-INTERVAL '80 days'),

    ('d0000003-0000-0000-0000-000000000000',
     'Concrete Jungle',
     'BeatMaker99''s street-level hip-hop project.',
     '00000004-0000-0000-0000-000000000000',
     'a0000002-0000-0000-0000-000000000000',
     true, '2024-11-15',
     0, 0, 0, NOW()-INTERVAL '200 days'),

    ('d0000004-0000-0000-0000-000000000000',
     'After Hours',
     'Layla Jazz - a late night jazz session, recorded live.',
     '00000005-0000-0000-0000-000000000000',
     'a0000004-0000-0000-0000-000000000000',
     true, '2024-08-10',
     0, 0, 0, NOW()-INTERVAL '240 days'),

    ('d0000005-0000-0000-0000-000000000000',
     'Synthetic Dreams',
     'SynthLord crosses synth-pop with deep ambient.',
     '00000006-0000-0000-0000-000000000000',
     'a0000006-0000-0000-0000-000000000000',
     true, '2025-01-05',
     0, 0, 0, NOW()-INTERVAL '95 days'),

    ('d0000006-0000-0000-0000-000000000000',
     'Still Hours',
     'Rana Beats lo-fi collection for sleepy afternoons.',
     '00000007-0000-0000-0000-000000000000',
     'a0000007-0000-0000-0000-000000000000',
     true, '2025-02-28',
     0, 0, 0, NOW()-INTERVAL '40 days');
  `);

  // ----------------------------------------------------------
  // ALBUM TRACKS
  // The trg_album_track_count trigger increments track_count.
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO album_tracks (id, album_id, track_id, position) VALUES
    -- Midnight Sessions (karim)
    (gen_random_uuid(),'d0000001-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 1),
    (gen_random_uuid(),'d0000001-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', 2),
    (gen_random_uuid(),'d0000001-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 3),
    (gen_random_uuid(),'d0000001-0000-0000-0000-000000000000','c0000004-0000-0000-0000-000000000000', 4),
    -- Wander Notes (nour)
    (gen_random_uuid(),'d0000002-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 1),
    (gen_random_uuid(),'d0000002-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000', 2),
    (gen_random_uuid(),'d0000002-0000-0000-0000-000000000000','c0000007-0000-0000-0000-000000000000', 3),
    -- Concrete Jungle (beatmaker)
    (gen_random_uuid(),'d0000003-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 1),
    (gen_random_uuid(),'d0000003-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', 2),
    (gen_random_uuid(),'d0000003-0000-0000-0000-000000000000','c0000010-0000-0000-0000-000000000000', 3),
    -- After Hours (layla)
    (gen_random_uuid(),'d0000004-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 1),
    (gen_random_uuid(),'d0000004-0000-0000-0000-000000000000','c0000012-0000-0000-0000-000000000000', 2),
    -- Synthetic Dreams (synthlord)
    (gen_random_uuid(),'d0000005-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 1),
    (gen_random_uuid(),'d0000005-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000', 2),
    -- Still Hours (rana)
    (gen_random_uuid(),'d0000006-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 1),
    (gen_random_uuid(),'d0000006-0000-0000-0000-000000000000','c0000016-0000-0000-0000-000000000000', 2);
  `);

  // ----------------------------------------------------------
  // PLAYLISTS  (fixed IDs: e000000N-...)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO playlists
      (id, name, description, type, is_public, secret_token,
       user_id, like_count, repost_count, track_count,
       created_at)
    VALUES

    -- Public listener playlists
    ('e0000001-0000-0000-0000-000000000000',
     'Late Night Electronic',
     'Best electronic for 3am sessions.',
     'regular', true, NULL,
     '00000008-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '140 days'),

    ('e0000002-0000-0000-0000-000000000000',
     'Morning Indie Vibes',
     'Start your day right with these indie gems.',
     'regular', true, NULL,
     '00000010-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '120 days'),

    ('e0000003-0000-0000-0000-000000000000',
     'Hip-Hop Essentials',
     'Core hip-hop and trap tracks.',
     'regular', true, NULL,
     '00000009-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '110 days'),

    ('e0000004-0000-0000-0000-000000000000',
     'Jazz After Hours',
     'Smooth late-night jazz.',
     'regular', true, NULL,
     '00000011-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '100 days'),

    ('e0000005-0000-0000-0000-000000000000',
     'Study Focus Mix',
     'Lo-fi and ambient for deep work.',
     'regular', true, NULL,
     '00000012-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '90 days'),

    ('e0000006-0000-0000-0000-000000000000',
     'Electronic Bangers 2025',
     'Every synth banger from the year so far.',
     'regular', true, NULL,
     '00000013-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '75 days'),

    -- Private playlist with secret token
    ('e0000007-0000-0000-0000-000000000000',
     'My Secret Drafts',
     'Private playlist — shareable by link only.',
     'regular', false, 'secret-tok-abc-xyz-9001',
     '00000009-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '50 days'),

    -- Liked Songs (system playlist — one per user)
    ('e0000008-0000-0000-0000-000000000000',
     'Liked Songs', NULL,
     'liked_songs', false, NULL,
     '00000008-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '150 days'),

    -- Auto-generated: Daily Drops & Weekly Wave (created by cron)
    ('e0000009-0000-0000-0000-000000000000',
     'Daily Drops',
     'Your top picks for today — refreshes every 24h.',
     'auto_generated', true, NULL,
     '00000008-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '1 day'),

    ('e0000010-0000-0000-0000-000000000000',
     'Weekly Wave',
     'Your best week — refreshes every Monday.',
     'auto_generated', true, NULL,
     '00000008-0000-0000-0000-000000000000',
     0, 0, 0, NOW()-INTERVAL '3 days');
  `);

  // ----------------------------------------------------------
  // PLAYLIST TRACKS
  // trg_playlist_track_count increments track_count per row.
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO playlist_tracks (id, playlist_id, track_id, position, added_at) VALUES

    -- Late Night Electronic
    (gen_random_uuid(),'e0000001-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '139 days'),
    (gen_random_uuid(),'e0000001-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '138 days'),
    (gen_random_uuid(),'e0000001-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '137 days'),
    (gen_random_uuid(),'e0000001-0000-0000-0000-000000000000','c0000004-0000-0000-0000-000000000000', 4, NOW()-INTERVAL '136 days'),

    -- Morning Indie Vibes
    (gen_random_uuid(),'e0000002-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '119 days'),
    (gen_random_uuid(),'e0000002-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '118 days'),
    (gen_random_uuid(),'e0000002-0000-0000-0000-000000000000','c0000007-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '117 days'),

    -- Hip-Hop Essentials
    (gen_random_uuid(),'e0000003-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '109 days'),
    (gen_random_uuid(),'e0000003-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '108 days'),
    (gen_random_uuid(),'e0000003-0000-0000-0000-000000000000','c0000010-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '107 days'),

    -- Jazz After Hours
    (gen_random_uuid(),'e0000004-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '99 days'),
    (gen_random_uuid(),'e0000004-0000-0000-0000-000000000000','c0000012-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '98 days'),

    -- Study Focus Mix
    (gen_random_uuid(),'e0000005-0000-0000-0000-000000000000','c0000015-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '89 days'),
    (gen_random_uuid(),'e0000005-0000-0000-0000-000000000000','c0000016-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '88 days'),
    (gen_random_uuid(),'e0000005-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '87 days'),
    (gen_random_uuid(),'e0000005-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000', 4, NOW()-INTERVAL '86 days'),

    -- Electronic Bangers 2025
    (gen_random_uuid(),'e0000006-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '74 days'),
    (gen_random_uuid(),'e0000006-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '73 days'),
    (gen_random_uuid(),'e0000006-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '72 days'),
    (gen_random_uuid(),'e0000006-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', 4, NOW()-INTERVAL '71 days'),

    -- My Secret Drafts
    (gen_random_uuid(),'e0000007-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '49 days'),
    (gen_random_uuid(),'e0000007-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '48 days'),

    -- Daily Drops (auto-generated)
    (gen_random_uuid(),'e0000009-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'e0000009-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '1 day'),
    (gen_random_uuid(),'e0000009-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '1 day'),

    -- Weekly Wave (auto-generated)
    (gen_random_uuid(),'e0000010-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'e0000010-0000-0000-0000-000000000000','c0000007-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'e0000010-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000', 3, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'e0000010-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000', 4, NOW()-INTERVAL '3 days'),
    (gen_random_uuid(),'e0000010-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000', 5, NOW()-INTERVAL '3 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM playlist_tracks WHERE playlist_id LIKE 'e00000%';`);
  await db.runSql(`DELETE FROM playlists       WHERE id          LIKE 'e00000%';`);
  await db.runSql(`DELETE FROM album_tracks    WHERE album_id    LIKE 'd00000%';`);
  await db.runSql(`DELETE FROM albums          WHERE id          LIKE 'd00000%';`);
};

exports._meta = { version: 1 };
