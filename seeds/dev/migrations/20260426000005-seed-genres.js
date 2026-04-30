'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    INSERT INTO genres (name, created_at)
    VALUES
      ('Psychedelic Rock', NOW()),
      ('Alternative Rock', NOW()),
      ('Indie Rock',       NOW()),
      ('Arabic Trap',      NOW()),
      ('Arabic Rap',       NOW()),
      ('Arabic Pop',       NOW()),
      ('Arabic Rock',      NOW()),
      ('R&B',              NOW()),
      ('Neo-Soul',         NOW()),
      ('Hip-Hop',          NOW()),
      ('Pop',              NOW()),
      ('Electronic',       NOW()),
      ('Synth Pop',        NOW()),
      ('Indie Pop',        NOW())
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    INSERT INTO tags (name, created_at)
    VALUES
      ('psychedelic', NOW()),
      ('alternative', NOW()),
      ('indie',       NOW()),
      ('trap',        NOW()),
      ('arabic',      NOW()),
      ('pop',         NOW()),
      ('rock',        NOW()),
      ('rnb',         NOW()),
      ('soul',        NOW()),
      ('hiphop',      NOW()),
      ('electronic',  NOW()),
      ('synth',       NOW()),
      ('chill',       NOW()),
      ('vibes',       NOW()),
      ('classic',     NOW()),
      ('underground', NOW()),
      ('mainstream',  NOW()),
      ('party',       NOW()),
      ('study',       NOW()),
      ('workout',     NOW()),
      ('sleep',       NOW()),
      ('driving',     NOW()),
      ('mood',        NOW())
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM tags WHERE name IN (
      'psychedelic','alternative','indie','trap','arabic','pop','rock',
      'rnb','soul','hiphop','electronic','synth','chill','vibes','classic',
      'underground','mainstream','party','study','workout','sleep','driving','mood'
    );
  `);
  await db.runSql(`
    DELETE FROM genres WHERE name IN (
      'Psychedelic Rock','Alternative Rock','Indie Rock','Arabic Trap',
      'Arabic Rap','Arabic Pop','Arabic Rock','R&B','Neo-Soul','Hip-Hop',
      'Pop','Electronic','Synth Pop','Indie Pop'
    );
  `);
};

exports._meta = { version: 1 };
