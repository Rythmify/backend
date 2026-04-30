'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  await db.runSql(`
    WITH target_playlists AS (
      SELECT playlist.id, playlist.user_id
      FROM playlists playlist
      JOIN users artist
        ON artist.id = playlist.user_id
       AND artist.role = 'artist'
       AND playlist.name = artist.display_name
      WHERE playlist.subtype = 'playlist'
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
    DELETE FROM playlist_tracks
    WHERE playlist_id IN (
      SELECT playlist.id
      FROM playlists playlist
      JOIN users artist
        ON artist.id = playlist.user_id
       AND artist.role = 'artist'
       AND playlist.name = artist.display_name
      WHERE playlist.subtype = 'playlist'
        AND playlist.deleted_at IS NULL
        AND playlist.description = 'Rythmify seed artist playlist.'
    );
  `);
};

exports._meta = { version: 1 };
