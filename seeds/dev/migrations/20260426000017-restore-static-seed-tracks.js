'use strict';

const { ARTIST_EMAILS } = require('../../seed-audio-manifest');

exports.setup = function () {};

const sqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = (values) => `ARRAY[${values.map(sqlLiteral).join(', ')}]`;

async function deleteSeededTrackGraph(db) {
  const artistEmails = sqlArray(ARTIST_EMAILS);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    )
    DELETE FROM listening_history
    WHERE track_id IN (SELECT id FROM seeded_tracks)
       OR user_id IN (
         SELECT id FROM users
         WHERE role = 'listener'
           AND email LIKE '%@example.com'
       );
  `);

  await db.runSql(`
    WITH seeded_comments AS (
      SELECT comment.id
      FROM comments comment
      JOIN tracks track ON track.id = comment.track_id
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    )
    DELETE FROM comment_likes
    WHERE comment_id IN (SELECT id FROM seeded_comments);
  `);

  await db.runSql(`
    DELETE FROM comments
    WHERE track_id IN (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    );
  `);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    )
    DELETE FROM track_likes WHERE track_id IN (SELECT id FROM seeded_tracks);
  `);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    )
    DELETE FROM track_reposts WHERE track_id IN (SELECT id FROM seeded_tracks);
  `);

  await db.runSql(`
    WITH seeded_playlists AS (
      SELECT id
      FROM playlists
      WHERE (
          name = 'Rythmify Mix'
          OR name LIKE '% - Rythmify Seed'
          OR subtype = 'album'
        )
        AND deleted_at IS NULL
    )
    DELETE FROM playlist_likes
    WHERE playlist_id IN (SELECT id FROM seeded_playlists);
  `);

  await db.runSql(`
    WITH seeded_playlists AS (
      SELECT id
      FROM playlists
      WHERE (
          name = 'Rythmify Mix'
          OR name LIKE '% - Rythmify Seed'
          OR subtype = 'album'
        )
        AND deleted_at IS NULL
    )
    DELETE FROM playlist_reposts
    WHERE playlist_id IN (SELECT id FROM seeded_playlists);
  `);

  await db.runSql(`
    DELETE FROM playlist_tracks
    WHERE playlist_id IN (
      SELECT id
      FROM playlists
      WHERE name = 'Rythmify Mix'
         OR name LIKE '% - Rythmify Seed'
         OR subtype = 'album'
    )
    OR track_id IN (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    );
  `);

  await db.runSql(`
    DELETE FROM playlists
    WHERE name = 'Rythmify Mix'
       OR name LIKE '% - Rythmify Seed'
       OR subtype = 'album';
  `);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    )
    DELETE FROM track_tags WHERE track_id IN (SELECT id FROM seeded_tracks);
  `);

  await db.runSql(`
    WITH seeded_tracks AS (
      SELECT track.id
      FROM tracks track
      JOIN users artist ON artist.id = track.user_id
      WHERE artist.email = ANY (${artistEmails})
        AND artist.role = 'artist'
    )
    DELETE FROM track_artists WHERE track_id IN (SELECT id FROM seeded_tracks);
  `);

  await db.runSql(`
    DELETE FROM tracks track
    USING users artist
    WHERE artist.id = track.user_id
      AND artist.email = ANY (${artistEmails})
      AND artist.role = 'artist';
  `);
}

async function reseedStaticTracks(db) {
  await require('./20260426000007-seed-tracks').up(db);
  await require('./20260426000008-seed-track-tags').up(db);
  await require('./20260426000009-seed-albums').up(db);
  await require('./20260426000010-seed-playlists').up(db);
  await require('./20260426000011-seed-interactions').up(db);
  await require('./20260426000012-seed-listening-history').up(db);
  await require('./20260426000013-seed-extra-tracks').up(db);
  await require('./20260426000015-seed-artist-playlists').up(db);
  await require('./20260426000016-fill-artist-playlist-tracks').up(db);
}

exports.up = async function (db) {
  await deleteSeededTrackGraph(db);
  await reseedStaticTracks(db);
};

exports.down = async function () {};

exports._meta = { version: 1 };
