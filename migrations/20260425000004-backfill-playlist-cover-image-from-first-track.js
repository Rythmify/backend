'use strict';

let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // 1) Backfill/sync non-custom covers to the first non-deleted track cover.
  await db.runSql(`
    WITH first_track AS (
      SELECT
        pt.playlist_id,
        t.cover_image,
        ROW_NUMBER() OVER (PARTITION BY pt.playlist_id ORDER BY pt.position ASC) AS rn
      FROM playlist_tracks pt
      JOIN tracks t
        ON t.id = pt.track_id
       AND t.deleted_at IS NULL
    )
    UPDATE playlists p
    SET
      cover_image = ft.cover_image,
      updated_at = NOW()
    FROM first_track ft
    WHERE p.id = ft.playlist_id
      AND ft.rn = 1
      AND p.deleted_at IS NULL
      AND (
        p.cover_image IS NULL
        OR (
          p.cover_image NOT LIKE '%' || '/playlists/' || p.id::text || '/cover.%'
          AND p.cover_image IS DISTINCT FROM ft.cover_image
        )
      );
  `);

  // 2) If a playlist has no active tracks, clear non-custom generated cover.
  await db.runSql(`
    UPDATE playlists p
    SET
      cover_image = NULL,
      updated_at = NOW()
    WHERE p.deleted_at IS NULL
      AND p.cover_image IS NOT NULL
      AND p.cover_image NOT LIKE '%' || '/playlists/' || p.id::text || '/cover.%'
      AND NOT EXISTS (
        SELECT 1
        FROM playlist_tracks pt
        JOIN tracks t
          ON t.id = pt.track_id
         AND t.deleted_at IS NULL
        WHERE pt.playlist_id = p.id
      );
  `);
};

exports.down = async function () {
  // Irreversible data migration: previous cover_image values cannot be reconstructed.
};

exports._meta = {
  version: 1,
};
