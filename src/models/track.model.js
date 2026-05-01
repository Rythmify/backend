// ============================================================
// models/track.model.js — PostgreSQL queries for Tracks
// Entity attributes: Track_ID, User_Id, File_url, Song_Picture_url, Album, Genre, Description, Duration, Status, Play_Counts, Like_count, Is_trending, Release_Date, Created_at, Updated_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');
const { buildTrackPersonalizationSelect } = require('./track-personalization');

const DISCOVERY_TRACK_SELECT = `
  t.id,
  t.title,
  t.cover_image,
  t.duration,
  t.play_count,
  t.like_count,
  t.user_id,
  t.stream_url,
  t.geo_restriction_type,
  t.geo_regions,
  t.created_at,
  g.name  AS genre_name,
  u.display_name AS artist_name
`;

const PLAYABLE_TRACK_FILTER = `
  NULLIF(BTRIM(t.title), '') IS NOT NULL
  AND t.title <> 'tracks'
  AND (t.cover_image IS NULL OR t.cover_image <> 'pending')
  AND t.audio_url IS NOT NULL
  AND t.audio_url <> 'pending'
  AND t.stream_url IS NOT NULL
  AND t.stream_url <> 'pending'
`;

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

/* Fetches one non-deleted track with genre, stats, privacy fields, aggregated tags, and viewer flags. */
const findTrackByIdWithDetails = async (trackId, requesterUserId = null) => {
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
      ${buildTrackPersonalizationSelect({
        requesterUserIdParam: '$2',
        trackAlias: 't',
      })},
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
      AND ${PLAYABLE_TRACK_FILTER}
    LIMIT 1
  `;

  const { rows } = await db.query(query, [trackId, requesterUserId]);
  return rows[0] || null;
};

/* Fetches one non-deleted track for owner-only mutations, including pending media rows. */
const findTrackByIdForMutation = async (trackId) => {
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
      t.user_id,
      t.explicit_content,
      t.created_at,
      t.updated_at
    FROM tracks t
    LEFT JOIN genres g
      ON g.id = t.genre_id
    LEFT JOIN users u
      ON u.id = t.user_id
    WHERE t.id = $1
      AND t.deleted_at IS NULL
    LIMIT 1
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
};

/* Fetches the full mutation response shape without requiring generated processing assets. */
const findTrackByIdForMutationDetails = async (trackId) => {
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

/* Returns the current source audio URL used to detect stale processing jobs. */
const findTrackAudioForProcessing = async (trackId) => {
  const query = `
    SELECT id, audio_url, status
    FROM tracks
    WHERE id = $1
      AND deleted_at IS NULL
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

/* Updates admin moderation hidden state for a non-deleted track. */
const updateTrackHiddenStatus = async (trackId, isHidden) => {
  const query = `
    UPDATE tracks
    SET
      is_hidden = $2,
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING
      id,
      title,
      user_id,
      is_hidden,
      deleted_at,
      updated_at;
  `;

  const { rows } = await db.query(query, [trackId, isHidden]);
  return rows[0] || null;
};

/* Returns up to five top fans for a track using deterministic ordering and an optional release-week window. */
const findTrackFanLeaderboard = async (trackId, period = 'overall') => {
  const periodFilter =
    period === 'first_7_days'
      ? `
        AND lh.played_at AT TIME ZONE 'UTC' >= track_window.window_start
        AND lh.played_at AT TIME ZONE 'UTC' < track_window.window_start + INTERVAL '7 days'
      `
      : '';

  const query = `
    WITH track_window AS (
      SELECT
        t.id,
        COALESCE(t.release_date::timestamp, t.created_at AT TIME ZONE 'UTC') AS window_start
      FROM tracks t
      WHERE t.id = $1
        AND t.deleted_at IS NULL
    ),
    aggregated_fans AS (
      SELECT
        lh.user_id,
        COUNT(*)::int AS play_count,
        MIN(lh.played_at) AS first_played_at,
        MAX(lh.played_at) AS last_played_at
      FROM listening_history lh
      JOIN track_window
        ON track_window.id = lh.track_id
      JOIN users fan
        ON fan.id = lh.user_id
       AND fan.deleted_at IS NULL
      LEFT JOIN user_privacy_settings fan_privacy
        ON fan_privacy.user_id = fan.id
      WHERE lh.track_id = $1
        -- Soft-deleted listening_history rows still count here because clearing user history should not erase track analytics.
        AND COALESCE(fan_privacy.show_as_top_fan, true) = true
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

/* Returns whether the owner allows fan leaderboards for this track, defaulting missing settings to visible. */
const findTrackFanLeaderboardVisibility = async (trackId) => {
  const query = `
    SELECT
      COALESCE(owner_privacy.show_top_fans_on_tracks, true) AS show_top_fans_on_tracks
    FROM tracks t
    LEFT JOIN user_privacy_settings owner_privacy
      ON owner_privacy.user_id = t.user_id
    WHERE t.id = $1
      AND t.deleted_at IS NULL
    LIMIT 1
  `;

  const { rows } = await db.query(query, [trackId]);
  return rows[0] || null;
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
      ${buildTrackPersonalizationSelect({
        requesterUserIdParam: '$1',
        trackAlias: 't',
        includeIsRepostedByMe: false,
        includeIsArtistFollowedByMe: false,
      })},
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
    AND ${PLAYABLE_TRACK_FILTER}
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
      t.comment_count,
      t.repost_count,
      t.stream_url,
      t.geo_restriction_type,
      t.geo_regions
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

/* Marks an owned track as soft-deleted while preserving the row and related data. */
const softDeleteTrack = async (trackId, userId) => {
  const query = `
    UPDATE tracks
    SET
      deleted_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    RETURNING id
  `;

  const { rows } = await db.query(query, [trackId, userId]);
  return rows[0] || null;
};

/* Counts non-deleted tracks uploaded during the database server's current day. */
const getTracksUploadedToday = async () => {
  const query = `
    SELECT COUNT(*)::int AS count
    FROM tracks
    WHERE created_at >= date_trunc('day', NOW())
      AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'
      AND deleted_at IS NULL;
  `;

  const { rows } = await db.query(query);
  return rows[0]?.count || 0;
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

/* Replaces the original uploaded audio for an existing track before running processing again. */
const replaceTrackAudio = async (trackId, { audioUrl, fileSize }) => {
  const query = `
    UPDATE tracks
    SET
      audio_url = $2,
      stream_url = NULL,
      preview_url = NULL,
      waveform_url = NULL,
      file_size = $3,
      duration = NULL,
      bitrate = NULL,
      status = 'processing',
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, user_id, audio_url, status
  `;

  const { rows } = await db.query(query, [trackId, audioUrl, fileSize]);
  return rows[0] || null;
};

const updateTrackSourceAudio = replaceTrackAudio;

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
  { duration, bitrate, streamUrl, previewUrl, waveformUrl, expectedAudioUrl = null }
) => {
  const audioGuard = expectedAudioUrl ? 'AND audio_url = $7' : '';
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
      ${audioGuard}
    RETURNING id, status, duration, bitrate, stream_url, preview_url, waveform_url
  `;

  const values = [trackId, duration, bitrate, streamUrl, previewUrl, waveformUrl];

  if (expectedAudioUrl) {
    values.push(expectedAudioUrl);
  }

  const { rows } = await db.query(query, values);

  return rows[0] || null;
};

/* Marks a track as failed when any background processing step cannot complete. */
const markTrackProcessingFailed = async (trackId, expectedAudioUrl = null) => {
  const audioGuard = expectedAudioUrl ? 'AND audio_url = $2' : '';
  const query = `
    UPDATE tracks
    SET
      status = 'failed',
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
      ${audioGuard}
    RETURNING id, status
  `;

  const values = expectedAudioUrl ? [trackId, expectedAudioUrl] : [trackId];
  const { rows } = await db.query(query, values);
  return rows[0] || null;
};

// Find the genre and owner of the reference track (for filtering related tracks)
const findTrackMeta = async (trackId) => {
  const { rows } = await db.query(
    `SELECT t.id, t.title, t.cover_image, t.duration, t.play_count, t.like_count,
            t.user_id, t.stream_url, t.geo_restriction_type, t.geo_regions, t.created_at, t.genre_id,
            g.name  AS genre_name,
            u.display_name AS artist_name
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.id          = $1
       AND  t.is_public   = true
       AND  t.is_hidden   = false
       AND  t.status      = 'ready'
       AND  t.deleted_at  IS NULL`,
    [trackId]
  );
  return rows[0] || null;
};

// half the tracks from same artist, half from same genre (excluding same artist)
const findRelatedTracks = async ({ trackId, userId, genreId, limit, offset }) => {
  const halfLimit = Math.floor(limit / 2);

  // same-artist tracks (excluding the reference track itself)
  const sameArtist = await db.query(
    `SELECT ${DISCOVERY_TRACK_SELECT}
     FROM   tracks t
     LEFT JOIN genres g ON g.id = t.genre_id
     LEFT JOIN users  u ON u.id = t.user_id
     WHERE  t.user_id    = $1
       AND  t.id        <> $2
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL
     ORDER BY t.play_count DESC, t.created_at DESC
     LIMIT  $3`,
    [userId, trackId, halfLimit]
  );

  // same-genre tracks by OTHER artists (excluding reference track)
  const sameGenre = genreId
    ? await db.query(
        `SELECT ${DISCOVERY_TRACK_SELECT}
         FROM   tracks t
         LEFT JOIN genres g ON g.id = t.genre_id
         LEFT JOIN users  u ON u.id = t.user_id
         WHERE  t.genre_id   = $1
           AND  t.user_id   <> $2
           AND  t.id        <> $3
           AND  t.is_public  = true
           AND  t.is_hidden  = false
           AND  t.status     = 'ready'
           AND  t.deleted_at IS NULL
         ORDER BY t.play_count DESC, t.created_at DESC
         LIMIT  $4
         OFFSET $5`,
        [genreId, userId, trackId, limit - sameArtist.rows.length, offset]
      )
    : { rows: [] };

  const combined = [...sameArtist.rows, ...sameGenre.rows];

  // total count for meta (approximate — combined without deduplication)
  const totalQuery = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM tracks
        WHERE user_id = $1 AND id <> $2
          AND is_public = true AND is_hidden = false
          AND status = 'ready' AND deleted_at IS NULL) +
       (SELECT COUNT(*) FROM tracks
        WHERE genre_id = $3 AND user_id <> $1 AND id <> $2
          AND is_public = true AND is_hidden = false
          AND status = 'ready' AND deleted_at IS NULL) AS total`,
    [userId, trackId, genreId]
  );

  return {
    tracks: combined,
    total: parseInt(totalQuery.rows[0]?.total || 0, 10),
  };
};

module.exports = {
  createTrack,
  addTrackTags,
  addTrackArtists,
  getGenreIdByName,
  getTagIdsByTrackId,
  findOrCreateTagsByNames,
  findTrackByIdWithDetails,
  findTrackByIdForMutation,
  findTrackByIdForMutationDetails,
  findTrackAudioForProcessing,
  findTrackFanLeaderboard,
  findTrackFanLeaderboardVisibility,
  updateTrackVisibility,
  updateTrackHiddenStatus,
  findMyTracks,
  findPublicTracksByUserId,
  softDeleteTrack,
  getTracksUploadedToday,
  deleteTrackPermanently,
  updateTrackFields,
  replaceTrackAudio,
  updateTrackSourceAudio,
  replaceTrackTags,
  updateTrackProcessingAssets,
  markTrackProcessingFailed,
  findTrackMeta,
  findRelatedTracks,
};
