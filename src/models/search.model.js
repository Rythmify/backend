const db = require('../config/db');

const SUGGESTION_THRESHOLD = 0.2;

const PLAYABLE_TRACK_FILTER = `
  NULLIF(BTRIM(t.title), '') IS NOT NULL
  AND t.title <> 'tracks'
  AND t.cover_image IS NOT NULL
  AND t.cover_image <> 'pending'
  AND t.audio_url IS NOT NULL
  AND t.audio_url <> 'pending'
  AND t.stream_url IS NOT NULL
  AND t.stream_url <> 'pending'
`;

// ─── Preset filter maps ────────────────────────────────────────────────────

// time_range → SQL interval applied to t.created_at
const TIME_RANGE_MAP = {
  past_hour: "t.created_at >= NOW() - INTERVAL '1 hour'",
  past_day: "t.created_at >= NOW() - INTERVAL '1 day'",
  past_week: "t.created_at >= NOW() - INTERVAL '1 week'",
  past_month: "t.created_at >= NOW() - INTERVAL '1 month'",
  past_year: "t.created_at >= NOW() - INTERVAL '1 year'",
};

// duration → SQL range applied to t.duration (stored in seconds)
const DURATION_MAP = {
  short: 't.duration < 120', // < 2 min
  medium: 't.duration BETWEEN 120 AND 600', // 2–10 min
  long: 't.duration BETWEEN 600 AND 1800', // 10–30 min
  extra: 't.duration > 1800', // > 30 min
};

// ─── Tracks ────────────────────────────────────────────────────────────────

async function searchTracks({ q, sort, limit, offset, threshold, time_range, duration, tag }) {
  let orderBy;
  if (sort === 'plays') orderBy = 'play_count DESC, score DESC';
  else if (sort === 'newest') orderBy = 't.created_at DESC, score DESC';
  else orderBy = 'score DESC';

  // Build optional filter clauses — these are injected into the CTE's WHERE
  const extraClauses = [];
  if (time_range && TIME_RANGE_MAP[time_range]) extraClauses.push(TIME_RANGE_MAP[time_range]);
  if (duration && DURATION_MAP[duration]) extraClauses.push(DURATION_MAP[duration]);

  const extraWhere = extraClauses.length ? 'AND ' + extraClauses.join(' AND ') : '';

  // Tag filter — join against track_tags/tags only when a tag is requested.
  // We use EXISTS so it doesn't multiply rows.
  const tagJoin = tag
    ? `AND EXISTS (
         SELECT 1 FROM track_tags tt
         JOIN tags tg ON tg.id = tt.tag_id
         WHERE tt.track_id = t.id AND LOWER(tg.name) = LOWER($5)
       )`
    : '';

  const params = [q, threshold, limit, offset];
  if (tag) params.push(tag); // $5

  const query = `
    WITH ranked AS (
      SELECT
        t.id,
        t.title,
        t.cover_image,
        t.user_id,
        u.display_name                                    AS artist_name,
        u.username                                        AS artist_username,
        g.name                                            AS genre_name,
        t.duration,
        t.play_count,
        t.like_count,
        t.repost_count,
        t.stream_url,
        t.created_at,

        LEAST(
          0.5 * ts_rank(t.search_vector, plainto_tsquery('english', $1))
          + 0.3 * GREATEST(
              similarity(t.title,       $1),
              similarity(COALESCE(t.description, ''), $1)
            )
          + 0.2 * GREATEST(
              similarity(u.display_name, $1),
              similarity(u.username, $1)
            ),
          1.0
        ) AS score,

        GREATEST(
          similarity(t.title, $1),
          similarity(COALESCE(t.description, ''), $1),
          similarity(u.display_name, $1),
          similarity(u.username, $1)
        ) AS trgm_sim,

        (t.search_vector @@ plainto_tsquery('english', $1)) AS ts_matched

      FROM tracks t
      JOIN users       u ON u.id = t.user_id
      LEFT JOIN genres g ON g.id = t.genre_id

      WHERE
        t.deleted_at IS NULL
        AND t.is_public  = true
        AND t.is_hidden  = false
        AND t.status     = 'ready'
        AND ${PLAYABLE_TRACK_FILTER}
        ${extraWhere}
        ${tagJoin}
    )
    SELECT
      *,
      COUNT(*) OVER() AS total_count
    FROM ranked
    WHERE (ts_matched = true AND score >= 0.1) OR trgm_sim >= $2
    ORDER BY ${orderBy}
    LIMIT  $3
    OFFSET $4
  `;

  const { rows } = await db.query(query, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  return { rows, total };
}

// Returns all distinct tags that appear on tracks matching the search query.
// Called in parallel with searchTracks so there's no serial overhead.
async function getTrackSearchTags({ q, threshold }) {
  const query = `
    SELECT DISTINCT tg.name AS tag
    FROM tracks t
    JOIN users u       ON u.id = t.user_id
    JOIN track_tags tt ON tt.track_id = t.id
    JOIN tags tg       ON tg.id = tt.tag_id
    WHERE
      t.deleted_at IS NULL
      AND t.is_public  = true
      AND t.is_hidden  = false
      AND t.status     = 'ready'
      AND ${PLAYABLE_TRACK_FILTER}
      AND (
        (t.search_vector @@ plainto_tsquery('english', $1))
        OR GREATEST(
             similarity(t.title, $1),
             similarity(COALESCE(t.description, ''), $1),
             similarity(u.display_name, $1),
             similarity(u.username, $1)
           ) >= $2
      )
    ORDER BY tg.name ASC
  `;
  const { rows } = await db.query(query, [q, threshold]);
  return rows.map((r) => r.tag);
}

// ─── Users ─────────────────────────────────────────────────────────────────

async function searchUsers({ q, sort, limit, offset, threshold, currentUserId, location }) {
  let orderBy;
  if (sort === 'newest') orderBy = 'u.created_at DESC, score DESC';
  else orderBy = 'score DESC';

  // location filter — match on city OR country code (case-insensitive)
  const locationClause = location
    ? `AND (LOWER(u.city) = LOWER($5) OR LOWER(u.country) = LOWER($5))`
    : '';

  const params = [q, threshold, limit, offset];
  if (location) params.push(location); // $5

  const query = `
    WITH ranked AS (
      SELECT
        u.id,
        u.display_name,
        u.profile_picture,
        u.followers_count,
        u.city,
        u.country,
        u.created_at,

        LEAST(
          0.4 * ts_rank(u.search_vector, plainto_tsquery('english', $1), 1)
          + 0.6 * GREATEST(
              similarity(u.display_name,           $1),
              similarity(COALESCE(u.username, ''), $1)
            ),
          1.0
        ) AS score,

        GREATEST(
          similarity(u.display_name,           $1),
          similarity(COALESCE(u.username, ''), $1)
        ) AS trgm_sim,

        (u.search_vector @@ plainto_tsquery('english', $1)) AS ts_matched

      FROM users u
      WHERE
        u.deleted_at    IS NULL
        AND u.is_suspended = false
        ${locationClause}
    )
    SELECT
      *,
      COUNT(*) OVER() AS total_count
    FROM ranked
    WHERE (ts_matched = true AND score >= 0.1) OR trgm_sim >= $2
    ORDER BY ${orderBy}
    LIMIT  $3
    OFFSET $4
  `;

  const { rows } = await db.query(query, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  // Follow status enrichment (unchanged from original)
  let rowsWithFollowStatus;
  if (currentUserId && rows.length > 0) {
    const userIds = rows.map((r) => r.id);
    const { rows: followRows } = await db.query(
      `SELECT following_id FROM follows
       WHERE follower_id = $1 AND following_id = ANY($2::uuid[])`,
      [currentUserId, userIds]
    );
    const followedSet = new Set(followRows.map((f) => f.following_id));
    rowsWithFollowStatus = rows.map((user) => ({
      ...user,
      is_following: followedSet.has(user.id),
    }));
  } else {
    rowsWithFollowStatus = rows.map((user) => ({ ...user, is_following: false }));
  }

  return { rows: rowsWithFollowStatus, total };
}

// Returns all distinct city/country values from users matching the query,
// formatted as { label, value } pairs for the client to populate a filter dropdown.
async function getUserSearchLocations({ q, threshold }) {
  const query = `
    SELECT
      u.city,
      u.country
    FROM users u
    WHERE
      u.deleted_at    IS NULL
      AND u.is_suspended = false
      AND (
        (u.search_vector @@ plainto_tsquery('english', $1))
        OR GREATEST(
             similarity(u.display_name,           $1),
             similarity(COALESCE(u.username, ''), $1)
           ) >= $2
      )
      AND (u.city IS NOT NULL OR u.country IS NOT NULL)
    GROUP BY u.city, u.country
    ORDER BY COUNT(*) DESC
  `;
  const { rows } = await db.query(query, [q, threshold]);

  // Build a deduplicated list: prefer city labels, fall back to country code.
  // The `value` is what the client sends back as the `location` filter param.
  const seen = new Set();
  const locations = [];
  for (const r of rows) {
    if (r.city) {
      const val = r.city;
      if (!seen.has(val)) {
        seen.add(val);
        locations.push({ label: val, value: val });
      }
    }
    if (r.country) {
      const val = r.country;
      if (!seen.has(val)) {
        seen.add(val);
        locations.push({ label: val, value: val });
      }
    }
  }
  return locations;
}

// ─── Playlists ─────────────────────────────────────────────────────────────

async function searchPlaylists({ q, sort, limit, offset, threshold, tag }) {
  return _searchPlaylistLike({
    q,
    sort,
    limit,
    offset,
    threshold,
    tag,
    subtype: 'playlist',
  });
}

// ─── Albums ────────────────────────────────────────────────────────────────

async function searchAlbums({ q, sort, limit, offset, threshold, tag }) {
  return _searchPlaylistLike({
    q,
    sort,
    limit,
    offset,
    threshold,
    tag,
    subtype: 'album',
  });
}

// Shared implementation for playlists & albums (same table, different subtype).
async function _searchPlaylistLike({ q, sort, limit, offset, threshold, tag, subtype }) {
  let orderBy;
  if (sort === 'newest') orderBy = 'p.created_at DESC, score DESC';
  else orderBy = 'score DESC';

  const tagJoin = tag
    ? `AND EXISTS (
         SELECT 1 FROM playlist_tags pt2
         JOIN tags tg ON tg.id = pt2.tag_id
         WHERE pt2.playlist_id = p.id AND LOWER(tg.name) = LOWER($5)
       )`
    : '';

  const params = [q, threshold, limit, offset];
  if (tag) params.push(tag); // $5

  const query = `
    WITH ranked AS (
      SELECT
        p.id,
        p.name,
        p.cover_image, 
        p.subtype,
        p.user_id                                         AS owner_id,
        u.display_name                                    AS owner_display_name,
        u.username                                        AS owner_username,
        p.track_count,
        p.created_at,

        LEAST(
          0.5 * ts_rank(p.search_vector, plainto_tsquery('english', $1))
          + 0.3 * GREATEST(
              similarity(p.name,                      $1),
              similarity(COALESCE(p.description, ''), $1)
            )
          + 0.2 * GREATEST(
              similarity(u.display_name, $1),
              similarity(u.username, $1)
            ),
          1.0
        ) AS score,

        GREATEST(
          similarity(p.name, $1),
          similarity(COALESCE(p.description, ''), $1),
          similarity(u.display_name, $1),
          similarity(u.username, $1)
        ) AS trgm_sim,

        (p.search_vector @@ plainto_tsquery('english', $1)) AS ts_matched

      FROM playlists p
      JOIN users u ON u.id = p.user_id

      WHERE
        p.deleted_at IS NULL
        AND p.is_public  = true
        AND p.subtype    = '${subtype}'
        ${tagJoin}
    )
    SELECT
      *,
      COUNT(*) OVER() AS total_count
    FROM ranked
    WHERE (ts_matched = true AND score >= 0.1) OR trgm_sim >= $2
    ORDER BY ${orderBy}
    LIMIT  $3
    OFFSET $4
  `;

  const { rows } = await db.query(query, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  // Preview tracks (unchanged logic, shared for both playlists & albums)
  let rowsWithTracks = rows;
  if (rows.length > 0) {
    const playlistIds = rows.map((r) => r.id);
    const tracksQuery = `
      SELECT
        playlist_id,
        track_id, title, cover_image, duration,
        play_count, stream_url, artist_name, user_id
      FROM (
        SELECT
          pt.playlist_id,
          t.id           AS track_id,
          t.title,
          t.cover_image,
          t.duration,
          t.play_count,
          t.stream_url,
          u.display_name AS artist_name,
          t.user_id,
          ROW_NUMBER() OVER (
            PARTITION BY pt.playlist_id
            ORDER BY pt.position ASC
          ) AS rn
        FROM playlist_tracks pt
        JOIN tracks t ON t.id = pt.track_id
        JOIN users  u ON u.id = t.user_id
        WHERE
          pt.playlist_id = ANY($1::uuid[])
          AND t.deleted_at IS NULL
          AND t.is_public  = true
          AND t.is_hidden  = false
          AND t.status     = 'ready'
          AND ${PLAYABLE_TRACK_FILTER}
      ) ranked
      WHERE rn <= 5
      ORDER BY playlist_id, rn ASC
    `;
    const { rows: trackRows } = await db.query(tracksQuery, [playlistIds]);

    const tracksByPlaylist = {};
    for (const tr of trackRows) {
      if (!tracksByPlaylist[tr.playlist_id]) tracksByPlaylist[tr.playlist_id] = [];
      tracksByPlaylist[tr.playlist_id].push({
        id: tr.track_id,
        title: tr.title,
        cover_image: tr.cover_image ?? null,
        duration: tr.duration ?? null,
        play_count: tr.play_count ?? null,
        stream_url: tr.stream_url ?? null,
        artist_name: tr.artist_name ?? null,
        user_id: tr.user_id,
      });
    }

    rowsWithTracks = rows.map((r) => ({
      ...r,
      preview_tracks: tracksByPlaylist[r.id] ?? [],
    }));
  }

  return { rows: rowsWithTracks, total };
}

// Returns tags for playlists or albums matching the query.
async function getPlaylistSearchTags({ q, threshold, subtype }) {
  const query = `
    SELECT DISTINCT tg.name AS tag
    FROM playlists p
    JOIN users u         ON u.id = p.user_id
    JOIN playlist_tags pt ON pt.playlist_id = p.id
    JOIN tags tg          ON tg.id = pt.tag_id
    WHERE
      p.deleted_at IS NULL
      AND p.is_public = true
      AND p.subtype   = $3
      AND (
        (p.search_vector @@ plainto_tsquery('english', $1))
        OR GREATEST(
             similarity(p.name, $1),
             similarity(COALESCE(p.description, ''), $1),
             similarity(u.display_name, $1),
             similarity(u.username, $1)
           ) >= $2
      )
    ORDER BY tg.name ASC
  `;
  const { rows } = await db.query(query, [q, threshold, subtype]);
  return rows.map((r) => r.tag);
}

async function suggestUsers(q, limit, userId) {
  if (!userId) {
    const { rows } = await db.query(
      `
      SELECT id, display_name, username, profile_picture
      FROM users
      WHERE
        deleted_at    IS NULL
        AND is_suspended = false
        AND (
          display_name ILIKE $1
          OR username  ILIKE $1
          OR similarity(display_name,           $2) >= $3
          OR similarity(COALESCE(username, ''), $2) >= $3
        )
      ORDER BY followers_count DESC
      LIMIT $4
      `,
      [`${q}%`, q, SUGGESTION_THRESHOLD, limit]
    );

    return rows.map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username ?? null,
      profile_picture: r.profile_picture ?? null,
      is_following: false,
    }));
  }

  const { rows: followedRows } = await db.query(
    `
    SELECT u.id, u.display_name, u.username, u.profile_picture
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE
      f.follower_id   = $1
      AND u.deleted_at   IS NULL
      AND u.is_suspended = false
      AND (
        u.display_name ILIKE $2
        OR u.username  ILIKE $2
        OR similarity(u.display_name,           $3) >= $4
        OR similarity(COALESCE(u.username, ''), $3) >= $4
      )
    ORDER BY u.followers_count DESC
    LIMIT $5
    `,
    [userId, `${q}%`, q, SUGGESTION_THRESHOLD, limit]
  );

  return followedRows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    username: r.username ?? null,
    profile_picture: r.profile_picture ?? null,
    is_following: true,
  }));
}

async function suggestTrackTitles(q, limit) {
  const { rows } = await db.query(
    `
    SELECT DISTINCT ON (lower(title)) title
    FROM tracks
    WHERE
      deleted_at IS NULL
      AND is_public  = true
      AND is_hidden  = false
      AND status     = 'ready'
      AND NULLIF(BTRIM(title), '') IS NOT NULL
      AND title <> 'tracks'
      AND cover_image IS NOT NULL
      AND cover_image <> 'pending'
      AND audio_url IS NOT NULL
      AND audio_url <> 'pending'
      AND stream_url IS NOT NULL
      AND stream_url <> 'pending'
      AND (
        title ILIKE $1
        OR similarity(title, $2) >= $3
      )
    ORDER BY lower(title), play_count DESC
    LIMIT $4
    `,
    [`${q}%`, q, SUGGESTION_THRESHOLD, limit]
  );

  return rows.map((r) => r.title);
}

async function suggestPlaylistNames(q, limit) {
  const { rows } = await db.query(
    `
    SELECT DISTINCT ON (lower(name)) name
    FROM playlists
    WHERE
      deleted_at IS NULL
      AND is_public  = true
      AND (
        name ILIKE $1
        OR similarity(name, $2) >= $3
      )
    ORDER BY lower(name), like_count DESC
    LIMIT $4
    `,
    [`${q}%`, q, SUGGESTION_THRESHOLD, limit]
  );

  return rows.map((r) => r.name);
}

module.exports = {
  searchTracks,
  searchUsers,
  searchPlaylists,
  searchAlbums,
  suggestUsers,
  suggestTrackTitles,
  suggestPlaylistNames,
  getTrackSearchTags,
  getUserSearchLocations,
  getPlaylistSearchTags,
};
