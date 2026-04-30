'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    DELETE FROM playlist_tracks
    WHERE track_id NOT IN (SELECT id FROM tracks)
       OR playlist_id NOT IN (SELECT id FROM playlists);
  `);

  await db.runSql(`
    DELETE FROM listening_history
    WHERE track_id NOT IN (SELECT id FROM tracks);
  `);

  await db.runSql(`
    DELETE FROM comment_likes
    WHERE comment_id IN (
      SELECT comment.id
      FROM comments comment
      LEFT JOIN tracks track
        ON track.id = comment.track_id
      WHERE track.id IS NULL
         OR track.title = 'tracks'
    );
  `);

  await db.runSql(`
    DELETE FROM comments
    WHERE track_id NOT IN (SELECT id FROM tracks)
       OR track_id IN (SELECT id FROM tracks WHERE title = 'tracks');
  `);

  await db.runSql(`
    DELETE FROM track_likes
    WHERE track_id NOT IN (SELECT id FROM tracks)
       OR track_id IN (SELECT id FROM tracks WHERE title = 'tracks');
  `);

  await db.runSql(`
    DELETE FROM track_reposts
    WHERE track_id NOT IN (SELECT id FROM tracks)
       OR track_id IN (SELECT id FROM tracks WHERE title = 'tracks');
  `);

  await db.runSql(`
    DELETE FROM track_tags
    WHERE track_id NOT IN (SELECT id FROM tracks)
       OR track_id IN (SELECT id FROM tracks WHERE title = 'tracks');
  `);

  await db.runSql(`
    DELETE FROM track_artists
    WHERE track_id NOT IN (SELECT id FROM tracks)
       OR track_id IN (SELECT id FROM tracks WHERE title = 'tracks');
  `);

  await db.runSql(`
    DELETE FROM tracks
    WHERE title = 'tracks';
  `);

  await db.runSql(`
    WITH artist_track_counts AS (
      SELECT
        artist.id AS artist_id,
        artist.display_name AS artist_name,
        MIN(track.cover_image) FILTER (
          WHERE track.cover_image IS NOT NULL
            AND track.cover_image <> 'pending'
        ) AS fallback_cover_image
      FROM users artist
      JOIN tracks track
        ON track.user_id = artist.id
       AND track.deleted_at IS NULL
       AND track.is_public = true
       AND track.status = 'ready'
      WHERE artist.role = 'artist'
        AND artist.deleted_at IS NULL
      GROUP BY artist.id, artist.display_name
    ),
    first_track_cover AS (
      SELECT DISTINCT ON (track.user_id)
        track.user_id AS artist_id,
        track.cover_image
      FROM tracks track
      WHERE track.deleted_at IS NULL
        AND track.is_public = true
        AND track.status = 'ready'
        AND track.cover_image IS NOT NULL
        AND track.cover_image <> 'pending'
      ORDER BY track.user_id, track.created_at ASC, track.title ASC
    ),
    inserted_playlists AS (
      INSERT INTO playlists (
        user_id,
        name,
        description,
        cover_image,
        type,
        subtype,
        is_public
      )
      SELECT
        artist_track_counts.artist_id,
        artist_track_counts.artist_name,
        'Rythmify seed artist playlist.',
        COALESCE(first_track_cover.cover_image, artist_track_counts.fallback_cover_image, 'pending'),
        'regular',
        'playlist',
        true
      FROM artist_track_counts
      LEFT JOIN first_track_cover
        ON first_track_cover.artist_id = artist_track_counts.artist_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM playlists existing
        WHERE existing.user_id = artist_track_counts.artist_id
          AND existing.name = artist_track_counts.artist_name
          AND existing.subtype = 'playlist'
          AND existing.deleted_at IS NULL
      )
      RETURNING id, user_id
    ),
    target_playlists AS (
      SELECT playlist.id, playlist.user_id
      FROM playlists playlist
      JOIN users artist
        ON artist.id = playlist.user_id
       AND artist.role = 'artist'
      WHERE playlist.name = artist.display_name
        AND playlist.subtype = 'playlist'
        AND playlist.deleted_at IS NULL
    ),
    ordered_tracks AS (
      SELECT
        target_playlists.id AS playlist_id,
        track.id AS track_id,
        ROW_NUMBER() OVER (
          PARTITION BY target_playlists.id
          ORDER BY track.created_at ASC, track.title ASC
        ) AS position
      FROM target_playlists
      JOIN tracks track
        ON track.user_id = target_playlists.user_id
       AND track.deleted_at IS NULL
       AND track.is_public = true
       AND track.status = 'ready'
    )
    INSERT INTO playlist_tracks (playlist_id, track_id, position)
    SELECT playlist_id, track_id, position
    FROM ordered_tracks
    ON CONFLICT (playlist_id, track_id) DO NOTHING;
  `);

  await db.runSql(`
    WITH first_track_cover AS (
      SELECT DISTINCT ON (playlist.id)
        playlist.id AS playlist_id,
        track.cover_image
      FROM playlists playlist
      JOIN users artist
        ON artist.id = playlist.user_id
       AND artist.role = 'artist'
       AND playlist.name = artist.display_name
      JOIN playlist_tracks playlist_track
        ON playlist_track.playlist_id = playlist.id
      JOIN tracks track
        ON track.id = playlist_track.track_id
       AND track.deleted_at IS NULL
      WHERE playlist.subtype = 'playlist'
        AND playlist.deleted_at IS NULL
        AND track.cover_image IS NOT NULL
        AND track.cover_image <> 'pending'
      ORDER BY playlist.id, playlist_track.position ASC, track.created_at ASC
    )
    UPDATE playlists playlist
    SET cover_image = first_track_cover.cover_image,
        updated_at = NOW()
    FROM first_track_cover
    WHERE playlist.id = first_track_cover.playlist_id
      AND (
        playlist.cover_image IS NULL
        OR playlist.cover_image = 'pending'
        OR playlist.cover_image IS DISTINCT FROM first_track_cover.cover_image
      );
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM playlists
    WHERE description = 'Rythmify seed artist playlist.'
      AND subtype = 'playlist';
  `);
};

exports._meta = { version: 1 };
