// ============================================================
// models/track.model.js — PostgreSQL queries for Tracks
// Entity attributes: Track_ID, User_Id, File_url, Song_Picture_url, Album, Genre, Description, Duration, Status, Play_Counts, Like_count, Is_trending, Release_Date, Created_at, Updated_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

/* Inserts a new track row with upload metadata, privacy settings, and publishing options. */
const createTrack = async (t) => {
  const query = `
    INSERT INTO tracks (
      title, description, genre_id, cover_image, waveform_url, audio_url, stream_url, preview_url,
      duration, file_size, bitrate, status, is_public, secret_token, user_id,
      release_date, isrc, p_line, buy_link, record_label, publisher,
      explicit_content, license_type,
      enable_downloads, enable_offline_listening, include_in_rss_feed, display_embed_code, enable_app_playback,
      allow_comments, show_comments_public, show_insights_public, geo_restriction_type, geo_regions
    )
    VALUES (
      $1,$2,$3,$4,NULL,$5,NULL,NULL,
      NULL,$6,NULL,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,
      $17,$18,
      $19,$20,$21,$22,$23,
      $24,$25,$26,$27,$28
    )
    RETURNING *;
  `;

  const values = [
    t.title,
    t.description,
    t.genre_id,
    t.cover_image,
    t.audio_url,
    t.file_size,
    t.status,
    t.is_public,
    t.secret_token,
    t.user_id,
    t.release_date,
    t.isrc,
    t.p_line,
    t.buy_link,
    t.record_label,
    t.publisher,
    t.explicit_content,
    t.license_type,
    t.enable_downloads,
    t.enable_offline_listening,
    t.include_in_rss_feed,
    t.display_embed_code,
    t.enable_app_playback,
    t.allow_comments,
    t.show_comments_public,
    t.show_insights_public,
    t.geo_restriction_type,
    JSON.stringify(t.geo_regions || []),
  ];

  const result = await db.query(query, values);
  return result.rows[0];
};

/* Attaches existing tag IDs to a track while ignoring duplicate associations. */
const addTrackTags = async (trackId, tagIds) => {
  for (const tagId of tagIds) {
    await db.query(
      `INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [trackId, tagId]
    );
  }
};

/* Creates ordered artist associations for a track and preserves existing rows on conflict. */
const addTrackArtists = async (trackId, artistIds) => {
  for (let i = 0; i < artistIds.length; i++) {
    await db.query(
      `INSERT INTO track_artists (track_id, artist_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [trackId, artistIds[i], i + 1]
    );
  }
};

/* Resolves a genre name to its database ID for track create and update flows. */
const getGenreIdByName = async (genreName) => {
  if (!genreName) return null;

  const result = await db.query(`SELECT id FROM genres WHERE LOWER(name) = LOWER($1) LIMIT 1`, [
    genreName,
  ]);

  return result.rows[0]?.id || null;
};

/* Returns tag IDs for a track in creation order when callers need raw join-table values. */
const getTagIdsByTrackId = async (trackId) => {
  const result = await db.query(
    `SELECT tag_id FROM track_tags WHERE track_id = $1 ORDER BY created_at ASC`,
    [trackId]
  );

  return result.rows.map((row) => row.tag_id);
};

/* Finds existing tags by normalized name and creates any missing tags before returning all IDs. */
const findOrCreateTagsByNames = async (tagNames) => {
  if (!tagNames || !tagNames.length) {
    return [];
  }

  const normalizedNames = [...new Set(tagNames.map((name) => String(name).trim().toLowerCase()))];

  const existingResult = await db.query(
    `
      SELECT id, LOWER(name::text) AS name
      FROM tags
      WHERE LOWER(name::text) = ANY($1::text[])
    `,
    [normalizedNames]
  );

  const existingByName = new Map(existingResult.rows.map((row) => [row.name, row.id]));
  const missingNames = normalizedNames.filter((name) => !existingByName.has(name));

  for (const name of missingNames) {
    await db.query(
      `
        INSERT INTO tags (name)
        SELECT $1::text
        WHERE NOT EXISTS (
          SELECT 1
          FROM tags
          WHERE LOWER(name::text) = $1::text
        )
      `,
      [name]
    );
  }

  const finalResult = await db.query(
    `
      SELECT id, LOWER(name::text) AS name
      FROM tags
      WHERE LOWER(name::text) = ANY($1::text[])
    `,
    [normalizedNames]
  );

  return finalResult.rows;
};

/* Fetches one non-deleted track with genre, stats, privacy fields, and aggregated tags. */
const findTrackByIdWithDetails = async (trackId) => {
  const query = `
    SELECT
      t.id,
      t.title,
      t.description,
      g.name AS genre,
      u.display_name AS artist_name,
      t.cover_image,
      t.waveform_url,
      t.audio_url,
      t.stream_url,
      t.preview_url,
      t.duration,
      t.file_size,
      t.bitrate,
      t.status,
      t.is_public,
      t.secret_token,
      t.is_trending,
      t.is_featured,
      t.is_hidden,
      t.user_id,
      t.release_date,
      t.isrc,
      t.p_line,
      t.buy_link,
      t.record_label,
      t.publisher,
      t.explicit_content,
      t.license_type,
      t.enable_downloads,
      t.enable_offline_listening,
      t.include_in_rss_feed,
      t.display_embed_code,
      t.enable_app_playback,
      t.allow_comments,
      t.show_comments_public,
      t.show_insights_public,
      t.geo_restriction_type,
      t.geo_regions,
      t.play_count,
      t.like_count,
      t.comment_count,
      t.repost_count,
      t.created_at,
      t.updated_at,
      COALESCE(tag_data.tags, ARRAY[]::text[]) AS tags
    FROM tracks t
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    LEFT JOIN LATERAL (
      SELECT array_agg(tag.id::text ORDER BY tag.id::text) AS tags
      FROM track_tags tt
      JOIN tags tag
        ON tag.id = tt.tag_id
      WHERE tt.track_id = t.id
    ) tag_data ON true
    WHERE t.id = $1
      AND t.deleted_at IS NULL
    LIMIT 1
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

/* Updates public/private state and stored share token for a non-deleted track. */
const updateTrackVisibility = async (trackId, isPublic, secretToken) => {
  const query = `
    UPDATE tracks
    SET
      is_public = $2,
      secret_token = $3,
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, is_public
  `;

  const { rows } = await db.query(query, [trackId, isPublic, secretToken]);
  return rows[0] || null;
};

/* Returns up to five top fans for a track using deterministic leaderboard ordering. */
const findTrackFanLeaderboard = async (trackId, period = 'overall') => {
  const periodFilter =
    period === 'last_7_days' ? `AND lh.played_at >= NOW() - INTERVAL '7 days'` : '';

  const query = `
    WITH aggregated_fans AS (
      SELECT
        lh.user_id,
        COUNT(*)::int AS play_count,
        MIN(lh.played_at) AS first_played_at,
        MAX(lh.played_at) AS last_played_at
      FROM listening_history lh
      JOIN users fan
        ON fan.id = lh.user_id
       AND fan.deleted_at IS NULL
      WHERE lh.track_id = $1
        ${periodFilter}
      GROUP BY lh.user_id
    )
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.profile_picture,
      u.is_verified,
      aggregated_fans.play_count,
      aggregated_fans.last_played_at
    FROM aggregated_fans
    JOIN users u
      ON u.id = aggregated_fans.user_id
    ORDER BY
      aggregated_fans.play_count DESC,
      aggregated_fans.first_played_at ASC,
      aggregated_fans.user_id ASC
    LIMIT 5
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows;
};

/* Fetches a paginated owner track list plus a matching total count using the same filters. */
const findMyTracks = async (userId, { limit, offset, status = null }) => {
  const filters = ['t.user_id = $1', 't.deleted_at IS NULL'];
  const values = [userId];
  let nextParam = 2;

  if (status) {
    filters.push(`t.status = $${nextParam}`);
    values.push(status);
    nextParam += 1;
  }

  const whereClause = filters.join(' AND ');

  const itemsQuery = `
    SELECT
      t.id,
      t.title,
      t.description,
      g.name AS genre,
      u.display_name AS artist_name,
      t.cover_image,
      t.waveform_url,
      t.audio_url,
      t.stream_url,
      t.preview_url,
      t.duration,
      t.file_size,
      t.bitrate,
      t.status,
      t.is_public,
      t.is_trending,
      t.is_featured,
      t.is_hidden,
      t.user_id,
      t.release_date,
      t.isrc,
      t.p_line,
      t.buy_link,
      t.record_label,
      t.publisher,
      t.explicit_content,
      t.license_type,
      t.enable_downloads,
      t.enable_offline_listening,
      t.include_in_rss_feed,
      t.display_embed_code,
      t.enable_app_playback,
      t.allow_comments,
      t.show_comments_public,
      t.show_insights_public,
      t.geo_restriction_type,
      t.geo_regions,
      t.play_count,
      t.like_count,
      t.comment_count,
      t.repost_count,
      t.created_at,
      t.updated_at,
      COALESCE(tag_data.tags, ARRAY[]::uuid[]) AS tags
    FROM tracks t
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    LEFT JOIN LATERAL (
      SELECT array_agg(tt.tag_id ORDER BY tt.tag_id) AS tags
      FROM track_tags tt
      WHERE tt.track_id = t.id
    ) tag_data ON true
    WHERE ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${nextParam} OFFSET $${nextParam + 1}
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM tracks t
    WHERE ${whereClause}
  `;

  const itemsValues = [...values, limit, offset];

  const [itemsResult, countResult] = await Promise.all([
    db.query(itemsQuery, itemsValues),
    db.query(countQuery, values),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0].total,
  };
};

// Fetch a lightweight public track listing for a specific user.
// Only returns non-deleted, public, non-hidden, ready tracks ordered newest first.
// Returns { items, total } so the users service can build the response meta block.
const findPublicTracksByUserId = async (userId, { limit, offset }) => {
  const whereClause = `
    t.user_id = $1
    AND t.deleted_at IS NULL
    AND t.is_public = true
    AND t.is_hidden = false
    AND t.status = 'ready'
  `;

  const itemsQuery = `
    SELECT
      t.id,
      t.title,
      g.name AS genre,
      u.display_name AS artist_name,
      t.duration,
      t.cover_image,
      t.user_id,
      t.play_count,
      t.like_count,
      t.stream_url
    FROM tracks t
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    WHERE ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  // Keep the count query aligned with the item filters so pagination totals match the returned page.
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM tracks t
    WHERE ${whereClause}
  `;

  const [itemsResult, countResult] = await Promise.all([
    db.query(itemsQuery, [userId, limit, offset]),
    db.query(countQuery, [userId]),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0].total,
  };
};

/* Marks a track as soft-deleted while preserving the row for future auditing or recovery. */
const softDeleteTrack = async (trackId) => {
  const query = `
    UPDATE tracks
    SET
      deleted_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

/* Permanently removes a non-deleted track row and returns its ID when deletion succeeds. */
const deleteTrackPermanently = async (trackId) => {
  const query = `
    DELETE FROM tracks
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

/* Updates only whitelisted mutable track fields and returns the modified row. */
const updateTrackFields = async (trackId, updates) => {
  const allowedFields = [
    'title',
    'description',
    'genre_id',
    'cover_image',
    'buy_link',
    'record_label',
    'publisher',
    'release_date',
    'isrc',
    'p_line',
    'license_type',
    'explicit_content',
    'enable_downloads',
    'enable_offline_listening',
    'include_in_rss_feed',
    'display_embed_code',
    'enable_app_playback',
    'allow_comments',
    'show_comments_public',
    'show_insights_public',
    'geo_restriction_type',
    'geo_regions',
  ];

  const entries = Object.entries(updates).filter(
    ([key, value]) => allowedFields.includes(key) && value !== undefined
  );

  if (!entries.length) return null;

  // Serialize geo_regions explicitly so partial metadata updates preserve the JSON column format.
  const setClauses = entries.map(([key], index) => `"${key}" = $${index + 2}`);
  const values = [
    trackId,
    ...entries.map(([key, value]) => (key === 'geo_regions' ? JSON.stringify(value) : value)),
  ];

  const query = `
    UPDATE tracks
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *;
  `;

  const { rows } = await db.query(query, values);
  return rows[0] || null;
};

/* Replaces all tag associations for a track with a new normalized set of tag IDs. */
const replaceTrackTags = async (trackId, tagIds) => {
  await db.query(`DELETE FROM track_tags WHERE track_id = $1`, [trackId]);

  if (!tagIds || !tagIds.length) {
    return;
  }

  for (const tagId of tagIds) {
    await db.query(
      `INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [trackId, tagId]
    );
  }
};

/* Stores generated processing assets and transitions the track into the ready state. */
const updateTrackProcessingAssets = async (
  trackId,
  { duration, bitrate, streamUrl, previewUrl, waveformUrl }
) => {
  const query = `
    UPDATE tracks
    SET
      duration = $2,
      bitrate = $3,
      stream_url = $4,
      preview_url = $5,
      waveform_url = $6,
      status = 'ready',
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, status, duration, bitrate, stream_url, preview_url, waveform_url
  `;

  const { rows } = await db.query(query, [
    trackId,
    duration,
    bitrate,
    streamUrl,
    previewUrl,
    waveformUrl,
  ]);

  return rows[0] || null;
};

/* Marks a track as failed when any background processing step cannot complete. */
const markTrackProcessingFailed = async (trackId) => {
  const query = `
    UPDATE tracks
    SET
      status = 'failed',
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, status
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

module.exports = {
  createTrack,
  addTrackTags,
  addTrackArtists,
  getGenreIdByName,
  getTagIdsByTrackId,
  findOrCreateTagsByNames,
  findTrackByIdWithDetails,
  findTrackFanLeaderboard,
  updateTrackVisibility,
  findMyTracks,
  findPublicTracksByUserId,
  softDeleteTrack,
  deleteTrackPermanently,
  updateTrackFields,
  replaceTrackTags,
  updateTrackProcessingAssets,
  markTrackProcessingFailed,
};
