'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    WITH extra_tracks (
      artist_email, genre_name, title, description, duration,
      release_date, explicit_content
    ) AS (
      VALUES
        (
          'billieeilish@rythmify.com',
          'Indie Pop',
          'THE DINER',
          'A tense, cinematic indie-pop track with a stalker-noir edge.',
          186,
          '2024-05-17'::date,
          false
        )
    ),
    inserted_tracks AS (
      INSERT INTO tracks (
        title, description, user_id, genre_id,
        audio_url, stream_url, cover_image,
        duration, status, is_public, release_date,
        explicit_content, license_type
      )
      SELECT
        extra.title,
        extra.description,
        artist.id,
        genre.id,
        'pending',
        'pending',
        'pending',
        extra.duration,
        'ready',
        true,
        extra.release_date,
        extra.explicit_content,
        'all_rights_reserved'
      FROM extra_tracks extra
      JOIN users artist
        ON artist.email = extra.artist_email
       AND artist.role = 'artist'
      JOIN genres genre
        ON genre.name = extra.genre_name
      WHERE NOT EXISTS (
        SELECT 1
        FROM tracks existing
        WHERE existing.user_id = artist.id
          AND existing.deleted_at IS NULL
          AND regexp_replace(lower(existing.title), '[^a-z0-9]+', '', 'g')
              = regexp_replace(lower(extra.title), '[^a-z0-9]+', '', 'g')
      )
      RETURNING id, user_id, genre_id
    )
    INSERT INTO track_artists (track_id, artist_id, position)
    SELECT id, user_id, 1
    FROM inserted_tracks
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH genre_tag_map (genre_name, tag_name) AS (
      VALUES
        ('Indie Pop', 'indie'),
        ('Indie Pop', 'pop'),
        ('Indie Pop', 'chill'),
        ('Indie Pop', 'vibes')
    ),
    extra_tracks AS (
      SELECT track.id AS track_id, genre.name AS genre_name
      FROM tracks track
      JOIN users artist
        ON artist.id = track.user_id
       AND artist.email = 'billieeilish@rythmify.com'
       AND artist.role = 'artist'
      JOIN genres genre
        ON genre.id = track.genre_id
      WHERE track.deleted_at IS NULL
        AND regexp_replace(lower(track.title), '[^a-z0-9]+', '', 'g') = 'thediner'
    )
    INSERT INTO track_tags (track_id, tag_id, created_at)
    SELECT extra_tracks.track_id, tags.id, NOW()
    FROM extra_tracks
    JOIN genre_tag_map
      ON genre_tag_map.genre_name = extra_tracks.genre_name
    JOIN tags
      ON tags.name = genre_tag_map.tag_name
    ON CONFLICT DO NOTHING;
  `);

  await db.runSql(`
    WITH diner AS (
      SELECT track.id AS track_id
      FROM tracks track
      JOIN users artist
        ON artist.id = track.user_id
       AND artist.email = 'billieeilish@rythmify.com'
      WHERE track.deleted_at IS NULL
        AND regexp_replace(lower(track.title), '[^a-z0-9]+', '', 'g') = 'thediner'
      LIMIT 1
    ),
    billie_playlist AS (
      SELECT playlist.id AS playlist_id
      FROM playlists playlist
      WHERE playlist.name = 'Billie Eilish - Rythmify Seed'
        AND playlist.deleted_at IS NULL
      LIMIT 1
    ),
    next_position AS (
      SELECT COALESCE(MAX(position), 0) + 1 AS position
      FROM playlist_tracks
      WHERE playlist_id = (SELECT playlist_id FROM billie_playlist)
    )
    INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
    SELECT billie_playlist.playlist_id, diner.track_id, next_position.position, NOW()
    FROM billie_playlist, diner, next_position
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    WITH diner AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist
        ON artist.id = track.user_id
       AND artist.email = 'billieeilish@rythmify.com'
       AND artist.role = 'artist'
      WHERE regexp_replace(lower(track.title), '[^a-z0-9]+', '', 'g') = 'thediner'
    )
    DELETE FROM playlist_tracks
    WHERE track_id IN (SELECT id FROM diner);
  `);

  await db.runSql(`
    WITH diner AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist
        ON artist.id = track.user_id
       AND artist.email = 'billieeilish@rythmify.com'
       AND artist.role = 'artist'
      WHERE regexp_replace(lower(track.title), '[^a-z0-9]+', '', 'g') = 'thediner'
    )
    DELETE FROM track_tags
    WHERE track_id IN (SELECT id FROM diner);
  `);

  await db.runSql(`
    DELETE FROM tracks track
    USING users artist
    WHERE artist.id = track.user_id
      AND artist.email = 'billieeilish@rythmify.com'
      AND artist.role = 'artist'
      AND regexp_replace(lower(track.title), '[^a-z0-9]+', '', 'g') = 'thediner';
  `);
};

exports._meta = { version: 1 };
