'use strict';

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

const HASH_USERS = '$2b$12$crb3Fgqt1GkOPQcucBO6NOQiTZwI4XRfVORImBAHjet7tZVG2BHMy';
const HASH_ADMIN = '$2b$12$6HPIXd5nu5giKCr6AVJRU.X.JuE11mfLZ90rGlo9AHdfvP9gj1F4K';

exports.up = async function (db) {
  // ----------------------------------------------------------
  // USERS
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO users
      (id, email, password_hashed, username, display_name, first_name, last_name,
       bio, city, country, gender, date_of_birth, role,
       is_verified, is_private, is_suspended,
       followers_count, following_count, created_at)
    VALUES

    -- ── ADMIN ────────────────────────────────────────────────
    ('00000001-0000-0000-0000-000000000000',
     'admin@rythmify.com', '${HASH_ADMIN}',
     'admin', 'Platform Admin', 'Admin', 'Rythmify',
     'I keep the lights on.',
     'Cairo', 'EG', 'male', '1985-03-10', 'admin',
     true, false, false, 0, 0,
     NOW() - INTERVAL '400 days'),

    -- ── ARTISTS ──────────────────────────────────────────────
    ('00000002-0000-0000-0000-000000000000',
     'djkarim@rythmify.com', '${HASH_USERS}',
     'dj_karim', 'DJ Karim', 'Karim', 'Hassan',
     'Electronic producer. Resident DJ at Cairo underground clubs. Making noise since 2015.',
     'Cairo', 'EG', 'male', '1993-07-22', 'artist',
     true, false, false, 0, 0,
     NOW() - INTERVAL '350 days'),

    ('00000003-0000-0000-0000-000000000000',
     'nour_sound@rythmify.com', '${HASH_USERS}',
     'nour_el_sound', 'Nour El Sound', 'Nour', 'El-Sayed',
     'Indie singer-songwriter from Alexandria. Guitar, voice, feelings.',
     'Alexandria', 'EG', 'female', '1997-11-05', 'artist',
     true, false, false, 0, 0,
     NOW() - INTERVAL '300 days'),

    ('00000004-0000-0000-0000-000000000000',
     'beatmaker99@rythmify.com', '${HASH_USERS}',
     'beatmaker99', 'BeatMaker99', 'Omar', 'Farouk',
     'Hip-hop producer. Trap & boom-bap. Cairo streets to world beats.',
     'Giza', 'EG', 'male', '1999-04-17', 'artist',
     true, false, false, 0, 0,
     NOW() - INTERVAL '270 days'),

    ('00000005-0000-0000-0000-000000000000',
     'layla_jazz@rythmify.com', '${HASH_USERS}',
     'layla_jazz', 'Layla Jazz', 'Layla', 'Mostafa',
     'Jazz pianist & vocalist. Classically trained. Soul-drenched.',
     'London', 'GB', 'female', '1991-09-30', 'artist',
     true, false, false, 0, 0,
     NOW() - INTERVAL '240 days'),

    ('00000006-0000-0000-0000-000000000000',
     'synthlord@rythmify.com', '${HASH_USERS}',
     'synthlord', 'SynthLord', 'Ahmed', 'Zaki',
     'Synth-pop & ambient from Berlin. Analog warmth in a digital world.',
     'Berlin', 'DE', 'male', '1994-01-28', 'artist',
     true, false, false, 0, 0,
     NOW() - INTERVAL '210 days'),

    ('00000007-0000-0000-0000-000000000000',
     'rana_beats@rythmify.com', '${HASH_USERS}',
     'rana_beats', 'Rana Beats', 'Rana', 'Saleh',
     'Ambient & lo-fi. Coffee shop frequencies.',
     'Beirut', 'LB', 'female', '2000-06-14', 'artist',
     true, false, false, 0, 0,
     NOW() - INTERVAL '180 days'),

    -- ── LISTENERS ────────────────────────────────────────────
    ('00000008-0000-0000-0000-000000000000',
     'sara.ali@example.com', '${HASH_USERS}',
     'sara_music', 'Sara Ali', 'Sara', 'Ali',
     NULL, 'Cairo', 'EG', 'female', '2001-03-19', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '150 days'),

    ('00000009-0000-0000-0000-000000000000',
     'mo.khaled@example.com', '${HASH_USERS}',
     'groove_hunter', 'Mohamed Khaled', 'Mohamed', 'Khaled',
     NULL, 'Cairo', 'EG', 'male', '1998-08-07', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '140 days'),

    ('00000010-0000-0000-0000-000000000000',
     'fatma.nasser@example.com', '${HASH_USERS}',
     'indie_lover', 'Fatma Nasser', 'Fatma', 'Nasser',
     NULL, 'Alexandria', 'EG', 'female', '1996-12-25', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '130 days'),

    ('00000011-0000-0000-0000-000000000000',
     'youssef.ibrahim@example.com', '${HASH_USERS}',
     'beat_chaser', 'Youssef Ibrahim', 'Youssef', 'Ibrahim',
     NULL, 'Giza', 'EG', 'male', '2002-05-31', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '120 days'),

    ('00000012-0000-0000-0000-000000000000',
     'hana.adel@example.com', '${HASH_USERS}',
     'hana_vibes', 'Hana Adel', 'Hana', 'Adel',
     NULL, 'Cairo', 'EG', 'female', '2003-02-14', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '100 days'),

    ('00000013-0000-0000-0000-000000000000',
     'kareem.saad@example.com', '${HASH_USERS}',
     'kareem_s', 'Kareem Saad', 'Kareem', 'Saad',
     NULL, 'Hurghada', 'EG', 'male', '1995-10-03', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '90 days'),

    ('00000014-0000-0000-0000-000000000000',
     'nadia.m@example.com', '${HASH_USERS}',
     'nadia_m', 'Nadia Mahmoud', 'Nadia', 'Mahmoud',
     NULL, 'Mansoura', 'EG', 'female', '1993-07-07', 'listener',
     true, false, false, 0, 0,
     NOW() - INTERVAL '80 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM users WHERE id IN (
    '00000001-0000-0000-0000-000000000000','00000002-0000-0000-0000-000000000000',
    '00000003-0000-0000-0000-000000000000','00000004-0000-0000-0000-000000000000',
    '00000005-0000-0000-0000-000000000000','00000006-0000-0000-0000-000000000000',
    '00000007-0000-0000-0000-000000000000','00000008-0000-0000-0000-000000000000',
    '00000009-0000-0000-0000-000000000000','00000010-0000-0000-0000-000000000000',
    '00000011-0000-0000-0000-000000000000','00000012-0000-0000-0000-000000000000',
    '00000013-0000-0000-0000-000000000000','00000014-0000-0000-0000-000000000000'
  );`);
};

exports._meta = { version: 1 };
