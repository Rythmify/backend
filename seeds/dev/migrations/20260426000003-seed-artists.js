'use strict';

exports.setup = function () {};

// bcrypt hash of 'Password123!' rounds=10
// node -e "const b=require('bcryptjs');b.hash('Password123!',10).then(h=>console.log(h))"
const HASH = '$2a$10$WxXunTxTxq9TX0B1ykCDOO8GXxr9sukDDmtHnzoZAnu6LfroQH2w.';

exports.up = async function (db) {
  await db.runSql(`
    INSERT INTO users (
      email, password_hashed, username, display_name,
      first_name, last_name, bio,
      role, is_verified, is_private,
      profile_picture, cover_photo,
      country, city,
      followers_count, following_count, created_at
    ) VALUES

    ('tameimpala@rythmify.com', '${HASH}', 'tameimpala', 'Tame Impala',
     'Kevin', 'Parker',
     'Psychedelic rock project from Perth, Australia. All sounds created by Kevin Parker.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Tame Impala.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Tame Impala.jpg',
     'AU', 'Perth', 0, 0, NOW() - INTERVAL '500 days'),

    ('radiohead@rythmify.com', '${HASH}', 'radiohead', 'Radiohead',
     'Thom', 'Yorke',
     'Art rock band from Abingdon, England. Challenging the boundaries of alternative rock since 1985.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Radiohead.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Radiohead.jpg',
     'GB', 'Abingdon', 0, 0, NOW() - INTERVAL '490 days'),

    ('arcticmonkeys@rythmify.com', '${HASH}', 'arcticmonkeys', 'Arctic Monkeys',
     'Alex', 'Turner',
     'Indie rock band from Sheffield, England. Four lads who had the whole city in their hands.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Arctic Monkeys.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Arctic Monkeys.jpg',
     'GB', 'Sheffield', 0, 0, NOW() - INTERVAL '480 days'),

    ('marwanpablo@rythmify.com', '${HASH}', 'marwanpablo', 'Marwan Pablo',
     'Marwan', 'Pablo',
     'Pioneer of Arabic trap from Cairo. Blending street storytelling with dark, heavy production.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Marwan Pablo.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Marwan Pablo.jpg',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '470 days'),

    ('dominicfike@rythmify.com', '${HASH}', 'dominicfike', 'Dominic Fike',
     'Dominic', 'Fike',
     'Multi-genre indie artist from Naples, FL. From county jail to global stages.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Dominic Fike.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Dominic Fike.jpg',
     'US', 'Naples', 0, 0, NOW() - INTERVAL '460 days'),

    ('glassanimals@rythmify.com', '${HASH}', 'glassanimals', 'Glass Animals',
     'Dave', 'Bayley',
     'Psychedelic indie-pop from Oxford, England. Heat Waves changed everything.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Glass Animals.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Glass Animals.jpg',
     'GB', 'Oxford', 0, 0, NOW() - INTERVAL '450 days'),

    ('tul8te@rythmify.com', '${HASH}', 'tul8te', 'TUL8TE',
     'Ahmed', 'Kamel',
     'Egyptian pop sensation blending modern production with authentic Arabic emotion.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/TUL8TE.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/TUL8TE.jpg',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '440 days'),

    ('amrdiab@rythmify.com', '${HASH}', 'amrdiab', 'Amr Diab',
     'Amr', 'Diab',
     'The Father of Mediterranean Music. Egypt''s most celebrated artist for over four decades.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Amr Diab.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Amr Diab.jpg',
     'EG', 'Port Said', 0, 0, NOW() - INTERVAL '430 days'),

    ('elissa@rythmify.com', '${HASH}', 'elissa', 'Elissa',
     'Elissa', 'Khoury',
     'The Star of the East from Lebanon. One of the most iconic voices in Arabic pop.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Elissa.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Elissa.jpg',
     'LB', 'Deir Mimas', 0, 0, NOW() - INTERVAL '420 days'),

    ('adele@rythmify.com', '${HASH}', 'adele', 'Adele',
     'Adele', 'Adkins',
     'Grammy-winning British soul powerhouse. Her voice has broken more hearts than any other.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Adele.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Adele.jpg',
     'GB', 'London', 0, 0, NOW() - INTERVAL '410 days'),

    ('cairokee@rythmify.com', '${HASH}', 'cairokee', 'Cairokee',
     'Amir', 'Eid',
     'Egypt''s most important rock band. Voice of a generation and the revolution.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Cairokee.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Cairokee.jpg',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '400 days'),

    ('theweeknd@rythmify.com', '${HASH}', 'theweeknd', 'The Weeknd',
     'Abel', 'Tesfaye',
     'R&B visionary from Toronto. Redefining dark pop for a generation.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/The Weeknd.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/The Weeknd.jpg',
     'CA', 'Toronto', 0, 0, NOW() - INTERVAL '390 days'),

    ('drake@rythmify.com', '${HASH}', 'drake', 'Drake',
     'Aubrey', 'Graham',
     'The rap and R&B titan from Toronto. More consistent chart runs than anyone in history.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Drake.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Drake.jpg',
     'CA', 'Toronto', 0, 0, NOW() - INTERVAL '380 days'),

    ('kendricklamar@rythmify.com', '${HASH}', 'kendricklamar', 'Kendrick Lamar',
     'Kendrick', 'Lamar',
     'Pulitzer Prize-winning rapper from Compton. The greatest of his generation.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Kendrick Lamar.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Kendrick Lamar.jpg',
     'US', 'Compton', 0, 0, NOW() - INTERVAL '370 days'),

    ('frankocean@rythmify.com', '${HASH}', 'frankocean', 'Frank Ocean',
     'Christopher', 'Breaux',
     'R&B visionary and writer from Long Beach. Blonde remains a defining album of the decade.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Frank Ocean.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Frank Ocean.jpg',
     'US', 'Long Beach', 0, 0, NOW() - INTERVAL '360 days'),

    ('tylerthecreator@rythmify.com', '${HASH}', 'tylerthecreator', 'Tyler The Creator',
     'Tyler', 'Okonma',
     'Grammy-winning rapper, producer, and creative director from Los Angeles.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Tyler The Creator.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Tyler The Creator.jpg',
     'US', 'Los Angeles', 0, 0, NOW() - INTERVAL '350 days'),

    ('billieeilish@rythmify.com', '${HASH}', 'billieeilish', 'Billie Eilish',
     'Billie', 'O''Connell',
     'Grammy-sweeping indie-pop artist from Los Angeles. Changing what pop can sound like.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Billie Eilish.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Billie Eilish.jpg',
     'US', 'Los Angeles', 0, 0, NOW() - INTERVAL '340 days'),

    ('daftpunk@rythmify.com', '${HASH}', 'daftpunk', 'Daft Punk',
     'Thomas', 'Bangalter',
     'French electronic duo who built a robot mythology around the future of dance music.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Daft Punk.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Daft Punk.jpg',
     'FR', 'Paris', 0, 0, NOW() - INTERVAL '330 days'),

    ('gorillaz@rythmify.com', '${HASH}', 'gorillaz', 'Gorillaz',
     'Damon', 'Albarn',
     'Virtual band from London. The world''s most successful virtual act, blending indie, hip-hop, and psychedelia.',
     'artist', true, false,
     'https://rythmifystorage.blob.core.windows.net/media/avatars/Gorillaz.jpg',
     'https://rythmifystorage.blob.core.windows.net/media/covers/Gorillaz.jpg',
     'GB', 'London', 0, 0, NOW() - INTERVAL '320 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM users WHERE email LIKE '%@rythmify.com' AND role = 'artist';
  `);
};

exports._meta = { version: 1 };
