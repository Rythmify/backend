'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    WITH playlist_seed (artist_email, artist_name, owner_email) AS (
      VALUES
        ('tameimpala@rythmify.com',      'Tame Impala',        'ahmed.hassan@example.com'),
        ('radiohead@rythmify.com',       'Radiohead',          'mohamed.ali@example.com'),
        ('arcticmonkeys@rythmify.com',   'Arctic Monkeys',     'fatma.ibrahim@example.com'),
        ('marwanpablo@rythmify.com',     'Marwan Pablo',       'omar.khalid@example.com'),
        ('dominicfike@rythmify.com',     'Dominic Fike',       'nour.eldin@example.com'),
        ('glassanimals@rythmify.com',    'Glass Animals',      'layla.mostafa@example.com'),
        ('tul8te@rythmify.com',          'TUL8TE',             'karim.youssef@example.com'),
        ('amrdiab@rythmify.com',         'Amr Diab',           'sara.ahmed@example.com'),
        ('elissa@rythmify.com',          'Elissa',             'mahmoud.hassan@example.com'),
        ('adele@rythmify.com',           'Adele',              'rana.tarek@example.com'),
        ('cairokee@rythmify.com',        'Cairokee',           'youssef.samir@example.com'),
        ('theweeknd@rythmify.com',       'The Weeknd',         'hana.mohamed@example.com'),
        ('drake@rythmify.com',           'Drake',              'khaled.nasser@example.com'),
        ('kendricklamar@rythmify.com',   'Kendrick Lamar',     'dina.kamal@example.com'),
        ('frankocean@rythmify.com',      'Frank Ocean',        'amira.sayed@example.com'),
        ('tylerthecreator@rythmify.com', 'Tyler The Creator',  'james.wilson@example.com'),
        ('billieeilish@rythmify.com',    'Billie Eilish',      'emma.thompson@example.com'),
        ('daftpunk@rythmify.com',        'Daft Punk',          'lucas.garcia@example.com')
    )
    INSERT INTO playlists (
      name, description, cover_image, type, is_public,
      user_id, subtype, created_at
    )
    SELECT
      seed.artist_name || ' - Rythmify Seed',
      'A listener-curated seed playlist featuring every seeded track by ' || seed.artist_name || '.',
      'pending',
      'regular',
      true,
      owner.id,
      'playlist',
      NOW()
    FROM playlist_seed seed
    JOIN users owner
      ON owner.email = seed.owner_email
     AND owner.role = 'listener'
    WHERE NOT EXISTS (
      SELECT 1
      FROM playlists existing
      WHERE existing.user_id = owner.id
        AND existing.name = seed.artist_name || ' - Rythmify Seed'
        AND existing.subtype = 'playlist'
        AND existing.deleted_at IS NULL
    )
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH mix_seed (playlist_name, owner_email) AS (
      VALUES ('Rythmify Mix', 'ahmed.hassan@example.com')
    )
    INSERT INTO playlists (
      name, description, cover_image, type, is_public,
      user_id, subtype, created_at
    )
    SELECT
      seed.playlist_name,
      'A cross-genre Rythmify seed mix spanning the full demo catalog.',
      'pending',
      'regular',
      true,
      owner.id,
      'playlist',
      NOW()
    FROM mix_seed seed
    JOIN users owner
      ON owner.email = seed.owner_email
     AND owner.role = 'listener'
    WHERE NOT EXISTS (
      SELECT 1
      FROM playlists existing
      WHERE existing.user_id = owner.id
        AND existing.name = seed.playlist_name
        AND existing.subtype = 'playlist'
        AND existing.deleted_at IS NULL
    )
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH playlist_seed (artist_email, artist_name, owner_email) AS (
      VALUES
        ('tameimpala@rythmify.com',      'Tame Impala',        'ahmed.hassan@example.com'),
        ('radiohead@rythmify.com',       'Radiohead',          'mohamed.ali@example.com'),
        ('arcticmonkeys@rythmify.com',   'Arctic Monkeys',     'fatma.ibrahim@example.com'),
        ('marwanpablo@rythmify.com',     'Marwan Pablo',       'omar.khalid@example.com'),
        ('dominicfike@rythmify.com',     'Dominic Fike',       'nour.eldin@example.com'),
        ('glassanimals@rythmify.com',    'Glass Animals',      'layla.mostafa@example.com'),
        ('tul8te@rythmify.com',          'TUL8TE',             'karim.youssef@example.com'),
        ('amrdiab@rythmify.com',         'Amr Diab',           'sara.ahmed@example.com'),
        ('elissa@rythmify.com',          'Elissa',             'mahmoud.hassan@example.com'),
        ('adele@rythmify.com',           'Adele',              'rana.tarek@example.com'),
        ('cairokee@rythmify.com',        'Cairokee',           'youssef.samir@example.com'),
        ('theweeknd@rythmify.com',       'The Weeknd',         'hana.mohamed@example.com'),
        ('drake@rythmify.com',           'Drake',              'khaled.nasser@example.com'),
        ('kendricklamar@rythmify.com',   'Kendrick Lamar',     'dina.kamal@example.com'),
        ('frankocean@rythmify.com',      'Frank Ocean',        'amira.sayed@example.com'),
        ('tylerthecreator@rythmify.com', 'Tyler The Creator',  'james.wilson@example.com'),
        ('billieeilish@rythmify.com',    'Billie Eilish',      'emma.thompson@example.com'),
        ('daftpunk@rythmify.com',        'Daft Punk',          'lucas.garcia@example.com')
    ),
    ranked_tracks AS (
      SELECT
        seed.artist_name,
        owner.id AS owner_id,
        track.id AS track_id,
        ROW_NUMBER() OVER (
          PARTITION BY artist.id
          ORDER BY track.release_date DESC NULLS LAST, track.title
        ) AS position
      FROM playlist_seed seed
      JOIN users owner
        ON owner.email = seed.owner_email
       AND owner.role = 'listener'
      JOIN users artist
        ON artist.email = seed.artist_email
       AND artist.role = 'artist'
      JOIN tracks track
        ON track.user_id = artist.id
       AND track.deleted_at IS NULL
    )
    INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
    SELECT
      playlist.id,
      ranked_tracks.track_id,
      ranked_tracks.position,
      NOW()
    FROM ranked_tracks
    JOIN playlists playlist
      ON playlist.user_id = ranked_tracks.owner_id
     AND playlist.name = ranked_tracks.artist_name || ' - Rythmify Seed'
     AND playlist.subtype = 'playlist'
     AND playlist.deleted_at IS NULL
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH mix_seed (playlist_name, owner_email) AS (
      VALUES ('Rythmify Mix', 'ahmed.hassan@example.com')
    ),
    seeded_artists (artist_email) AS (
      VALUES
        ('tameimpala@rythmify.com'),
        ('radiohead@rythmify.com'),
        ('arcticmonkeys@rythmify.com'),
        ('marwanpablo@rythmify.com'),
        ('dominicfike@rythmify.com'),
        ('glassanimals@rythmify.com'),
        ('tul8te@rythmify.com'),
        ('amrdiab@rythmify.com'),
        ('elissa@rythmify.com'),
        ('adele@rythmify.com'),
        ('cairokee@rythmify.com'),
        ('theweeknd@rythmify.com'),
        ('drake@rythmify.com'),
        ('kendricklamar@rythmify.com'),
        ('frankocean@rythmify.com'),
        ('tylerthecreator@rythmify.com'),
        ('billieeilish@rythmify.com'),
        ('daftpunk@rythmify.com')
    ),
    ranked_tracks AS (
      SELECT
        track.id AS track_id,
        ROW_NUMBER() OVER (
          PARTITION BY artist.id
          ORDER BY track.release_date DESC NULLS LAST, track.title
        ) AS artist_track_rank,
        ROW_NUMBER() OVER (
          ORDER BY artist.display_name, track.release_date DESC NULLS LAST, track.title
        ) AS mix_position
      FROM seeded_artists seed
      JOIN users artist
        ON artist.email = seed.artist_email
       AND artist.role = 'artist'
      JOIN tracks track
        ON track.user_id = artist.id
       AND track.deleted_at IS NULL
    )
    INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
    SELECT
      playlist.id,
      ranked_tracks.track_id,
      ranked_tracks.mix_position,
      NOW()
    FROM ranked_tracks
    JOIN mix_seed seed ON true
    JOIN users owner
      ON owner.email = seed.owner_email
     AND owner.role = 'listener'
    JOIN playlists playlist
      ON playlist.user_id = owner.id
     AND playlist.name = seed.playlist_name
     AND playlist.subtype = 'playlist'
     AND playlist.deleted_at IS NULL
    WHERE ranked_tracks.artist_track_rank <= 2
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    WITH playlist_seed (artist_name, owner_email) AS (
      VALUES
        ('Tame Impala',        'ahmed.hassan@example.com'),
        ('Radiohead',          'mohamed.ali@example.com'),
        ('Arctic Monkeys',     'fatma.ibrahim@example.com'),
        ('Marwan Pablo',       'omar.khalid@example.com'),
        ('Dominic Fike',       'nour.eldin@example.com'),
        ('Glass Animals',      'layla.mostafa@example.com'),
        ('TUL8TE',             'karim.youssef@example.com'),
        ('Amr Diab',           'sara.ahmed@example.com'),
        ('Elissa',             'mahmoud.hassan@example.com'),
        ('Adele',              'rana.tarek@example.com'),
        ('Cairokee',           'youssef.samir@example.com'),
        ('The Weeknd',         'hana.mohamed@example.com'),
        ('Drake',              'khaled.nasser@example.com'),
        ('Kendrick Lamar',     'dina.kamal@example.com'),
        ('Frank Ocean',        'amira.sayed@example.com'),
        ('Tyler The Creator',  'james.wilson@example.com'),
        ('Billie Eilish',      'emma.thompson@example.com'),
        ('Daft Punk',          'lucas.garcia@example.com')
    ),
    seeded_playlists AS (
      SELECT playlist.id
      FROM playlist_seed seed
      JOIN users owner
        ON owner.email = seed.owner_email
       AND owner.role = 'listener'
      JOIN playlists playlist
        ON playlist.user_id = owner.id
       AND playlist.name = seed.artist_name || ' - Rythmify Seed'
       AND playlist.subtype = 'playlist'

      UNION

      SELECT playlist.id
      FROM users owner
      JOIN playlists playlist
        ON playlist.user_id = owner.id
       AND playlist.name = 'Rythmify Mix'
       AND playlist.subtype = 'playlist'
      WHERE owner.email = 'ahmed.hassan@example.com'
        AND owner.role = 'listener'
    )
    DELETE FROM playlist_tracks
    WHERE playlist_id IN (SELECT id FROM seeded_playlists);
  `);

  await db.runSql(`
    WITH playlist_seed (artist_name, owner_email) AS (
      VALUES
        ('Tame Impala',        'ahmed.hassan@example.com'),
        ('Radiohead',          'mohamed.ali@example.com'),
        ('Arctic Monkeys',     'fatma.ibrahim@example.com'),
        ('Marwan Pablo',       'omar.khalid@example.com'),
        ('Dominic Fike',       'nour.eldin@example.com'),
        ('Glass Animals',      'layla.mostafa@example.com'),
        ('TUL8TE',             'karim.youssef@example.com'),
        ('Amr Diab',           'sara.ahmed@example.com'),
        ('Elissa',             'mahmoud.hassan@example.com'),
        ('Adele',              'rana.tarek@example.com'),
        ('Cairokee',           'youssef.samir@example.com'),
        ('The Weeknd',         'hana.mohamed@example.com'),
        ('Drake',              'khaled.nasser@example.com'),
        ('Kendrick Lamar',     'dina.kamal@example.com'),
        ('Frank Ocean',        'amira.sayed@example.com'),
        ('Tyler The Creator',  'james.wilson@example.com'),
        ('Billie Eilish',      'emma.thompson@example.com'),
        ('Daft Punk',          'lucas.garcia@example.com')
    ),
    seeded_playlists AS (
      SELECT playlist.id
      FROM playlist_seed seed
      JOIN users owner
        ON owner.email = seed.owner_email
       AND owner.role = 'listener'
      JOIN playlists playlist
        ON playlist.user_id = owner.id
       AND playlist.name = seed.artist_name || ' - Rythmify Seed'
       AND playlist.subtype = 'playlist'

      UNION

      SELECT playlist.id
      FROM users owner
      JOIN playlists playlist
        ON playlist.user_id = owner.id
       AND playlist.name = 'Rythmify Mix'
       AND playlist.subtype = 'playlist'
      WHERE owner.email = 'ahmed.hassan@example.com'
        AND owner.role = 'listener'
    )
    DELETE FROM playlists
    WHERE id IN (SELECT id FROM seeded_playlists);
  `);
};

exports._meta = { version: 1 };
