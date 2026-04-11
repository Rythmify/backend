'use strict';

let dbm;
let type;
let seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  
  // Insert 2 recent tracks (within last 7 days)
  await db.runSql(`
    INSERT INTO tracks (
      id, 
      title, 
      description, 
      genre_id, 
      user_id,
      cover_image,
      audio_url,
      stream_url,
      duration,
      status,
      is_public,
      is_hidden,
      is_trending,
      explicit_content,
      license_type,
      enable_downloads,
      enable_offline_listening,
      play_count,
      like_count,
      comment_count,
      repost_count,
      created_at,
      release_date
    ) VALUES 
    
    -- Track 1: Recent Electronic Banger by DJ Karim
    (
      'c0000018-0000-0000-0000-000000000000',
      'Neon Dreams',
      'Fresh electronic track with synthwave vibes. Perfect for late-night drives.',
      'a0000001-0000-0000-0000-000000000000',
      '00000002-0000-0000-0000-000000000000',
      'https://cdn.rythmify.com/covers/neon-dreams.jpg',
      'https://cdn.rythmify.com/audio/neon-dreams.mp3',
      'https://cdn.rythmify.com/streams/neon-dreams.mp3',
      215,
      'ready',
      true,
      false,
      true,
      false,
      'all_rights_reserved',
      true,
      true,
      15420,
      0,
      0,
      0,
      NOW() - INTERVAL '2 days',
      CURRENT_DATE - INTERVAL '2 days'
    ),
    
    -- Track 2: Fresh Hip-Hop Beat by BeatMaker99
    (
      'c0000019-0000-0000-0000-000000000000',
      'Midnight Hustle',
      'Hard-hitting trap beat with modern 808s. Street anthem in the making.',
      'a0000002-0000-0000-0000-000000000000',
      '00000004-0000-0000-0000-000000000000',
      'https://cdn.rythmify.com/covers/midnight-hustle.jpg',
      'https://cdn.rythmify.com/audio/midnight-hustle.mp3',
      'https://cdn.rythmify.com/streams/midnight-hustle.mp3',
      198,
      'ready',
      true,
      false,
      true,
      true,
      'all_rights_reserved',
      true,
      true,
      8920,
      0,
      0,
      0,
      NOW() - INTERVAL '1 day',
      CURRENT_DATE - INTERVAL '1 day'
    );
  `);

  // Add tags to the new tracks
  await db.runSql(`
    INSERT INTO track_tags (id, track_id, tag_id, created_at) VALUES
    
    -- Tags for Neon Dreams (Electronic track)
    (gen_random_uuid(), 'c0000018-0000-0000-0000-000000000000', 'b0000003-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(), 'c0000018-0000-0000-0000-000000000000', 'b0000009-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(), 'c0000018-0000-0000-0000-000000000000', 'b0000014-0000-0000-0000-000000000000', NOW()),
    
    -- Tags for Midnight Hustle (Hip-Hop track)
    (gen_random_uuid(), 'c0000019-0000-0000-0000-000000000000', 'b0000006-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(), 'c0000019-0000-0000-0000-000000000000', 'b0000003-0000-0000-0000-000000000000', NOW()),
    (gen_random_uuid(), 'c0000019-0000-0000-0000-000000000000', 'b0000012-0000-0000-0000-000000000000', NOW());
  `);
};

exports.down = async function(db) {
  // Remove track tags
  await db.runSql(`
    DELETE FROM track_tags 
    WHERE track_id IN ('c0000018-0000-0000-0000-000000000000', 'c0000019-0000-0000-0000-000000000000');
  `);
  
  // Remove the tracks themselves
  await db.runSql(`
    DELETE FROM tracks 
    WHERE id IN ('c0000018-0000-0000-0000-000000000000', 'c0000019-0000-0000-0000-000000000000');
  `);
  
  console.log('Removed recent trending tracks');
};

exports._meta = {
  version: 1
};