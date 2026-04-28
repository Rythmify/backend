'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    INSERT INTO tracks (
      title, description, user_id, genre_id,
      audio_url, stream_url, cover_image,
      duration, status, is_public, release_date,
      explicit_content, license_type
    ) VALUES
    -- Tame Impala (Psychedelic Rock)
    (
      'Let It Happen',
      'A hypnotic journey through shifting soundscapes and cyclical melodies.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',467,'ready',true,'2015-07-17',false,'all_rights_reserved'
    ),
    (
      'The Less I Know The Better',
      'A groovy, funk-tinged heartbreak anthem wrapped in psychedelic warmth.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',218,'ready',true,'2015-07-17',false,'all_rights_reserved'
    ),
    (
      'New Person, Same Old Mistakes',
      'A sprawling closer that blurs the line between transformation and repetition.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',394,'ready',true,'2015-07-17',false,'all_rights_reserved'
    ),
    (
      'Eventually',
      'A bittersweet psychedelic ballad about the slow pain of letting go.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',314,'ready',true,'2015-07-17',false,'all_rights_reserved'
    ),
    (
      'Feels Like We Only Go Backwards',
      'A lush, swirling track caught between nostalgia and forward motion.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',193,'ready',true,'2012-10-05',false,'all_rights_reserved'
    ),
    (
      'Elephant',
      'A stomping riff-driven anthem dripping with bravado and fuzz.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',228,'ready',true,'2012-10-05',false,'all_rights_reserved'
    ),
    (
      'Lost In Yesterday',
      'A shimmering reflection on memory and the comfort of the past.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',208,'ready',true,'2020-02-14',false,'all_rights_reserved'
    ),
    (
      'Is It True',
      'A buoyant, disco-inflected pop track exploring unexpected feelings.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',209,'ready',true,'2020-02-14',false,'all_rights_reserved'
    ),
    (
      'Apocalypse Dreams',
      'An epic slow-build that dissolves personal collapse into cosmic wonder.',
      (SELECT id FROM users WHERE email = 'tameimpala@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Psychedelic Rock'),
      'pending','pending','pending',378,'ready',true,'2012-10-05',false,'all_rights_reserved'
    ),
    -- Radiohead (Alternative Rock)
    (
      'Creep',
      'A raw, self-loathing anthem that launched a generation of outsiders.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',238,'ready',true,'1992-09-21',false,'all_rights_reserved'
    ),
    (
      'No Surprises',
      'A gentle lullaby dressed in devastation about quiet suburban despair.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',228,'ready',true,'1997-05-21',false,'all_rights_reserved'
    ),
    (
      'Karma Police',
      'A Lennonesque slow burn turning everyday grievance into dark catharsis.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',264,'ready',true,'1997-05-21',false,'all_rights_reserved'
    ),
    (
      'High and Dry',
      'A sparse, aching folk-rock meditation on abandonment and betrayal.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',257,'ready',true,'1995-03-13',false,'all_rights_reserved'
    ),
    (
      'Fake Plastic Trees',
      'A devastating critique of consumerism wrapped in a fragile acoustic shell.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',295,'ready',true,'1995-03-13',false,'all_rights_reserved'
    ),
    (
      'Paranoid Android',
      'A six-minute suite of shifting moods, paranoia, and pure chaos.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',387,'ready',true,'1997-05-21',false,'all_rights_reserved'
    ),
    (
      'Exit Music For a Film',
      'A slow-building escape fantasy that crescendos into total obliteration.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',254,'ready',true,'1997-05-21',false,'all_rights_reserved'
    ),
    (
      'Everything in Its Right Place',
      'A hypnotic opener built on fragmented vocals and warm electronic loops.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',261,'ready',true,'2000-10-02',false,'all_rights_reserved'
    ),
    (
      'Street Spirit Fade Out',
      'A bleak, tremolo-drenched elegy that refuses to offer comfort.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',249,'ready',true,'1995-03-13',false,'all_rights_reserved'
    ),
    (
      'Jigsaw Falling Into Place',
      'A frenetic guitar rush capturing the blur of a night about to unravel.',
      (SELECT id FROM users WHERE email = 'radiohead@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Alternative Rock'),
      'pending','pending','pending',245,'ready',true,'2007-10-10',false,'all_rights_reserved'
    ),
    -- Arctic Monkeys (Indie Rock)
    (
      'Do I Wanna Know',
      'A slow, brooding riff anchors this sleek meditation on desire.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',272,'ready',true,'2013-09-09',false,'all_rights_reserved'
    ),
    (
      'I Wanna Be Yours',
      'A short, tender declaration of love borrowed from a John Cooper Clarke poem.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',153,'ready',true,'2013-09-09',false,'all_rights_reserved'
    ),
    (
      '505',
      'A desperate, cinematic sprint toward a lover that never quite arrives.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',253,'ready',true,'2007-08-06',false,'all_rights_reserved'
    ),
    (
      'R U Mine',
      'A tightly wound, guitar-driven punch of possessive longing.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',202,'ready',true,'2013-09-09',false,'all_rights_reserved'
    ),
    (
      'Fluorescent Adolescent',
      'A bittersweet nostalgia trip about faded excitement and suburban ennui.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',193,'ready',true,'2011-05-09',false,'all_rights_reserved'
    ),
    (
      'Arabella',
      'A hazy, riff-heavy portrait of an elusive, psychedelic woman.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',213,'ready',true,'2013-09-09',false,'all_rights_reserved'
    ),
    (
      'Why''d You Only Call Me When You''re High',
      'A late-night, minimal groove dripping with knowing frustration.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',143,'ready',true,'2014-07-21',false,'all_rights_reserved'
    ),
    (
      'Snap Out of It',
      'A crisp pop-rock plea urging someone to step out of obsession.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',193,'ready',true,'2013-09-09',false,'all_rights_reserved'
    ),
    (
      'Mardy Bum',
      'A witty, tender acoustic sketch of a couple''s familiar arguments.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',165,'ready',true,'2006-01-23',false,'all_rights_reserved'
    ),
    (
      'Knee Socks',
      'A slow-burning, atmospheric closer alive with restrained tension.',
      (SELECT id FROM users WHERE email = 'arcticmonkeys@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',251,'ready',true,'2013-09-09',false,'all_rights_reserved'
    ),
    -- Marwan Pablo (Arabic Trap)
    (
      'AMAN',
      'A tense, sparse trap track built on threat and controlled calm.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',124,'ready',true,'2021-01-01',true,'all_rights_reserved'
    ),
    (
      'Daheya',
      'A relentless banger that turns personal chaos into bravado.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',198,'ready',true,'2020-06-01',true,'all_rights_reserved'
    ),
    (
      'El Halal',
      'A dark, street-flavored track drawing lines between right and wrong.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',212,'ready',true,'2020-01-01',true,'all_rights_reserved'
    ),
    (
      'Matafetch',
      'A dismissive, ice-cold flex delivered over minimal trap production.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',187,'ready',true,'2019-06-01',true,'all_rights_reserved'
    ),
    (
      'Lelly Yah',
      'A hard-hitting street anthem with unstoppable rhythmic momentum.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',203,'ready',true,'2021-03-01',true,'all_rights_reserved'
    ),
    (
      'DDDD',
      'An aggressive loop-driven track that hammers its hook into your skull.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',178,'ready',true,'2019-01-01',true,'all_rights_reserved'
    ),
    (
      'Melodies',
      'A melodic trap cut that balances vulnerability with street confidence.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',224,'ready',true,'2021-06-01',true,'all_rights_reserved'
    ),
    (
      'Ala3ib',
      'A short, razor-sharp vignette of street life and gamesmanship.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',89,'ready',true,'2020-03-01',true,'all_rights_reserved'
    ),
    (
      'Ich Liebe Es',
      'A cross-cultural banger blending Arabic swagger with European energy.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',195,'ready',true,'2022-01-01',true,'all_rights_reserved'
    ),
    (
      'El Mabda2',
      'A principled, reflective trap record about core values and identity.',
      (SELECT id FROM users WHERE email = 'marwanpablo@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Trap'),
      'pending','pending','pending',210,'ready',true,'2021-09-01',true,'all_rights_reserved'
    ),
    -- Dominic Fike (Indie Pop)
    (
      '3 Nights',
      'A lovelorn indie-pop gem about a short-lived connection that lingers.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',177,'ready',true,'2018-04-06',false,'all_rights_reserved'
    ),
    (
      'Babydoll',
      'A breezy, sun-soaked track about chasing fleeting affection.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',156,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Phone Numbers',
      'A hazy, melodic drifter about connection slipping through your fingers.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',191,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Mona Lisa',
      'A woozy love song comparing a mystery girl to an enduring masterpiece.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',178,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Chicken Tenders',
      'A quirky, self-aware track juggling cravings, anxiety, and comfort.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',204,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Why',
      'A tender, stripped-back question to a lover who keeps pulling away.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',163,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Vampire',
      'A playful pop track about someone who drains your energy but you still want.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',187,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Politics and Violence',
      'A sharp, energetic burst of frustration aimed at systems and noise.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',212,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Dancing in the Courthouse',
      'A surreal, carefree anthem about finding joy in the most unlikely places.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',195,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    (
      'Mamas Boy',
      'A candid, warm indie track about identity and the pull of home.',
      (SELECT id FROM users WHERE email = 'dominicfike@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',201,'ready',true,'2020-08-14',false,'all_rights_reserved'
    ),
    -- Glass Animals (Indie Pop)
    (
      'Heat Waves',
      'A bittersweet fever dream about missing someone who is already gone.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',238,'ready',true,'2020-08-07',false,'all_rights_reserved'
    ),
    (
      'Gooey',
      'A lush, slow-motion track soaked in tropical warmth and tender longing.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',264,'ready',true,'2014-06-06',false,'all_rights_reserved'
    ),
    (
      'The Other Side of Paradise',
      'A sprawling adventure through nostalgia, desire, and wistful escape.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',295,'ready',true,'2016-08-26',false,'all_rights_reserved'
    ),
    (
      'Youth',
      'A vivid, stream-of-consciousness portrait of fleeting youth and excess.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',232,'ready',true,'2016-08-26',false,'all_rights_reserved'
    ),
    (
      'Pork Soda',
      'A strange, sun-drenched ode to a specific kind of desperate craving.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',231,'ready',true,'2020-08-07',false,'all_rights_reserved'
    ),
    (
      'Life Itself',
      'A dense, propulsive track unraveling the pressure of modern existence.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',237,'ready',true,'2016-08-26',false,'all_rights_reserved'
    ),
    (
      'Space Ghost Coast to Coast',
      'A murky, bass-heavy track navigating the edges of memory and identity.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',243,'ready',true,'2014-06-06',false,'all_rights_reserved'
    ),
    (
      'Tangerine',
      'A hazy, introspective piece floating between longing and letting go.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',198,'ready',true,'2020-08-07',false,'all_rights_reserved'
    ),
    (
      'Your Love Deja Vu',
      'A dreamy, swirling track about recognizing love you have felt before.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',221,'ready',true,'2020-08-07',false,'all_rights_reserved'
    ),
    (
      'Pools',
      'A slow, weightless drift through summer and the fear of sinking.',
      (SELECT id FROM users WHERE email = 'glassanimals@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',289,'ready',true,'2014-06-06',false,'all_rights_reserved'
    ),
    -- TUL8TE (Arabic Pop)
    (
      'Heseeny',
      'A smooth Arabic pop track built on irresistible charm and warm melody.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',218,'ready',true,'2021-03-01',false,'all_rights_reserved'
    ),
    (
      'El Hob Gany',
      'A joyful, swooning declaration that love arrived when least expected.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',234,'ready',true,'2020-06-01',false,'all_rights_reserved'
    ),
    (
      'Cocktail Ghenay',
      'A layered sonic blend that mixes moods, genres, and emotions into one.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',245,'ready',true,'2021-01-01',false,'all_rights_reserved'
    ),
    (
      'Matigy Aady Aleiky',
      'A passionate plea not to treat love as something ordinary or routine.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',201,'ready',true,'2019-09-01',false,'all_rights_reserved'
    ),
    (
      'Habeeby Leh',
      'A tender, questioning ballad searching for the reason behind deep love.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',223,'ready',true,'2020-01-01',false,'all_rights_reserved'
    ),
    (
      'Layalina',
      'A nostalgic celebration of shared nights and the memories they leave.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',256,'ready',true,'2021-06-01',false,'all_rights_reserved'
    ),
    (
      'TESH SHABAB',
      'A youthful, energetic anthem for living boldly and without regret.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',198,'ready',true,'2022-01-01',false,'all_rights_reserved'
    ),
    (
      'Al Khatra',
      'A confident, seductive track about someone whose presence is dangerous.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',212,'ready',true,'2020-09-01',false,'all_rights_reserved'
    ),
    (
      'Nafs El Kalam',
      'A reflective loop about familiar words repeated across changing feelings.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',231,'ready',true,'2021-09-01',false,'all_rights_reserved'
    ),
    (
      'Bahebak',
      'A direct, heartfelt Arabic pop confession of unconditional love.',
      (SELECT id FROM users WHERE email = 'tul8te@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',219,'ready',true,'2019-06-01',false,'all_rights_reserved'
    ),
    -- Amr Diab (Arabic Pop)
    (
      'Tamally Maak',
      'A timeless Arabic ballad about being forever beside the one you love.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',312,'ready',true,'2000-01-01',false,'all_rights_reserved'
    ),
    (
      'Nour El Ein',
      'A Mediterranean-fused masterpiece that became an international phenomenon.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',298,'ready',true,'1996-01-01',false,'all_rights_reserved'
    ),
    (
      'We Malo',
      'A festive, rhythm-driven pop track brimming with infectious joy.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',243,'ready',true,'1994-01-01',false,'all_rights_reserved'
    ),
    (
      'Lealy Nahary',
      'A passionate declaration that every hour is consumed by love''s presence.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',334,'ready',true,'2003-01-01',false,'all_rights_reserved'
    ),
    (
      'Ana Ayesh',
      'A reflective song finding meaning and purpose through the lens of love.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',276,'ready',true,'1997-01-01',false,'all_rights_reserved'
    ),
    (
      'Wayah',
      'A smooth, romantic pop record basking in the warmth of togetherness.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',289,'ready',true,'2001-01-01',false,'all_rights_reserved'
    ),
    (
      'Osad Einy',
      'A tender, aching ballad for someone who has become the center of everything.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',267,'ready',true,'2007-01-01',false,'all_rights_reserved'
    ),
    (
      'El Alem Allah',
      'A soulful, fate-trusting love song surrendering to what only God knows.',
      (SELECT id FROM users WHERE email = 'amrdiab@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',312,'ready',true,'2010-01-01',false,'all_rights_reserved'
    ),
    -- Elissa (Arabic Pop)
    (
      'Hob Kol Hayaty',
      'A sweeping declaration that love is the entire meaning of her existence.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',287,'ready',true,'2010-01-01',false,'all_rights_reserved'
    ),
    (
      'Betmoun',
      'A lush, emotional ballad about the faith placed in a beloved person.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',312,'ready',true,'2008-01-01',false,'all_rights_reserved'
    ),
    (
      'Aayshalak',
      'A soaring, devotional pop track built entirely around one person''s world.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',298,'ready',true,'2005-01-01',false,'all_rights_reserved'
    ),
    (
      'Law Taarafou',
      'A melancholic, longing track about love misunderstood by those around you.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',267,'ready',true,'2012-01-01',false,'all_rights_reserved'
    ),
    (
      'Asaad Wahda',
      'A joyful, radiant anthem about the happiness that one person brings.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',334,'ready',true,'2007-01-01',false,'all_rights_reserved'
    ),
    (
      'Maktooba Leek',
      'A romantic fate narrative declaring that this love was always meant to be.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',289,'ready',true,'2006-01-01',false,'all_rights_reserved'
    ),
    (
      'Saharna Ya Leil',
      'A nocturnal, emotional ballad about staying awake lost in feeling.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',312,'ready',true,'2009-01-01',false,'all_rights_reserved'
    ),
    (
      'Krahni',
      'A gutting song about reaching the limit of pain caused by someone loved.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',276,'ready',true,'2013-01-01',false,'all_rights_reserved'
    ),
    (
      'Ajmal Ihsas',
      'A warm, celebratory ode to the most beautiful feeling in the world.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',298,'ready',true,'2004-01-01',false,'all_rights_reserved'
    ),
    (
      'Wala Baad Seneen',
      'A resilient declaration that feelings will not fade even after years apart.',
      (SELECT id FROM users WHERE email = 'elissa@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Pop'),
      'pending','pending','pending',321,'ready',true,'2016-01-01',false,'all_rights_reserved'
    ),
    -- Adele (Pop)
    (
      'Set Fire to the Rain',
      'A powerful pop anthem about the violent contradiction of loving someone wrong.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',242,'ready',true,'2011-01-24',false,'all_rights_reserved'
    ),
    (
      'Easy On Me',
      'A piano-driven, raw return asking for grace after difficult choices.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',224,'ready',true,'2021-10-15',false,'all_rights_reserved'
    ),
    (
      'Skyfall',
      'A cinematic Bond theme about facing destruction with quiet defiance.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',286,'ready',true,'2012-10-05',false,'all_rights_reserved'
    ),
    (
      'Rolling in the Deep',
      'A furious, soulful breakup anthem fueled by betrayal and fire.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',228,'ready',true,'2011-01-24',false,'all_rights_reserved'
    ),
    (
      'Love In The Dark',
      'A devastating ballad about choosing to leave despite still feeling love.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',317,'ready',true,'2015-11-20',false,'all_rights_reserved'
    ),
    (
      'Send My Love To Your New Lover',
      'A breezy, upbeat kiss-off delivered with effortless emotional elegance.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',206,'ready',true,'2015-11-20',false,'all_rights_reserved'
    ),
    (
      'Chasing Pavements',
      'A soulful debut asking whether to keep running toward a hopeless love.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',211,'ready',true,'2008-01-28',false,'all_rights_reserved'
    ),
    (
      'Hello',
      'A sweeping, cinematic hello from the other side of a long-ended love.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',295,'ready',true,'2015-10-23',false,'all_rights_reserved'
    ),
    (
      'Rumour Has It',
      'A percussive, finger-snapping rebuttal to gossip about a relationship.',
      (SELECT id FROM users WHERE email = 'adele@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Pop'),
      'pending','pending','pending',223,'ready',true,'2011-01-24',false,'all_rights_reserved'
    ),
    -- Cairokee (Arabic Rock)
    (
      'Ya El Midan',
      'A rousing rock anthem born from the energy of Egypt''s revolutionary square.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',245,'ready',true,'2011-01-01',false,'all_rights_reserved'
    ),
    (
      'Nos El Midan',
      'A softer, introspective counterpart exploring the heart of the square.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',198,'ready',true,'2013-01-01',false,'all_rights_reserved'
    ),
    (
      'Sekka Setak',
      'A grinding, defiant rock track about staying silent no longer.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',223,'ready',true,'2012-01-01',false,'all_rights_reserved'
    ),
    (
      'Tab Leh',
      'A frustrated, searching rock question about why nothing ever changes.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',267,'ready',true,'2014-01-01',false,'all_rights_reserved'
    ),
    (
      'Roma',
      'A melancholic, cinematic rock track about longing and displacement.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',212,'ready',true,'2015-01-01',false,'all_rights_reserved'
    ),
    (
      'Mafish Waqt',
      'A relentless, riff-driven rocker about running out of time and patience.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',234,'ready',true,'2017-01-01',false,'all_rights_reserved'
    ),
    (
      'Mesh Lazeez',
      'A biting social critique wrapped in crunchy Arabic rock energy.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',256,'ready',true,'2018-01-01',false,'all_rights_reserved'
    ),
    (
      'Zaman',
      'A reflective, time-bending track mourning what time has taken away.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',243,'ready',true,'2013-06-01',false,'all_rights_reserved'
    ),
    (
      'Matehawelsh',
      'A powerful warning not to try to change what cannot and should not be changed.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',267,'ready',true,'2019-01-01',false,'all_rights_reserved'
    ),
    (
      'El Seka Shemal Fe Shemal',
      'A driving rock anthem about choosing the uncertain path and walking it on your own terms.',
      (SELECT id FROM users WHERE email = 'cairokee@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Arabic Rock'),
      'pending','pending','pending',250,'ready',true,'2016-01-01',false,'all_rights_reserved'
    ),
    -- The Weeknd (R&B)
    (
      'Blinding Lights',
      'A neon-soaked synth-pop sprint driven by heartache and speed.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',200,'ready',true,'2020-01-01',false,'all_rights_reserved'
    ),
    (
      'Starboy',
      'A cold, glittering reinvention built on ego, isolation, and midnight energy.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',230,'ready',true,'2016-11-25',false,'all_rights_reserved'
    ),
    (
      'Save Your Tears',
      'A bittersweet synth-pop lament about realizing hurt too late to undo.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',215,'ready',true,'2020-03-20',false,'all_rights_reserved'
    ),
    (
      'Cant Feel My Face',
      'A dark pop banger disguising addiction as an irresistible love song.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',213,'ready',true,'2015-08-28',false,'all_rights_reserved'
    ),
    (
      'The Hills',
      'A brooding, cinematic midnight confession about pleasure and moral collapse.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',242,'ready',true,'2015-05-27',false,'all_rights_reserved'
    ),
    (
      'After Hours',
      'A haunting title track tracing the aftermath of a night that destroyed everything.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',298,'ready',true,'2020-03-20',false,'all_rights_reserved'
    ),
    (
      'Earned It',
      'A slow, soulful seduction built on orchestral warmth and raw desire.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',253,'ready',true,'2015-02-02',false,'all_rights_reserved'
    ),
    (
      'Call Out My Name',
      'A devastating, vulnerable breakup track from a wounded and angry place.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',223,'ready',true,'2018-03-30',false,'all_rights_reserved'
    ),
    (
      'Die For You',
      'A slow-burning declaration of devotion that crescendos into overwhelming feeling.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',260,'ready',true,'2016-11-25',false,'all_rights_reserved'
    ),
    (
      'Popular',
      'A slick, self-aware collaboration on the hollow price of fame.',
      (SELECT id FROM users WHERE email = 'theweeknd@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',194,'ready',true,'2023-06-09',false,'all_rights_reserved'
    ),
    -- Drake (Hip-Hop, explicit)
    (
      'God''s Plan',
      'A triumphant, fate-driven anthem about giving back and trusting the journey.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',198,'ready',true,'2018-01-19',true,'all_rights_reserved'
    ),
    (
      'One Dance',
      'A dancehall-infused smash built on smooth rhythm and effortless desire.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',174,'ready',true,'2016-04-05',true,'all_rights_reserved'
    ),
    (
      'Hotline Bling',
      'A moody, accusatory R&B track about someone who changed after you left.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',267,'ready',true,'2015-07-31',true,'all_rights_reserved'
    ),
    (
      'Started From the Bottom',
      'A gritty, proud origin story about rising from nothing with your crew.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',195,'ready',true,'2013-02-01',true,'all_rights_reserved'
    ),
    (
      'Hold On Were Going Home',
      'A smooth, retro-soul love song promising safety to someone who needs it.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',229,'ready',true,'2013-09-17',true,'all_rights_reserved'
    ),
    (
      'In My Feelings',
      'A New Orleans-inflected banger that became a global viral dance moment.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',218,'ready',true,'2018-06-29',true,'all_rights_reserved'
    ),
    (
      'Passionfruit',
      'A hazy, tropical house-influenced meditation on long-distance longing.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',295,'ready',true,'2017-06-23',true,'all_rights_reserved'
    ),
    (
      'Rich Flex',
      'A drill-driven flexing collab that set a new bar for cold confidence.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',201,'ready',true,'2022-06-17',true,'all_rights_reserved'
    ),
    (
      'Laugh Now Cry Later',
      'A triumphant track about karma arriving for those who doubted you.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',258,'ready',true,'2020-08-14',true,'all_rights_reserved'
    ),
    (
      'Forever',
      'A legendary supergroup posse cut where four titans trade verses on legacy.',
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',346,'ready',true,'2009-08-01',true,'all_rights_reserved'
    ),
    -- Kendrick Lamar (Hip-Hop, explicit)
    (
      'HUMBLE',
      'A sparse, commanding call-out demanding authenticity over performance.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',177,'ready',true,'2017-04-14',true,'all_rights_reserved'
    ),
    (
      'Alright',
      'A defiant, gospel-rooted anthem of Black resilience and survival.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',219,'ready',true,'2015-03-23',true,'all_rights_reserved'
    ),
    (
      'DNA',
      'A ferocious identity statement tracing his lineage through pain and purpose.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',185,'ready',true,'2017-04-14',true,'all_rights_reserved'
    ),
    (
      'Swimming Pools Drank',
      'A deceptively catchy critique of peer pressure and alcoholism''s pull.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',314,'ready',true,'2012-10-22',true,'all_rights_reserved'
    ),
    (
      'Money Trees',
      'A cinematic street narrative about dreaming of escape and the cost of staying.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',386,'ready',true,'2012-10-22',true,'all_rights_reserved'
    ),
    (
      'King Kunta',
      'A funky, furious reclamation of power and African American identity.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',234,'ready',true,'2015-03-23',true,'all_rights_reserved'
    ),
    (
      'Bitch Dont Kill My Vibe',
      'A meditative, floaty track protecting peace from negativity and noise.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',310,'ready',true,'2012-10-22',true,'all_rights_reserved'
    ),
    (
      'Not Like Us',
      'A scorching diss track that landed like a cultural verdict on a rival.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',274,'ready',true,'2024-05-03',true,'all_rights_reserved'
    ),
    (
      'maad city',
      'A frenetic, immersive portrait of Compton''s beauty and brutality.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',344,'ready',true,'2012-10-22',true,'all_rights_reserved'
    ),
    (
      'All the Stars',
      'A soaring, Wakanda-fueled anthem about claiming your place among the greats.',
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',234,'ready',true,'2018-02-09',true,'all_rights_reserved'
    ),
    -- Frank Ocean (R&B)
    (
      'Chanel',
      'A blissful, double-sided love song delivered with effortless vulnerability.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',259,'ready',true,'2017-04-10',false,'all_rights_reserved'
    ),
    (
      'Pink White',
      'A lush, sun-drenched ode to a lover distilled into pure sensation.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',183,'ready',true,'2016-08-20',false,'all_rights_reserved'
    ),
    (
      'Self Control',
      'A layered, aching track about restraint in the face of impossible longing.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',250,'ready',true,'2016-08-20',false,'all_rights_reserved'
    ),
    (
      'Godspeed',
      'A brief, devastating benediction wishing the best for someone you must release.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',161,'ready',true,'2016-08-20',false,'all_rights_reserved'
    ),
    (
      'Lost',
      'A breezy, globe-trotting portrait of a love affair lived at speed.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',186,'ready',true,'2012-07-10',false,'all_rights_reserved'
    ),
    (
      'Super Rich Kids',
      'A woozy, satirical portrait of wealthy youth drowning in beautiful emptiness.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',284,'ready',true,'2012-07-10',false,'all_rights_reserved'
    ),
    (
      'Thinkin Bout You',
      'A falsetto-driven debut of quiet longing that introduced a generation to Frank.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',201,'ready',true,'2012-02-09',false,'all_rights_reserved'
    ),
    (
      'Bad Religion',
      'A harrowing, orchestral confession of unrequited love as private religion.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',172,'ready',true,'2012-07-10',false,'all_rights_reserved'
    ),
    (
      'Ivy',
      'A raw guitar-driven memory of a first love that shaped everything after.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',237,'ready',true,'2016-08-20',false,'all_rights_reserved'
    ),
    (
      'Nights',
      'A shape-shifting centerpiece that splits day and night into two emotional worlds.',
      (SELECT id FROM users WHERE email = 'frankocean@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'R&B'),
      'pending','pending','pending',307,'ready',true,'2016-08-20',false,'all_rights_reserved'
    ),
    -- Tyler The Creator (Hip-Hop, explicit)
    (
      'EARFQUAKE',
      'A trembling, pastel-colored plea not to leave from a place of pure feeling.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',193,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'See You Again',
      'A tender, Stevie Wonder-esque love song wrapped in warm nostalgia.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',237,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'New Magic Wand',
      'A chaotic, unhinged spiral into jealousy and obsessive control.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',196,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'IGORS THEME',
      'A brief orchestral overture that sets the cinematic tone for the album.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',97,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'Are We Still Friends',
      'A lush, emotional closer grieving the end of a love that becomes friendship.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',258,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'Felt',
      'A silky, euphoric love confession delivered with radiant sincerity.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',189,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'Running Out of Time',
      'A desperate, racing track about chasing someone before the window closes.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',197,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'Sorry Not Sorry',
      'A luxurious, orchestrated apology that refuses to fully mean it.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',214,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'Sweet I Thought You Wanted to Dance',
      'A sprawling, genre-bending epic capturing the arc of an entire evening.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',519,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    (
      'Gone Gone Thank You',
      'A warm, gospel-tinged send-off carrying gratitude through the goodbye.',
      (SELECT id FROM users WHERE email = 'tylerthecreator@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Hip-Hop'),
      'pending','pending','pending',289,'ready',true,'2019-05-17',true,'all_rights_reserved'
    ),
    -- Billie Eilish (Indie Pop)
    (
      'BIRDS OF A FEATHER',
      'A tender, heartfelt pledge of lifelong devotion wrapped in soft indie-pop intimacy.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',210,'ready',true,'2024-05-17',false,'all_rights_reserved'
    ),
    (
      'WILDFLOWER',
      'A wistful, introspective track about longing for someone who belongs to someone else.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',237,'ready',true,'2024-05-17',false,'all_rights_reserved'
    ),
    (
      'lovely',
      'A delicate, haunting duet capturing the paradox of comfortable sadness.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',200,'ready',true,'2018-04-19',false,'all_rights_reserved'
    ),
    (
      'CHIHIRO',
      'A dreamy, layered track exploring identity and transformation, named for the Ghibli heroine.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',338,'ready',true,'2024-05-17',false,'all_rights_reserved'
    ),
    (
      'What Was I Made For? [From The Motion Picture "Barbie"]',
      'A poignant existential ballad from the Barbie soundtrack questioning purpose and identity.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',246,'ready',true,'2023-07-21',false,'all_rights_reserved'
    ),
    (
      'when the party''s over',
      'A spare, devastating breakup song delivered in near silence.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',196,'ready',true,'2018-10-18',false,'all_rights_reserved'
    ),
    (
      'Happier Than Ever',
      'A quiet-to-explosive confrontation with someone who damaged her deeply.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',298,'ready',true,'2021-07-30',false,'all_rights_reserved'
    ),
    (
      'everything i wanted',
      'A hazy, tender meditation on fame, doubt, and the one person who always shows up.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',245,'ready',true,'2019-11-13',false,'all_rights_reserved'
    ),
    (
      'BITTERSUITE',
      'A sprawling, cinematic closer that dissolves bittersweet feeling into pure sound.',
      (SELECT id FROM users WHERE email = 'billieeilish@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Pop'),
      'pending','pending','pending',379,'ready',true,'2024-05-17',false,'all_rights_reserved'
    ),
    -- Daft Punk (Electronic)
    (
      'One More Time',
      'An ecstatic, vocoder-drenched anthem begging the night to never end.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',320,'ready',true,'2000-11-13',false,'all_rights_reserved'
    ),
    (
      'Get Lucky (Radio Edit - feat. Pharrell Williams and Nile Rodgers)',
      'A disco-funk celebration of chance, connection, and the joy of being alive.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',248,'ready',true,'2013-05-17',false,'all_rights_reserved'
    ),
    (
      'Instant Crush (feat. Julian Casablancas)',
      'A bittersweet, rock-inflected ballad about beauty that arrives too late.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',337,'ready',true,'2013-05-17',false,'all_rights_reserved'
    ),
    (
      'Around the World',
      'A hypnotic seven-minute loop that turns four words into a complete universe.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',428,'ready',true,'1997-04-07',false,'all_rights_reserved'
    ),
    (
      'Harder, Better, Faster, Stronger',
      'A mechanical house mantra about relentless self-improvement and machine precision.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',224,'ready',true,'2001-10-22',false,'all_rights_reserved'
    ),
    (
      'Veridis Quo',
      'A deep, meditative ambient piece that distills the album''s final exhale into stillness.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',584,'ready',true,'2001-10-22',false,'all_rights_reserved'
    ),
    (
      'Something About Us',
      'A warm, soulful love ballad that drifts between human and machine tenderness.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',268,'ready',true,'2001-10-22',false,'all_rights_reserved'
    ),
    (
      'Lose Yourself to Dance (feat. Pharrell Williams)',
      'A joyful, groove-soaked plea to surrender entirely to music''s power.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',345,'ready',true,'2013-05-17',false,'all_rights_reserved'
    ),
    (
      'Digital Love',
      'A dreamy, guitar-looped fantasy about a crush that only exists in sleep.',
      (SELECT id FROM users WHERE email = 'daftpunk@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Electronic'),
      'pending','pending','pending',301,'ready',true,'2001-10-22',false,'all_rights_reserved'
    ),
    -- Gorillaz (Indie Rock)
    (
      'New Gold (feat. Tame Impala and Bootie Brown)',
      'A shimmering indie-pop collaboration from Gorillaz, featuring Tame Impala and Bootie Brown.',
      (SELECT id FROM users WHERE email = 'gorillaz@rythmify.com'),
      (SELECT id FROM genres WHERE name = 'Indie Rock'),
      'pending','pending','pending',216,'ready',true,'2022-08-18',false,'all_rights_reserved'
    )
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM tracks WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE '%@rythmify.com'
      AND role = 'artist'
    );
  `);
};

exports._meta = { version: 1 };
