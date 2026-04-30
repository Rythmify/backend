'use strict';

exports.setup = function () {};

const SEEDED_ARTIST_EMAILS = [
  'tameimpala@rythmify.com',
  'radiohead@rythmify.com',
  'arcticmonkeys@rythmify.com',
  'marwanpablo@rythmify.com',
  'dominicfike@rythmify.com',
  'glassanimals@rythmify.com',
  'tul8te@rythmify.com',
  'amrdiab@rythmify.com',
  'elissa@rythmify.com',
  'adele@rythmify.com',
  'cairokee@rythmify.com',
  'theweeknd@rythmify.com',
  'drake@rythmify.com',
  'kendricklamar@rythmify.com',
  'frankocean@rythmify.com',
  'tylerthecreator@rythmify.com',
  'billieeilish@rythmify.com',
  'daftpunk@rythmify.com',
];

const SEEDED_TAG_NAMES = [
  'psychedelic',
  'alternative',
  'indie',
  'trap',
  'arabic',
  'pop',
  'rock',
  'rnb',
  'soul',
  'hiphop',
  'electronic',
  'synth',
  'chill',
  'vibes',
  'classic',
  'underground',
  'mainstream',
  'party',
  'study',
  'workout',
  'sleep',
  'driving',
  'mood',
];

exports.up = async function (db) {
  await db.runSql(`
    WITH genre_tag_map (genre_name, tag_name) AS (
      VALUES
        ('Psychedelic Rock', 'psychedelic'),
        ('Psychedelic Rock', 'rock'),
        ('Psychedelic Rock', 'classic'),
        ('Psychedelic Rock', 'vibes'),
        ('Alternative Rock', 'alternative'),
        ('Alternative Rock', 'rock'),
        ('Alternative Rock', 'classic'),
        ('Alternative Rock', 'mood'),
        ('Indie Rock', 'indie'),
        ('Indie Rock', 'rock'),
        ('Indie Rock', 'vibes'),
        ('Indie Rock', 'driving'),
        ('Arabic Trap', 'arabic'),
        ('Arabic Trap', 'trap'),
        ('Arabic Trap', 'hiphop'),
        ('Arabic Trap', 'underground'),
        ('Arabic Rap', 'arabic'),
        ('Arabic Rap', 'hiphop'),
        ('Arabic Rap', 'underground'),
        ('Arabic Pop', 'arabic'),
        ('Arabic Pop', 'pop'),
        ('Arabic Pop', 'mainstream'),
        ('Arabic Pop', 'vibes'),
        ('Arabic Rock', 'arabic'),
        ('Arabic Rock', 'rock'),
        ('Arabic Rock', 'alternative'),
        ('Arabic Rock', 'driving'),
        ('R&B', 'rnb'),
        ('R&B', 'soul'),
        ('R&B', 'chill'),
        ('R&B', 'mood'),
        ('Neo-Soul', 'soul'),
        ('Neo-Soul', 'rnb'),
        ('Neo-Soul', 'chill'),
        ('Hip-Hop', 'hiphop'),
        ('Hip-Hop', 'mainstream'),
        ('Hip-Hop', 'party'),
        ('Hip-Hop', 'workout'),
        ('Pop', 'pop'),
        ('Pop', 'mainstream'),
        ('Pop', 'party'),
        ('Pop', 'vibes'),
        ('Electronic', 'electronic'),
        ('Electronic', 'synth'),
        ('Electronic', 'party'),
        ('Electronic', 'driving'),
        ('Synth Pop', 'synth'),
        ('Synth Pop', 'pop'),
        ('Synth Pop', 'electronic'),
        ('Synth Pop', 'chill'),
        ('Indie Pop', 'indie'),
        ('Indie Pop', 'pop'),
        ('Indie Pop', 'chill'),
        ('Indie Pop', 'vibes')
    ),
    seeded_tracks AS (
      SELECT t.id AS track_id, g.name AS genre_name
      FROM tracks t
      JOIN genres g ON g.id = t.genre_id
      JOIN users u ON u.id = t.user_id
      WHERE u.email = ANY (ARRAY[${SEEDED_ARTIST_EMAILS.map((email) => `'${email}'`).join(', ')}])
        AND u.role = 'artist'
    ),
    tag_ids AS (
      SELECT id AS tag_id, name AS tag_name
      FROM tags
      WHERE name = ANY (ARRAY[${SEEDED_TAG_NAMES.map((tag) => `'${tag}'`).join(', ')}])
    )
    INSERT INTO track_tags (track_id, tag_id, created_at)
    SELECT st.track_id, ti.tag_id, NOW()
    FROM seeded_tracks st
    JOIN genre_tag_map gtm ON gtm.genre_name = st.genre_name
    JOIN tag_ids ti ON ti.tag_name = gtm.tag_name
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    WITH seeded_artist_tracks AS (
      SELECT t.id
      FROM tracks t
      JOIN users u ON u.id = t.user_id
      WHERE u.email = ANY (ARRAY[${SEEDED_ARTIST_EMAILS.map((email) => `'${email}'`).join(', ')}])
        AND u.role = 'artist'
    )
    DELETE FROM track_tags
    WHERE track_id IN (SELECT id FROM seeded_artist_tracks);
  `);
};

exports._meta = { version: 1 };
