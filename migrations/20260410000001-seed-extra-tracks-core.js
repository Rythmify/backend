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
  // ----------------------------------------------------------
  // 1) INSERT tracks (c0000020–c0000039)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO tracks (
      id,
      title,
      description,
      genre_id,
      user_id,
      cover_image,
      waveform_url,
      audio_url,
      stream_url,
      preview_url,
      duration,
      file_size,
      bitrate,
      status,
      is_public,
      is_trending,
      is_featured,
      is_hidden,
      release_date,
      explicit_content,
      license_type,
      enable_downloads,
      enable_offline_listening,
      include_in_rss_feed,
      display_embed_code,
      enable_app_playback,
      allow_comments,
      show_comments_public,
      show_insights_public,
      geo_restriction_type,
      play_count,
      like_count,
      comment_count,
      repost_count,
      created_at,
      secret_token
    ) VALUES
    (
      'c0000020-0000-0000-0000-000000000000',
      'Afterglow Circuit',
      'Neon-drenched electronic roller with a clean midnight build.',
      'a0000001-0000-0000-0000-000000000000',
      '00000002-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/afterglow-circuit/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/afterglow-circuit.mp3',
      'https://cdn.rythmify.com/streams/afterglow-circuit.mp3',
      NULL,
      258,
      9804000,
      320,
      'ready',
      true,
      true,
      false,
      false,
      CURRENT_DATE - INTERVAL '78 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      64000,
      0,
      0,
      0,
      NOW() - INTERVAL '78 days',
      NULL
    ),

    (
      'c0000021-0000-0000-0000-000000000000',
      'Static Avenue',
      'A driving club cut with pulsing bass and city-night momentum.',
      'a0000001-0000-0000-0000-000000000000',
      '00000002-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/static-avenue/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/static-avenue.mp3',
      'https://cdn.rythmify.com/streams/static-avenue.mp3',
      NULL,
      231,
      8778000,
      320,
      'ready',
      true,
      true,
      false,
      false,
      CURRENT_DATE - INTERVAL '112 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      48500,
      0,
      0,
      0,
      NOW() - INTERVAL '112 days',
      NULL
    ),

    (
      'c0000022-0000-0000-0000-000000000000',
      'Signal Fade',
      'Warm pads, late-night motion, and a low-end drop made for tunnels.',
      'a0000001-0000-0000-0000-000000000000',
      '00000002-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/signal-fade/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/signal-fade.mp3',
      'https://cdn.rythmify.com/streams/signal-fade.mp3',
      NULL,
      244,
      9272000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '148 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      36200,
      0,
      0,
      0,
      NOW() - INTERVAL '148 days',
      NULL
    ),

    (
      'c0000023-0000-0000-0000-000000000000',
      'Glass Run',
      'Fast synth pulses and clean percussion for long highway drives.',
      'a0000001-0000-0000-0000-000000000000',
      '00000002-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/glass-run/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/glass-run.mp3',
      'https://cdn.rythmify.com/streams/glass-run.mp3',
      NULL,
      219,
      8322000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '196 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      21800,
      0,
      0,
      0,
      NOW() - INTERVAL '196 days',
      NULL
    ),

    (
      'c0000024-0000-0000-0000-000000000000',
      'Maple Street',
      'Soft indie guitars and a reflective vocal hook for quiet evenings.',
      'a0000003-0000-0000-0000-000000000000',
      '00000003-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/maple-street/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/maple-street.mp3',
      'https://cdn.rythmify.com/streams/maple-street.mp3',
      NULL,
      204,
      7752000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '210 days',
      false,
      'creative_commons',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      18200,
      0,
      0,
      0,
      NOW() - INTERVAL '210 days',
      NULL
    ),

    (
      'c0000025-0000-0000-0000-000000000000',
      'Loose Ends',
      'Melodic indie pop with a wistful chorus and bright room tone.',
      'a0000003-0000-0000-0000-000000000000',
      '00000003-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/loose-ends/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/loose-ends.mp3',
      'https://cdn.rythmify.com/streams/loose-ends.mp3',
      NULL,
      188,
      7144000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '238 days',
      false,
      'creative_commons',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      14500,
      0,
      0,
      0,
      NOW() - INTERVAL '238 days',
      NULL
    ),

    (
      'c0000026-0000-0000-0000-000000000000',
      'Windowlight',
      'A calm acoustic-driven song that feels like sunrise through curtains.',
      'a0000003-0000-0000-0000-000000000000',
      '00000003-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/windowlight/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/windowlight.mp3',
      'https://cdn.rythmify.com/streams/windowlight.mp3',
      NULL,
      176,
      6688000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '265 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      9700,
      0,
      0,
      0,
      NOW() - INTERVAL '265 days',
      NULL
    ),

    (
      'c0000027-0000-0000-0000-000000000000',
      'Night Market',
      'Trap drums, dark synths, and a tight hook built for night rides.',
      'a0000002-0000-0000-0000-000000000000',
      '00000004-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/night-market/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/night-market.mp3',
      'https://cdn.rythmify.com/streams/night-market.mp3',
      NULL,
      198,
      7524000,
      320,
      'ready',
      true,
      true,
      false,
      false,
      CURRENT_DATE - INTERVAL '96 days',
      true,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      44100,
      0,
      0,
      0,
      NOW() - INTERVAL '96 days',
      NULL
    ),

    (
      'c0000028-0000-0000-0000-000000000000',
      'Brickline',
      'A heavy 808-led beat with sharp hats and street-corner tension.',
      'a0000002-0000-0000-0000-000000000000',
      '00000004-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/brickline/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/brickline.mp3',
      'https://cdn.rythmify.com/streams/brickline.mp3',
      NULL,
      205,
      7790000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '134 days',
      true,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      32700,
      0,
      0,
      0,
      NOW() - INTERVAL '134 days',
      NULL
    ),

    (
      'c0000029-0000-0000-0000-000000000000',
      'Red Zone',
      'Fast, aggressive trap production with a cold nocturnal edge.',
      'a0000002-0000-0000-0000-000000000000',
      '00000004-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/red-zone/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/red-zone.mp3',
      'https://cdn.rythmify.com/streams/red-zone.mp3',
      NULL,
      191,
      7258000,
      320,
      'ready',
      true,
      true,
      false,
      false,
      CURRENT_DATE - INTERVAL '173 days',
      true,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      28900,
      0,
      0,
      0,
      NOW() - INTERVAL '173 days',
      NULL
    ),

    (
      'c0000030-0000-0000-0000-000000000000',
      'Cut Corners',
      'Boom-bap grit with dusty drums and a relentless groove.',
      'a0000002-0000-0000-0000-000000000000',
      '00000004-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/cut-corners/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/cut-corners.mp3',
      'https://cdn.rythmify.com/streams/cut-corners.mp3',
      NULL,
      223,
      8474000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '286 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      15100,
      0,
      0,
      0,
      NOW() - INTERVAL '286 days',
      NULL
    ),

    (
      'c0000031-0000-0000-0000-000000000000',
      'Copper Moon',
      'Warm piano voicings and brushed drums for an intimate midnight set.',
      'a0000004-0000-0000-0000-000000000000',
      '00000005-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/copper-moon/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/copper-moon.mp3',
      'https://cdn.rythmify.com/streams/copper-moon.mp3',
      NULL,
      272,
      10336000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '320 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      9100,
      0,
      0,
      0,
      NOW() - INTERVAL '320 days',
      NULL
    ),

    (
      'c0000032-0000-0000-0000-000000000000',
      'Soft Brass',
      'Slow-burning jazz with elegant phrasing and late-hour calm.',
      'a0000004-0000-0000-0000-000000000000',
      '00000005-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/soft-brass/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/soft-brass.mp3',
      'https://cdn.rythmify.com/streams/soft-brass.mp3',
      NULL,
      289,
      10982000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '360 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      7800,
      0,
      0,
      0,
      NOW() - INTERVAL '360 days',
      NULL
    ),

    (
      'c0000033-0000-0000-0000-000000000000',
      'Velour Room',
      'A melodic lounge piece with gentle swing and smoky texture.',
      'a0000004-0000-0000-0000-000000000000',
      '00000005-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/velour-room/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/velour-room.mp3',
      'https://cdn.rythmify.com/streams/velour-room.mp3',
      NULL,
      301,
      11438000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '398 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      6200,
      0,
      0,
      0,
      NOW() - INTERVAL '398 days',
      NULL
    ),

    (
      'c0000034-0000-0000-0000-000000000000',
      'Mirror Drive',
      'Bright synth-pop with a fast chorus and widescreen neon energy.',
      'a0000006-0000-0000-0000-000000000000',
      '00000006-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/mirror-drive/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/mirror-drive.mp3',
      'https://cdn.rythmify.com/streams/mirror-drive.mp3',
      NULL,
      226,
      8588000,
      320,
      'ready',
      true,
      true,
      false,
      false,
      CURRENT_DATE - INTERVAL '88 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      33300,
      0,
      0,
      0,
      NOW() - INTERVAL '88 days',
      NULL
    ),

    (
      'c0000035-0000-0000-0000-000000000000',
      'Night Chrome',
      'Upbeat retro-futurist pop with cinematic pads and punchy drums.',
      'a0000006-0000-0000-0000-000000000000',
      '00000006-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/night-chrome/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/night-chrome.mp3',
      'https://cdn.rythmify.com/streams/night-chrome.mp3',
      NULL,
      234,
      8892000,
      320,
      'ready',
      true,
      true,
      false,
      false,
      CURRENT_DATE - INTERVAL '118 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      27400,
      0,
      0,
      0,
      NOW() - INTERVAL '118 days',
      NULL
    ),

    (
      'c0000036-0000-0000-0000-000000000000',
      'Violet Echo',
      'Glossy synth textures, driving rhythm, and a giant chorus lift.',
      'a0000006-0000-0000-0000-000000000000',
      '00000006-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/violet-echo/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/violet-echo.mp3',
      'https://cdn.rythmify.com/streams/violet-echo.mp3',
      NULL,
      241,
      9158000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '156 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      20500,
      0,
      0,
      0,
      NOW() - INTERVAL '156 days',
      NULL
    ),

    (
      'c0000037-0000-0000-0000-000000000000',
      'Last Transmission',
      'A cinematic synth-pop closer with analog warmth and motion.',
      'a0000006-0000-0000-0000-000000000000',
      '00000006-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/last-transmission/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/last-transmission.mp3',
      'https://cdn.rythmify.com/streams/last-transmission.mp3',
      NULL,
      247,
      9386000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '244 days',
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      13200,
      0,
      0,
      0,
      NOW() - INTERVAL '244 days',
      NULL
    ),

    (
      'c0000038-0000-0000-0000-000000000000',
      'Desk Lamp',
      'Lo-fi study loop with dusty keys and soft tape hiss.',
      'a0000007-0000-0000-0000-000000000000',
      '00000007-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/desk-lamp/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/desk-lamp.mp3',
      'https://cdn.rythmify.com/streams/desk-lamp.mp3',
      NULL,
      174,
      6612000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '180 days',
      false,
      'creative_commons',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      12800,
      0,
      0,
      0,
      NOW() - INTERVAL '180 days',
      NULL
    ),

    (
      'c0000039-0000-0000-0000-000000000000',
      'Quiet Signal',
      'Gentle lo-fi groove for reading, rain, and long focus sessions.',
      'a0000007-0000-0000-0000-000000000000',
      '00000007-0000-0000-0000-000000000000',
      'https://picsum.photos/seed/quiet-signal/300/300',
      NULL,
      'https://cdn.rythmify.com/audio/quiet-signal.mp3',
      'https://cdn.rythmify.com/streams/quiet-signal.mp3',
      NULL,
      186,
      7068000,
      320,
      'ready',
      true,
      false,
      false,
      false,
      CURRENT_DATE - INTERVAL '300 days',
      false,
      'creative_commons',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      8400,
      0,
      0,
      0,
      NOW() - INTERVAL '300 days',
      NULL
    )
  `);

  // ----------------------------------------------------------
  // 2) INSERT track_tags
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO track_tags (
      id,
      track_id,
      tag_id,
      created_at
    ) VALUES
    (
      gen_random_uuid(),
      'c0000020-0000-0000-0000-000000000000',
      'b0000003-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000020-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000021-0000-0000-0000-000000000000',
      'b0000003-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000021-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000021-0000-0000-0000-000000000000',
      'b0000002-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000022-0000-0000-0000-000000000000',
      'b0000003-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000022-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000023-0000-0000-0000-000000000000',
      'b0000003-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000023-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000023-0000-0000-0000-000000000000',
      'b0000002-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000024-0000-0000-0000-000000000000',
      'b0000007-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000024-0000-0000-0000-000000000000',
      'b0000010-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000025-0000-0000-0000-000000000000',
      'b0000007-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000025-0000-0000-0000-000000000000',
      'b0000010-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000025-0000-0000-0000-000000000000',
      'b0000001-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000026-0000-0000-0000-000000000000',
      'b0000007-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000026-0000-0000-0000-000000000000',
      'b0000010-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000027-0000-0000-0000-000000000000',
      'b0000006-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000027-0000-0000-0000-000000000000',
      'b0000012-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000027-0000-0000-0000-000000000000',
      'b0000008-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000028-0000-0000-0000-000000000000',
      'b0000006-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000028-0000-0000-0000-000000000000',
      'b0000012-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000029-0000-0000-0000-000000000000',
      'b0000006-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000029-0000-0000-0000-000000000000',
      'b0000012-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000029-0000-0000-0000-000000000000',
      'b0000008-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000030-0000-0000-0000-000000000000',
      'b0000006-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000030-0000-0000-0000-000000000000',
      'b0000012-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000031-0000-0000-0000-000000000000',
      'b0000004-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000031-0000-0000-0000-000000000000',
      'b0000010-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000031-0000-0000-0000-000000000000',
      'b0000001-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000032-0000-0000-0000-000000000000',
      'b0000004-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000032-0000-0000-0000-000000000000',
      'b0000010-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000033-0000-0000-0000-000000000000',
      'b0000004-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000033-0000-0000-0000-000000000000',
      'b0000010-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000033-0000-0000-0000-000000000000',
      'b0000001-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000034-0000-0000-0000-000000000000',
      'b0000009-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000034-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000035-0000-0000-0000-000000000000',
      'b0000009-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000035-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000035-0000-0000-0000-000000000000',
      'b0000011-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000036-0000-0000-0000-000000000000',
      'b0000009-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000036-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000037-0000-0000-0000-000000000000',
      'b0000009-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000037-0000-0000-0000-000000000000',
      'b0000014-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000037-0000-0000-0000-000000000000',
      'b0000011-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000038-0000-0000-0000-000000000000',
      'b0000005-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000038-0000-0000-0000-000000000000',
      'b0000015-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000039-0000-0000-0000-000000000000',
      'b0000005-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000039-0000-0000-0000-000000000000',
      'b0000015-0000-0000-0000-000000000000',
      NOW()
    ),

    (
      gen_random_uuid(),
      'c0000039-0000-0000-0000-000000000000',
      'b0000001-0000-0000-0000-000000000000',
      NOW()
    )
  `);

  // ----------------------------------------------------------
  // 3) UPDATE cover_image on c0000001–c0000019 (Picsum backfill)
  // ----------------------------------------------------------
  await db.runSql(`
    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/midnight-run/300/300'
    WHERE id = 'c0000001-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/solar-drift/300/300'
    WHERE id = 'c0000002-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/neon-city/300/300'
    WHERE id = 'c0000003-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/deep-pulse/300/300'
    WHERE id = 'c0000004-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/echo-lane/300/300'
    WHERE id = 'c0000005-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/paper-planes/300/300'
    WHERE id = 'c0000006-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/morning-light/300/300'
    WHERE id = 'c0000007-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/street-code/300/300'
    WHERE id = 'c0000008-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/rooftop-sessions/300/300'
    WHERE id = 'c0000009-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/grind-time/300/300'
    WHERE id = 'c0000010-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/blue-hour/300/300'
    WHERE id = 'c0000011-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/velvet-smoke/300/300'
    WHERE id = 'c0000012-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/crystal-matrix/300/300'
    WHERE id = 'c0000013-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/void-walker/300/300'
    WHERE id = 'c0000014-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/coffee-shop-rain/300/300'
    WHERE id = 'c0000015-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/warm-static/300/300'
    WHERE id = 'c0000016-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/unreleased-demo/300/300'
    WHERE id = 'c0000017-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/neon-dreams/300/300'
    WHERE id = 'c0000018-0000-0000-0000-000000000000';

    UPDATE tracks
    SET cover_image = 'https://picsum.photos/seed/midnight-hustle/300/300'
    WHERE id = 'c0000019-0000-0000-0000-000000000000';
  `);
};

exports.down = async function (db) {
  await db.runSql(`
      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/midnight-run.jpg'
      WHERE id = 'c0000001-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/solar-drift.jpg'
      WHERE id = 'c0000002-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/neon-city.jpg'
      WHERE id = 'c0000003-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/deep-pulse.jpg'
      WHERE id = 'c0000004-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/echo-lane.jpg'
      WHERE id = 'c0000005-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/paper-planes.jpg'
      WHERE id = 'c0000006-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/morning-light.jpg'
      WHERE id = 'c0000007-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/street-code.jpg'
      WHERE id = 'c0000008-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/rooftop-sessions.jpg'
      WHERE id = 'c0000009-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/grind-time.jpg'
      WHERE id = 'c0000010-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/blue-hour.jpg'
      WHERE id = 'c0000011-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/velvet-smoke.jpg'
      WHERE id = 'c0000012-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/crystal-matrix.jpg'
      WHERE id = 'c0000013-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/void-walker.jpg'
      WHERE id = 'c0000014-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/coffee-shop-rain.jpg'
      WHERE id = 'c0000015-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/warm-static.jpg'
      WHERE id = 'c0000016-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = NULL
      WHERE id = 'c0000017-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/neon-dreams.jpg'
      WHERE id = 'c0000018-0000-0000-0000-000000000000';

      UPDATE tracks
      SET cover_image = 'https://cdn.rythmify.com/covers/midnight-hustle.jpg'
      WHERE id = 'c0000019-0000-0000-0000-000000000000';
    `);
  await db.runSql(`
      DELETE FROM track_tags
      WHERE track_id IN (
        'c0000020-0000-0000-0000-000000000000'::uuid,
        'c0000021-0000-0000-0000-000000000000'::uuid,
        'c0000022-0000-0000-0000-000000000000'::uuid,
        'c0000023-0000-0000-0000-000000000000'::uuid,
        'c0000024-0000-0000-0000-000000000000'::uuid,
        'c0000025-0000-0000-0000-000000000000'::uuid,
        'c0000026-0000-0000-0000-000000000000'::uuid,
        'c0000027-0000-0000-0000-000000000000'::uuid,
        'c0000028-0000-0000-0000-000000000000'::uuid,
        'c0000029-0000-0000-0000-000000000000'::uuid,
        'c0000030-0000-0000-0000-000000000000'::uuid,
        'c0000031-0000-0000-0000-000000000000'::uuid,
        'c0000032-0000-0000-0000-000000000000'::uuid,
        'c0000033-0000-0000-0000-000000000000'::uuid,
        'c0000034-0000-0000-0000-000000000000'::uuid,
        'c0000035-0000-0000-0000-000000000000'::uuid,
        'c0000036-0000-0000-0000-000000000000'::uuid,
        'c0000037-0000-0000-0000-000000000000'::uuid,
        'c0000038-0000-0000-0000-000000000000'::uuid,
        'c0000039-0000-0000-0000-000000000000'::uuid
      );
    `);
  await db.runSql(`
      DELETE FROM tracks
      WHERE id IN (
        'c0000020-0000-0000-0000-000000000000'::uuid,
        'c0000021-0000-0000-0000-000000000000'::uuid,
        'c0000022-0000-0000-0000-000000000000'::uuid,
        'c0000023-0000-0000-0000-000000000000'::uuid,
        'c0000024-0000-0000-0000-000000000000'::uuid,
        'c0000025-0000-0000-0000-000000000000'::uuid,
        'c0000026-0000-0000-0000-000000000000'::uuid,
        'c0000027-0000-0000-0000-000000000000'::uuid,
        'c0000028-0000-0000-0000-000000000000'::uuid,
        'c0000029-0000-0000-0000-000000000000'::uuid,
        'c0000030-0000-0000-0000-000000000000'::uuid,
        'c0000031-0000-0000-0000-000000000000'::uuid,
        'c0000032-0000-0000-0000-000000000000'::uuid,
        'c0000033-0000-0000-0000-000000000000'::uuid,
        'c0000034-0000-0000-0000-000000000000'::uuid,
        'c0000035-0000-0000-0000-000000000000'::uuid,
        'c0000036-0000-0000-0000-000000000000'::uuid,
        'c0000037-0000-0000-0000-000000000000'::uuid,
        'c0000038-0000-0000-0000-000000000000'::uuid,
        'c0000039-0000-0000-0000-000000000000'::uuid
      );
    `);
};

exports._meta = {
  version: 1,
};
