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

const ARTIST_PLAYLIST_NAMES = [
  'Tame Impala - Rythmify Seed',
  'Radiohead - Rythmify Seed',
  'Arctic Monkeys - Rythmify Seed',
  'Marwan Pablo - Rythmify Seed',
  'Dominic Fike - Rythmify Seed',
  'Glass Animals - Rythmify Seed',
  'TUL8TE - Rythmify Seed',
  'Amr Diab - Rythmify Seed',
  'Elissa - Rythmify Seed',
  'Adele - Rythmify Seed',
  'Cairokee - Rythmify Seed',
  'The Weeknd - Rythmify Seed',
  'Drake - Rythmify Seed',
  'Kendrick Lamar - Rythmify Seed',
  'Frank Ocean - Rythmify Seed',
  'Tyler The Creator - Rythmify Seed',
  'Billie Eilish - Rythmify Seed',
  'Daft Punk - Rythmify Seed',
  'Rythmify Mix',
  'Currents of Color',
  'Static Bloom',
  'Neon Sheffield Nights',
  'Cairo Trap Files',
  'Sunburn Signals',
  'Heatwave Dreams',
  'Modern Cairo Pop',
  'Mediterranean Classics',
  'Velvet Beirut',
  'After the Rain',
  'Downtown Anthems',
  'After Hours Radio',
  'Toronto Nights',
  'Compton Chapters',
  'Blonde Light',
  'Pastel Rap Suite',
  'Quiet Voltage',
  'Robot Disco Archive',
];

const SEEDED_COMMENT_CONTENT = [
  'Seed comment: this one went straight into rotation.',
  'Seed comment: the replay value here is serious.',
  'Seed comment: perfect track for discovering this artist.',
  'Seed comment: this sounds even better on headphones.',
  'Seed comment: saving this for the weekend queue.',
  'Seed comment: the production detail is excellent.',
];

const sqlArray = (values) =>
  `ARRAY[${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')}]`;

exports.up = async function (db) {
  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND artist.role = 'artist'
        AND track.deleted_at IS NULL
    ),
    ranked_pairs AS (
      SELECT
        listener.id AS user_id,
        track.id AS track_id,
        ROW_NUMBER() OVER (
          PARTITION BY listener.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_listeners listener
      CROSS JOIN seeded_tracks track
    )
    INSERT INTO track_likes (user_id, track_id, created_at)
    SELECT
      user_id,
      track_id,
      NOW() - (FLOOR(RANDOM() * 75) * INTERVAL '1 day')
    FROM ranked_pairs
    WHERE rn <= 18
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND artist.role = 'artist'
        AND track.deleted_at IS NULL
    ),
    ranked_pairs AS (
      SELECT
        listener.id AS user_id,
        track.id AS track_id,
        ROW_NUMBER() OVER (
          PARTITION BY listener.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_listeners listener
      CROSS JOIN seeded_tracks track
    )
    INSERT INTO track_reposts (user_id, track_id, created_at)
    SELECT
      user_id,
      track_id,
      NOW() - (FLOOR(RANDOM() * 60) * INTERVAL '1 day')
    FROM ranked_pairs
    WHERE rn <= 7
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_playlists AS (
      SELECT playlist.id
      FROM playlists playlist
      WHERE playlist.name = ANY (${sqlArray(ARTIST_PLAYLIST_NAMES)})
        AND playlist.deleted_at IS NULL
    ),
    ranked_pairs AS (
      SELECT
        listener.id AS user_id,
        playlist.id AS playlist_id,
        ROW_NUMBER() OVER (
          PARTITION BY listener.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_listeners listener
      CROSS JOIN seeded_playlists playlist
    )
    INSERT INTO playlist_likes (user_id, playlist_id, created_at)
    SELECT
      user_id,
      playlist_id,
      NOW() - (FLOOR(RANDOM() * 70) * INTERVAL '1 day')
    FROM ranked_pairs
    WHERE rn <= 9
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_playlists AS (
      SELECT playlist.id
      FROM playlists playlist
      WHERE playlist.name = ANY (${sqlArray(ARTIST_PLAYLIST_NAMES)})
        AND playlist.deleted_at IS NULL
    ),
    ranked_pairs AS (
      SELECT
        listener.id AS user_id,
        playlist.id AS playlist_id,
        ROW_NUMBER() OVER (
          PARTITION BY listener.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_listeners listener
      CROSS JOIN seeded_playlists playlist
    )
    INSERT INTO playlist_reposts (user_id, playlist_id, created_at)
    SELECT
      user_id,
      playlist_id,
      NOW() - (FLOOR(RANDOM() * 55) * INTERVAL '1 day')
    FROM ranked_pairs
    WHERE rn <= 4
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_tracks AS (
      SELECT track.id, COALESCE(track.duration, 180) AS duration
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND artist.role = 'artist'
        AND track.deleted_at IS NULL
    ),
    ranked_pairs AS (
      SELECT
        listener.id AS user_id,
        track.id AS track_id,
        LEAST(FLOOR(RANDOM() * GREATEST(track.duration, 1))::integer, track.duration) AS track_timestamp,
        (${sqlArray(SEEDED_COMMENT_CONTENT)})[1 + FLOOR(RANDOM() * ${SEEDED_COMMENT_CONTENT.length})::integer] AS content,
        ROW_NUMBER() OVER (
          PARTITION BY listener.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_listeners listener
      CROSS JOIN seeded_tracks track
    )
    INSERT INTO comments (user_id, track_id, content, track_timestamp, created_at)
    SELECT
      user_id,
      track_id,
      content,
      track_timestamp,
      NOW() - (FLOOR(RANDOM() * 45) * INTERVAL '1 day')
    FROM ranked_pairs pair
    WHERE rn <= 5
      AND NOT EXISTS (
        SELECT 1
        FROM comments existing
        WHERE existing.user_id = pair.user_id
          AND existing.track_id = pair.track_id
          AND existing.content = pair.content
      )
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_comments AS (
      SELECT comment.id, comment.user_id
      FROM comments comment
      JOIN tracks track ON track.id = comment.track_id
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND comment.content = ANY (${sqlArray(SEEDED_COMMENT_CONTENT)})
        AND comment.deleted_at IS NULL
    ),
    ranked_pairs AS (
      SELECT
        listener.id AS user_id,
        comment.id AS comment_id,
        ROW_NUMBER() OVER (
          PARTITION BY comment.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_comments comment
      JOIN seeded_listeners listener ON listener.id <> comment.user_id
    )
    INSERT INTO comment_likes (user_id, comment_id, created_at)
    SELECT
      user_id,
      comment_id,
      NOW() - (FLOOR(RANDOM() * 35) * INTERVAL '1 day')
    FROM ranked_pairs
    WHERE rn <= 3
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_listener_followers AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
      ORDER BY created_at
      OFFSET 10
    ),
    ranked_pairs AS (
      SELECT
        follower.id AS follower_id,
        following.id AS following_id,
        ROW_NUMBER() OVER (
          PARTITION BY follower.id
          ORDER BY RANDOM()
        ) AS rn
      FROM seeded_listener_followers follower
      JOIN seeded_listeners following ON following.id <> follower.id
    )
    INSERT INTO follows (follower_id, following_id, created_at)
    SELECT
      follower_id,
      following_id,
      NOW() - (FLOOR(RANDOM() * 80) * INTERVAL '1 day')
    FROM ranked_pairs
    WHERE rn <= 5
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    WITH seeded_comments AS (
      SELECT id
      FROM comments
      WHERE content = ANY (${sqlArray(SEEDED_COMMENT_CONTENT)})
    )
    DELETE FROM comment_likes
    WHERE comment_id IN (SELECT id FROM seeded_comments)
      AND user_id IN (
         SELECT id FROM users
         WHERE role = 'listener'
           AND email LIKE '%@example.com'
       );
  `);

  await db.runSql(`
    DELETE FROM comments
    WHERE content = ANY (${sqlArray(SEEDED_COMMENT_CONTENT)})
      AND user_id IN (
        SELECT id FROM users
        WHERE role = 'listener'
          AND email LIKE '%@example.com'
      );
  `);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND artist.role = 'artist'
    )
    DELETE FROM track_reposts
    WHERE user_id IN (
        SELECT id FROM users
        WHERE role = 'listener'
          AND email LIKE '%@example.com'
      )
      AND track_id IN (SELECT id FROM seeded_tracks);
  `);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${sqlArray(SEEDED_ARTIST_EMAILS)})
        AND artist.role = 'artist'
    )
    DELETE FROM track_likes
    WHERE user_id IN (
        SELECT id FROM users
        WHERE role = 'listener'
          AND email LIKE '%@example.com'
      )
      AND track_id IN (SELECT id FROM seeded_tracks);
  `);

  await db.runSql(`
    WITH seeded_playlists AS (
      SELECT id
      FROM playlists
      WHERE name = ANY (${sqlArray(ARTIST_PLAYLIST_NAMES)})
    )
    DELETE FROM playlist_reposts
    WHERE user_id IN (
        SELECT id FROM users
        WHERE role = 'listener'
          AND email LIKE '%@example.com'
      )
      AND playlist_id IN (SELECT id FROM seeded_playlists);
  `);

  await db.runSql(`
    WITH seeded_playlists AS (
      SELECT id
      FROM playlists
      WHERE name = ANY (${sqlArray(ARTIST_PLAYLIST_NAMES)})
    )
    DELETE FROM playlist_likes
    WHERE user_id IN (
        SELECT id FROM users
        WHERE role = 'listener'
          AND email LIKE '%@example.com'
      )
      AND playlist_id IN (SELECT id FROM seeded_playlists);
  `);

  await db.runSql(`
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_listener_followers AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
      ORDER BY created_at
      OFFSET 10
    )
    DELETE FROM follows
    WHERE follower_id IN (SELECT id FROM seeded_listener_followers)
      AND following_id IN (SELECT id FROM seeded_listeners);
  `);
};

exports._meta = { version: 1 };
