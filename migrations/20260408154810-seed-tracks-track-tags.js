'use strict';

// =============================================================
// SEED 03 — tracks, track_tags, track_artists
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {

  await db.runSql(`
    INSERT INTO tracks
      (id, title, description, genre_id, cover_image, waveform_url,
       audio_url, stream_url, preview_url,
       duration, file_size, bitrate, status, is_public, is_trending,
       user_id, release_date,
       explicit_content, license_type,
       enable_downloads, enable_offline_listening, include_in_rss_feed,
       display_embed_code, enable_app_playback,
       allow_comments, show_comments_public, show_insights_public,
       geo_restriction_type,
       play_count, like_count, comment_count, repost_count,
       created_at)
    VALUES

    -- ── DJ KARIM  (Electronic) ────────────────────────────

    ('c0000001-0000-0000-0000-000000000000',
     'Midnight Run','Late-night electronic banger. Drop at 1:32.',
     'a0000001-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/midnight-run.jpg',
     'https://cdn.rythmify.com/waveforms/midnight-run.json',
     'https://cdn.rythmify.com/audio/midnight-run.mp3',
     'https://cdn.rythmify.com/streams/midnight-run.mp3',
     'https://cdn.rythmify.com/previews/midnight-run.mp3',
     213, 8600000, 320, 'ready', true, true,
     '00000002-0000-0000-0000-000000000000', '2024-06-01',
     false, 'all_rights_reserved',
     false, true, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '280 days'),

    ('c0000002-0000-0000-0000-000000000000',
     'Solar Drift','Ambient electronic journey into the sunrise.',
     'a0000001-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/solar-drift.jpg',
     'https://cdn.rythmify.com/waveforms/solar-drift.json',
     'https://cdn.rythmify.com/audio/solar-drift.mp3',
     'https://cdn.rythmify.com/streams/solar-drift.mp3',
     'https://cdn.rythmify.com/previews/solar-drift.mp3',
     187, 7200000, 320, 'ready', true, false,
     '00000002-0000-0000-0000-000000000000', '2024-08-15',
     false, 'all_rights_reserved',
     false, true, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '220 days'),

    ('c0000003-0000-0000-0000-000000000000',
     'Neon City','Synthwave-inspired driving track.',
     'a0000001-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/neon-city.jpg',
     'https://cdn.rythmify.com/waveforms/neon-city.json',
     'https://cdn.rythmify.com/audio/neon-city.mp3',
     'https://cdn.rythmify.com/streams/neon-city.mp3',
     'https://cdn.rythmify.com/previews/neon-city.mp3',
     240, 9600000, 320, 'ready', true, true,
     '00000002-0000-0000-0000-000000000000', '2025-01-10',
     false, 'all_rights_reserved',
     false, true, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '120 days'),

    ('c0000004-0000-0000-0000-000000000000',
     'Deep Pulse','Four-to-the-floor techno workout.',
     'a0000001-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/deep-pulse.jpg',
     'https://cdn.rythmify.com/waveforms/deep-pulse.json',
     'https://cdn.rythmify.com/audio/deep-pulse.mp3',
     'https://cdn.rythmify.com/streams/deep-pulse.mp3',
     'https://cdn.rythmify.com/previews/deep-pulse.mp3',
     352, 14000000, 320, 'ready', true, false,
     '00000002-0000-0000-0000-000000000000', '2025-03-05',
     false, 'all_rights_reserved',
     false, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '60 days'),

    -- ── NOUR EL SOUND  (Indie) ────────────────────────────

    ('c0000005-0000-0000-0000-000000000000',
     'Echo Lane','Dreamy indie with layered guitars.',
     'a0000003-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/echo-lane.jpg',
     'https://cdn.rythmify.com/waveforms/echo-lane.json',
     'https://cdn.rythmify.com/audio/echo-lane.mp3',
     'https://cdn.rythmify.com/streams/echo-lane.mp3',
     'https://cdn.rythmify.com/previews/echo-lane.mp3',
     198, 7800000, 320, 'ready', true, true,
     '00000003-0000-0000-0000-000000000000', '2024-09-20',
     false, 'creative_commons',
     true, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '200 days'),

    ('c0000006-0000-0000-0000-000000000000',
     'Paper Planes','Acoustic indie road-trip vibes.',
     'a0000003-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/paper-planes.jpg',
     'https://cdn.rythmify.com/waveforms/paper-planes.json',
     'https://cdn.rythmify.com/audio/paper-planes.mp3',
     'https://cdn.rythmify.com/streams/paper-planes.mp3',
     'https://cdn.rythmify.com/previews/paper-planes.mp3',
     205, 8200000, 320, 'ready', true, false,
     '00000003-0000-0000-0000-000000000000', '2024-11-01',
     false, 'creative_commons',
     true, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '160 days'),

    ('c0000007-0000-0000-0000-000000000000',
     'Morning Light','Upbeat indie pop to start your day.',
     'a0000003-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/morning-light.jpg',
     'https://cdn.rythmify.com/waveforms/morning-light.json',
     'https://cdn.rythmify.com/audio/morning-light.mp3',
     'https://cdn.rythmify.com/streams/morning-light.mp3',
     'https://cdn.rythmify.com/previews/morning-light.mp3',
     172, 6800000, 320, 'ready', true, false,
     '00000003-0000-0000-0000-000000000000', '2025-02-14',
     false, 'creative_commons',
     true, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '55 days'),

    -- ── BEATMAKER99  (Hip-Hop) ────────────────────────────

    ('c0000008-0000-0000-0000-000000000000',
     'Street Code','Hard trap beat. 808s knocking.',
     'a0000002-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/street-code.jpg',
     'https://cdn.rythmify.com/waveforms/street-code.json',
     'https://cdn.rythmify.com/audio/street-code.mp3',
     'https://cdn.rythmify.com/streams/street-code.mp3',
     'https://cdn.rythmify.com/previews/street-code.mp3',
     195, 7500000, 320, 'ready', true, true,
     '00000004-0000-0000-0000-000000000000', '2024-07-04',
     false, 'all_rights_reserved',
     false, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '240 days'),

    ('c0000009-0000-0000-0000-000000000000',
     'Rooftop Sessions','Lo-fi hip-hop for late-night studying.',
     'a0000002-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/rooftop-sessions.jpg',
     'https://cdn.rythmify.com/waveforms/rooftop-sessions.json',
     'https://cdn.rythmify.com/audio/rooftop-sessions.mp3',
     'https://cdn.rythmify.com/streams/rooftop-sessions.mp3',
     'https://cdn.rythmify.com/previews/rooftop-sessions.mp3',
     210, 8100000, 320, 'ready', true, false,
     '00000004-0000-0000-0000-000000000000', '2024-10-18',
     false, 'all_rights_reserved',
     false, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '170 days'),

    ('c0000010-0000-0000-0000-000000000000',
     'Grind Time','Boom-bap production for the daily hustle.',
     'a0000002-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/grind-time.jpg',
     'https://cdn.rythmify.com/waveforms/grind-time.json',
     'https://cdn.rythmify.com/audio/grind-time.mp3',
     'https://cdn.rythmify.com/streams/grind-time.mp3',
     'https://cdn.rythmify.com/previews/grind-time.mp3',
     225, 8700000, 320, 'ready', true, false,
     '00000004-0000-0000-0000-000000000000', '2025-01-22',
     false, 'all_rights_reserved',
     false, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '80 days'),

    -- ── LAYLA JAZZ  (Jazz) ────────────────────────────────

    ('c0000011-0000-0000-0000-000000000000',
     'Blue Hour','Late-night jazz with smoky saxophone.',
     'a0000004-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/blue-hour.jpg',
     'https://cdn.rythmify.com/waveforms/blue-hour.json',
     'https://cdn.rythmify.com/audio/blue-hour.mp3',
     'https://cdn.rythmify.com/streams/blue-hour.mp3',
     'https://cdn.rythmify.com/previews/blue-hour.mp3',
     285, 11000000, 320, 'ready', true, false,
     '00000005-0000-0000-0000-000000000000', '2024-05-30',
     false, 'all_rights_reserved',
     false, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '290 days'),

    ('c0000012-0000-0000-0000-000000000000',
     'Velvet Smoke','Smooth jazz for Sunday morning.',
     'a0000004-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/velvet-smoke.jpg',
     'https://cdn.rythmify.com/waveforms/velvet-smoke.json',
     'https://cdn.rythmify.com/audio/velvet-smoke.mp3',
     'https://cdn.rythmify.com/streams/velvet-smoke.mp3',
     'https://cdn.rythmify.com/previews/velvet-smoke.mp3',
     310, 12000000, 320, 'ready', true, false,
     '00000005-0000-0000-0000-000000000000', '2024-09-07',
     false, 'all_rights_reserved',
     false, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '190 days'),

    -- ── SYNTHLORD  (Synth-Pop + Ambient) ─────────────────

    ('c0000013-0000-0000-0000-000000000000',
     'Crystal Matrix','80s-inspired synth-pop anthem.',
     'a0000006-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/crystal-matrix.jpg',
     'https://cdn.rythmify.com/waveforms/crystal-matrix.json',
     'https://cdn.rythmify.com/audio/crystal-matrix.mp3',
     'https://cdn.rythmify.com/streams/crystal-matrix.mp3',
     'https://cdn.rythmify.com/previews/crystal-matrix.mp3',
     228, 8900000, 320, 'ready', true, true,
     '00000006-0000-0000-0000-000000000000', '2024-10-31',
     false, 'all_rights_reserved',
     false, true, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '160 days'),

    ('c0000014-0000-0000-0000-000000000000',
     'Void Walker','Deep ambient soundscape for focus.',
     'a0000005-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/void-walker.jpg',
     'https://cdn.rythmify.com/waveforms/void-walker.json',
     'https://cdn.rythmify.com/audio/void-walker.mp3',
     'https://cdn.rythmify.com/streams/void-walker.mp3',
     'https://cdn.rythmify.com/previews/void-walker.mp3',
     352, 13500000, 320, 'ready', true, false,
     '00000006-0000-0000-0000-000000000000', '2025-02-20',
     false, 'creative_commons',
     true, true, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '40 days'),

    -- ── RANA BEATS  (Lo-Fi + Ambient) ────────────────────
    
    ('c0000015-0000-0000-0000-000000000000',
     'Coffee Shop Rain','Lo-fi beats for rainy days.',
     'a0000007-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/coffee-shop-rain.jpg',
     'https://cdn.rythmify.com/waveforms/coffee-shop-rain.json',
     'https://cdn.rythmify.com/audio/coffee-shop-rain.mp3',
     'https://cdn.rythmify.com/streams/coffee-shop-rain.mp3',
     'https://cdn.rythmify.com/previews/coffee-shop-rain.mp3',
     182, 7000000, 320, 'ready', true, false,
     '00000007-0000-0000-0000-000000000000', '2024-12-05',
     false, 'creative_commons',
     true, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '130 days'),

    ('c0000016-0000-0000-0000-000000000000',
     'Warm Static','Cosy lo-fi for long study sessions.',
     'a0000007-0000-0000-0000-000000000000',
     'https://cdn.rythmify.com/covers/warm-static.jpg',
     'https://cdn.rythmify.com/waveforms/warm-static.json',
     'https://cdn.rythmify.com/audio/warm-static.mp3',
     'https://cdn.rythmify.com/streams/warm-static.mp3',
     'https://cdn.rythmify.com/previews/warm-static.mp3',
     196, 7600000, 320, 'ready', true, false,
     '00000007-0000-0000-0000-000000000000', '2025-01-30',
     false, 'creative_commons',
     true, false, true, true, true, true, true, true, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '65 days'),

    -- A private track (for testing access control)
    ('c0000017-0000-0000-0000-000000000000',
     'Unreleased Demo','Private work-in-progress.',
     'a0000001-0000-0000-0000-000000000000',
     NULL, NULL,
     'https://cdn.rythmify.com/audio/unreleased-demo.mp3',
     NULL, NULL,
     120, 4800000, 320, 'ready', false, false,
     '00000002-0000-0000-0000-000000000000', NULL,
     false, 'all_rights_reserved',
     false, false, false, false, false, false, false, false, 'worldwide',
     0, 0, 0, 0, NOW()-INTERVAL '15 days');
  `);

  // ----------------------------------------------------------
  // TRACK TAGS  (each track gets 2-3 tags)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO track_tags (id, track_id, tag_id, created_at) VALUES
    -- Midnight Run: late-night, dark, energetic
    (gen_random_uuid(),'c0000001-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000001-0000-0000-0000-000000000000','b0000008-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000001-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000', NOW()),
    -- Solar Drift: chill, instrumental, ambient feel
    (gen_random_uuid(),'c0000002-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000002-0000-0000-0000-000000000000','b0000004-0000-0000-0000-000000000000', NOW()),
    -- Neon City: driving, energetic, upbeat
    (gen_random_uuid(),'c0000003-0000-0000-0000-000000000000','b0000014-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000003-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000003-0000-0000-0000-000000000000','b0000009-0000-0000-0000-000000000000', NOW()),
    -- Deep Pulse: dark, energetic
    (gen_random_uuid(),'c0000004-0000-0000-0000-000000000000','b0000008-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000004-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000', NOW()),
    -- Echo Lane: melodic, chill
    (gen_random_uuid(),'c0000005-0000-0000-0000-000000000000','b0000010-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000005-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000', NOW()),
    -- Paper Planes: acoustic, summer
    (gen_random_uuid(),'c0000006-0000-0000-0000-000000000000','b0000007-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000006-0000-0000-0000-000000000000','b0000013-0000-0000-0000-000000000000', NOW()),
    -- Morning Light: upbeat, summer
    (gen_random_uuid(),'c0000007-0000-0000-0000-000000000000','b0000009-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000007-0000-0000-0000-000000000000','b0000013-0000-0000-0000-000000000000', NOW()),
    -- Street Code: trap, energetic
    (gen_random_uuid(),'c0000008-0000-0000-0000-000000000000','b0000006-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000008-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000', NOW()),
    -- Rooftop Sessions: lofi, late-night, study
    (gen_random_uuid(),'c0000009-0000-0000-0000-000000000000','b0000005-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000009-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000009-0000-0000-0000-000000000000','b0000015-0000-0000-0000-000000000000', NOW()),
    -- Grind Time: groove, energetic
    (gen_random_uuid(),'c0000010-0000-0000-0000-000000000000','b0000012-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000010-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000', NOW()),
    -- Blue Hour: late-night, instrumental, chill
    (gen_random_uuid(),'c0000011-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000011-0000-0000-0000-000000000000','b0000004-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000011-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000', NOW()),
    -- Velvet Smoke: chill, melodic
    (gen_random_uuid(),'c0000012-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000012-0000-0000-0000-000000000000','b0000010-0000-0000-0000-000000000000', NOW()),
    -- Crystal Matrix: upbeat, driving
    (gen_random_uuid(),'c0000013-0000-0000-0000-000000000000','b0000009-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000013-0000-0000-0000-000000000000','b0000014-0000-0000-0000-000000000000', NOW()),
    -- Void Walker: cinematic, instrumental, chill
    (gen_random_uuid(),'c0000014-0000-0000-0000-000000000000','b0000011-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000014-0000-0000-0000-000000000000','b0000004-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000014-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000', NOW()),
    -- Coffee Shop Rain: lofi, chill, study
    (gen_random_uuid(),'c0000015-0000-0000-0000-000000000000','b0000005-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000015-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000015-0000-0000-0000-000000000000','b0000015-0000-0000-0000-000000000000', NOW()),
    -- Warm Static: lofi, study, melodic
    (gen_random_uuid(),'c0000016-0000-0000-0000-000000000000','b0000005-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000016-0000-0000-0000-000000000000','b0000015-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(),'c0000016-0000-0000-0000-000000000000','b0000010-0000-0000-0000-000000000000', NOW());
  `);

  // ----------------------------------------------------------
  // TRACK ARTISTS  (featured artists on some collab tracks)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO track_artists (id, track_id, artist_id, position, created_at) VALUES
    -- Deep Pulse: Karim + SynthLord collab
    (gen_random_uuid(),'c0000004-0000-0000-0000-000000000000','00000002-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '60 days'),
    (gen_random_uuid(),'c0000004-0000-0000-0000-000000000000','00000006-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '60 days'),
    -- Rooftop Sessions: BeatMaker + Rana Beats
    (gen_random_uuid(),'c0000009-0000-0000-0000-000000000000','00000004-0000-0000-0000-000000000000', 1, NOW()-INTERVAL '170 days'),
    (gen_random_uuid(),'c0000009-0000-0000-0000-000000000000','00000007-0000-0000-0000-000000000000', 2, NOW()-INTERVAL '170 days');
  `);

};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM track_artists WHERE track_id LIKE 'c00000%';`);
  await db.runSql(`DELETE FROM track_tags    WHERE track_id LIKE 'c00000%';`);
  await db.runSql(`DELETE FROM tracks        WHERE id       LIKE 'c00000%';`);
};

exports._meta = { version: 1 };