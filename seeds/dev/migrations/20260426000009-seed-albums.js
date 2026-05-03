'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    WITH album_seed (
      artist_email, album_name, description, genre_name, release_date, track_limit
    ) AS (
      VALUES
        ('tameimpala@rythmify.com',       'Currents of Color',             'A psychedelic collection of Tame Impala essentials.',                  'Psychedelic Rock', '2020-02-14'::date, 8),
        ('radiohead@rythmify.com',        'Static Bloom',                  'Alternative rock landmarks from Radiohead.',                           'Alternative Rock', '2007-10-10'::date, 7),
        ('arcticmonkeys@rythmify.com',    'Neon Sheffield Nights',         'Indie rock cuts built around late-night riffs and sharp hooks.',        'Indie Rock',       '2013-09-09'::date, 7),
        ('marwanpablo@rythmify.com',      'Cairo Trap Files',              'Dark Arabic trap tracks with street-level pressure.',                   'Arabic Trap',      '2022-01-01'::date, 6),
        ('dominicfike@rythmify.com',      'Sunburn Signals',               'Warm indie-pop snapshots from Dominic Fike.',                           'Indie Pop',        '2020-08-14'::date, 6),
        ('glassanimals@rythmify.com',     'Heatwave Dreams',               'Colorful indie-pop tracks from Glass Animals.',                         'Indie Pop',        '2020-08-07'::date, 6),
        ('tul8te@rythmify.com',           'Modern Cairo Pop',              'Polished Arabic pop melodies from TUL8TE.',                             'Arabic Pop',       '2024-01-01'::date, 6),
        ('amrdiab@rythmify.com',          'Mediterranean Classics',        'Bright Arabic pop favorites from Amr Diab.',                            'Arabic Pop',       '2021-01-01'::date, 8),
        ('elissa@rythmify.com',           'Velvet Beirut',                 'Romantic Arabic pop ballads from Elissa.',                              'Arabic Pop',       '2020-01-01'::date, 6),
        ('adele@rythmify.com',            'After the Rain',                'Soulful pop performances from Adele.',                                  'Pop',              '2021-11-19'::date, 7),
        ('cairokee@rythmify.com',         'Downtown Anthems',              'Arabic rock songs with protest energy and big choruses.',               'Arabic Rock',      '2019-01-01'::date, 7),
        ('theweeknd@rythmify.com',        'After Hours Radio',             'Dark R&B and pop from The Weeknd.',                                     'R&B',              '2020-03-20'::date, 7),
        ('drake@rythmify.com',            'Toronto Nights',                'Hip-hop and melodic rap tracks from Drake.',                            'Hip-Hop',          '2022-06-17'::date, 8),
        ('kendricklamar@rythmify.com',    'Compton Chapters',              'Sharp, cinematic hip-hop from Kendrick Lamar.',                         'Hip-Hop',          '2024-05-03'::date, 8),
        ('frankocean@rythmify.com',       'Blonde Light',                  'Intimate R&B reflections from Frank Ocean.',                            'R&B',              '2017-04-10'::date, 7),
        ('tylerthecreator@rythmify.com',  'Pastel Rap Suite',              'Bold, melodic hip-hop from Tyler The Creator.',                         'Hip-Hop',          '2019-05-17'::date, 7),
        ('billieeilish@rythmify.com',     'Quiet Voltage',                 'Minimal and cinematic indie-pop from Billie Eilish.',                   'Indie Pop',        '2021-07-30'::date, 7),
        ('daftpunk@rythmify.com',         'Robot Disco Archive',           'Electronic dance essentials from Daft Punk.',                           'Electronic',       '2013-05-17'::date, 8)
    )
    INSERT INTO playlists (
      name, description, cover_image, type, is_public,
      user_id, release_date, genre_id, subtype, created_at
    )
    SELECT
      seed.album_name,
      seed.description,
      'pending',
      'regular',
      true,
      artist.id,
      seed.release_date,
      genre.id,
      'album',
      NOW()
    FROM album_seed seed
    JOIN users artist
      ON artist.email = seed.artist_email
     AND artist.role = 'artist'
    LEFT JOIN genres genre
      ON genre.name = seed.genre_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM playlists existing
      WHERE existing.user_id = artist.id
        AND existing.name = seed.album_name
        AND existing.subtype = 'album'
        AND existing.deleted_at IS NULL
    )
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH album_seed (
      artist_email, album_name, description, genre_name, release_date, track_limit
    ) AS (
      VALUES
        ('tameimpala@rythmify.com',       'Currents of Color',             'A psychedelic collection of Tame Impala essentials.',                  'Psychedelic Rock', '2020-02-14'::date, 8),
        ('radiohead@rythmify.com',        'Static Bloom',                  'Alternative rock landmarks from Radiohead.',                           'Alternative Rock', '2007-10-10'::date, 7),
        ('arcticmonkeys@rythmify.com',    'Neon Sheffield Nights',         'Indie rock cuts built around late-night riffs and sharp hooks.',        'Indie Rock',       '2013-09-09'::date, 7),
        ('marwanpablo@rythmify.com',      'Cairo Trap Files',              'Dark Arabic trap tracks with street-level pressure.',                   'Arabic Trap',      '2022-01-01'::date, 6),
        ('dominicfike@rythmify.com',      'Sunburn Signals',               'Warm indie-pop snapshots from Dominic Fike.',                           'Indie Pop',        '2020-08-14'::date, 6),
        ('glassanimals@rythmify.com',     'Heatwave Dreams',               'Colorful indie-pop tracks from Glass Animals.',                         'Indie Pop',        '2020-08-07'::date, 6),
        ('tul8te@rythmify.com',           'Modern Cairo Pop',              'Polished Arabic pop melodies from TUL8TE.',                             'Arabic Pop',       '2024-01-01'::date, 6),
        ('amrdiab@rythmify.com',          'Mediterranean Classics',        'Bright Arabic pop favorites from Amr Diab.',                            'Arabic Pop',       '2021-01-01'::date, 8),
        ('elissa@rythmify.com',           'Velvet Beirut',                 'Romantic Arabic pop ballads from Elissa.',                              'Arabic Pop',       '2020-01-01'::date, 6),
        ('adele@rythmify.com',            'After the Rain',                'Soulful pop performances from Adele.',                                  'Pop',              '2021-11-19'::date, 7),
        ('cairokee@rythmify.com',         'Downtown Anthems',              'Arabic rock songs with protest energy and big choruses.',               'Arabic Rock',      '2019-01-01'::date, 7),
        ('theweeknd@rythmify.com',        'After Hours Radio',             'Dark R&B and pop from The Weeknd.',                                     'R&B',              '2020-03-20'::date, 7),
        ('drake@rythmify.com',            'Toronto Nights',                'Hip-hop and melodic rap tracks from Drake.',                            'Hip-Hop',          '2022-06-17'::date, 8),
        ('kendricklamar@rythmify.com',    'Compton Chapters',              'Sharp, cinematic hip-hop from Kendrick Lamar.',                         'Hip-Hop',          '2024-05-03'::date, 8),
        ('frankocean@rythmify.com',       'Blonde Light',                  'Intimate R&B reflections from Frank Ocean.',                            'R&B',              '2017-04-10'::date, 7),
        ('tylerthecreator@rythmify.com',  'Pastel Rap Suite',              'Bold, melodic hip-hop from Tyler The Creator.',                         'Hip-Hop',          '2019-05-17'::date, 7),
        ('billieeilish@rythmify.com',     'Quiet Voltage',                 'Minimal and cinematic indie-pop from Billie Eilish.',                   'Indie Pop',        '2021-07-30'::date, 7),
        ('daftpunk@rythmify.com',         'Robot Disco Archive',           'Electronic dance essentials from Daft Punk.',                           'Electronic',       '2013-05-17'::date, 8)
    ),
    ranked_tracks AS (
      SELECT
        seed.album_name,
        artist.id AS artist_id,
        track.id AS track_id,
        ROW_NUMBER() OVER (
          PARTITION BY artist.id
          ORDER BY track.release_date DESC NULLS LAST, track.title
        ) AS position,
        seed.track_limit
      FROM album_seed seed
      JOIN users artist
        ON artist.email = seed.artist_email
       AND artist.role = 'artist'
      JOIN tracks track
        ON track.user_id = artist.id
       AND track.deleted_at IS NULL
    )
    INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
    SELECT
      album.id,
      ranked_tracks.track_id,
      ranked_tracks.position,
      NOW()
    FROM ranked_tracks
    JOIN playlists album
      ON album.user_id = ranked_tracks.artist_id
     AND album.name = ranked_tracks.album_name
     AND album.subtype = 'album'
     AND album.deleted_at IS NULL
    WHERE ranked_tracks.position <= ranked_tracks.track_limit
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    WITH album_seed (artist_email, album_name) AS (
      VALUES
        ('tameimpala@rythmify.com',       'Currents of Color'),
        ('radiohead@rythmify.com',        'Static Bloom'),
        ('arcticmonkeys@rythmify.com',    'Neon Sheffield Nights'),
        ('marwanpablo@rythmify.com',      'Cairo Trap Files'),
        ('dominicfike@rythmify.com',      'Sunburn Signals'),
        ('glassanimals@rythmify.com',     'Heatwave Dreams'),
        ('tul8te@rythmify.com',           'Modern Cairo Pop'),
        ('amrdiab@rythmify.com',          'Mediterranean Classics'),
        ('elissa@rythmify.com',           'Velvet Beirut'),
        ('adele@rythmify.com',            'After the Rain'),
        ('cairokee@rythmify.com',         'Downtown Anthems'),
        ('theweeknd@rythmify.com',        'After Hours Radio'),
        ('drake@rythmify.com',            'Toronto Nights'),
        ('kendricklamar@rythmify.com',    'Compton Chapters'),
        ('frankocean@rythmify.com',       'Blonde Light'),
        ('tylerthecreator@rythmify.com',  'Pastel Rap Suite'),
        ('billieeilish@rythmify.com',     'Quiet Voltage'),
        ('daftpunk@rythmify.com',         'Robot Disco Archive')
    ),
    seeded_albums AS (
      SELECT playlist.id
      FROM album_seed seed
      JOIN users artist
        ON artist.email = seed.artist_email
       AND artist.role = 'artist'
      JOIN playlists playlist
        ON playlist.user_id = artist.id
       AND playlist.name = seed.album_name
       AND playlist.subtype = 'album'
    )
    DELETE FROM playlist_tracks
    WHERE playlist_id IN (SELECT id FROM seeded_albums);
  `);

  await db.runSql(`
    WITH album_seed (artist_email, album_name) AS (
      VALUES
        ('tameimpala@rythmify.com',       'Currents of Color'),
        ('radiohead@rythmify.com',        'Static Bloom'),
        ('arcticmonkeys@rythmify.com',    'Neon Sheffield Nights'),
        ('marwanpablo@rythmify.com',      'Cairo Trap Files'),
        ('dominicfike@rythmify.com',      'Sunburn Signals'),
        ('glassanimals@rythmify.com',     'Heatwave Dreams'),
        ('tul8te@rythmify.com',           'Modern Cairo Pop'),
        ('amrdiab@rythmify.com',          'Mediterranean Classics'),
        ('elissa@rythmify.com',           'Velvet Beirut'),
        ('adele@rythmify.com',            'After the Rain'),
        ('cairokee@rythmify.com',         'Downtown Anthems'),
        ('theweeknd@rythmify.com',        'After Hours Radio'),
        ('drake@rythmify.com',            'Toronto Nights'),
        ('kendricklamar@rythmify.com',    'Compton Chapters'),
        ('frankocean@rythmify.com',       'Blonde Light'),
        ('tylerthecreator@rythmify.com',  'Pastel Rap Suite'),
        ('billieeilish@rythmify.com',     'Quiet Voltage'),
        ('daftpunk@rythmify.com',         'Robot Disco Archive')
    )
    DELETE FROM playlists playlist
    USING album_seed seed, users artist
    WHERE artist.email = seed.artist_email
      AND artist.role = 'artist'
      AND playlist.user_id = artist.id
      AND playlist.name = seed.album_name
      AND playlist.subtype = 'album';
  `);
};

exports._meta = { version: 1 };
