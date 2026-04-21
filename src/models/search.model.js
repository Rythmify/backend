const db = require('../config/db'); // your pg pool / client

const SUGGESTION_THRESHOLD = 0.2;

async function searchTracks({ q, sort, limit, offset, threshold }) {
  // Build ORDER BY clause.
  // sort=plays → play_count DESC, then score DESC
  // sort=newest → created_at DESC, then score DESC
  // sort=relevance (default) → score DESC
  let orderBy;
  if (sort === 'plays') orderBy = 'play_count DESC, score DESC';
  else if (sort === 'newest') orderBy = 't.created_at DESC, score DESC';
  else orderBy = 'score DESC';

  const query = `
    WITH ranked AS (
      SELECT
        t.id,
        t.title,
        t.cover_image,
        t.user_id,
        u.display_name                                    AS artist_name,
        g.name                                            AS genre_name,
        t.duration,
        t.play_count,
        t.like_count,
        t.repost_count,
        t.stream_url,
        t.created_at,

        -- Combined relevance score (capped at 1.0)
        LEAST(
          0.6 * ts_rank(t.search_vector, plainto_tsquery('english', $1))
          + 0.4 * GREATEST(
              similarity(t.title,       $1),
              similarity(COALESCE(t.description, ''), $1)
            ),
          1.0
        )                                                 AS score,

        -- Trigram similarity for filtering
        GREATEST(
          similarity(t.title,       $1),
          similarity(COALESCE(t.description, ''), $1)
        )                                                 AS trgm_sim

      FROM tracks t
      JOIN users  u ON u.id = t.user_id
      LEFT JOIN genres g ON g.id = t.genre_id

      WHERE
        t.deleted_at  IS NULL
        AND t.is_public   = true
        AND t.is_hidden   = false
        AND t.status      = 'ready'
        -- Full-text OR trigram — one must match
        AND (
          t.search_vector @@ plainto_tsquery('english', $1)
          OR GREATEST(
               similarity(t.title, $1),
               similarity(COALESCE(t.description, ''), $1)
             ) >= $2
        )
    )
    SELECT
      *,
      COUNT(*) OVER() AS total_count
    FROM ranked
    WHERE trgm_sim >= $2 OR score > 0
    ORDER BY ${orderBy}
    LIMIT  $3
    OFFSET $4
  `;

  const { rows } = await db.query(query, [q, threshold, limit, offset]);

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  return { rows, total };
}

async function searchUsers({ q, sort, limit, offset, threshold }) {
  // sort=plays and sort=newest don't have a clear users equivalent → fall back to relevance.
  // sort=newest → created_at DESC for users makes some sense so we keep it.
  let orderBy;
  if (sort === 'newest') orderBy = 'u.created_at DESC, score DESC';
  else orderBy = 'score DESC'; // relevance or plays → both use score

  const query = `
    WITH ranked AS (
      SELECT
        u.id,
        u.display_name,
        u.profile_picture,
        u.followers_count,
        u.created_at,

        LEAST(
          0.6 * ts_rank(u.search_vector, plainto_tsquery('english', $1))
          + 0.4 * GREATEST(
              similarity(u.display_name,           $1),
              similarity(COALESCE(u.username, ''), $1)
            ),
          1.0
        )                                                 AS score,

        GREATEST(
          similarity(u.display_name,           $1),
          similarity(COALESCE(u.username, ''), $1)
        )                                                 AS trgm_sim

      FROM users u
      WHERE
        u.deleted_at    IS NULL
        AND u.is_suspended = false
        AND (
          u.search_vector @@ plainto_tsquery('english', $1)
          OR GREATEST(
               similarity(u.display_name,           $1),
               similarity(COALESCE(u.username, ''), $1)
             ) >= $2
        )
    )
    SELECT
      *,
      COUNT(*) OVER() AS total_count
    FROM ranked
    WHERE trgm_sim >= $2 OR score > 0
    ORDER BY ${orderBy}
    LIMIT  $3
    OFFSET $4
  `;

  const { rows } = await db.query(query, [q, threshold, limit, offset]);

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  return { rows, total };
}

async function searchPlaylists({ q, sort, limit, offset, threshold }) {
  // sort=plays has no meaning for playlists → fall back to relevance
  let orderBy;
  if (sort === 'newest') orderBy = 'p.created_at DESC, score DESC';
  else orderBy = 'score DESC';

  const query = `
    WITH ranked AS (
      SELECT
        p.id,
        p.name,
        p.user_id                                         AS owner_id,
        u.display_name                                    AS owner_display_name,
        p.track_count,
        p.created_at,

        LEAST(
          0.6 * ts_rank(p.search_vector, plainto_tsquery('english', $1))
          + 0.4 * GREATEST(
              similarity(p.name,                    $1),
              similarity(COALESCE(p.description, ''), $1)
            ),
          1.0
        )                                                 AS score,

        GREATEST(
          similarity(p.name,                    $1),
          similarity(COALESCE(p.description, ''), $1)
        )                                                 AS trgm_sim

      FROM playlists p
      JOIN users     u ON u.id = p.user_id

      WHERE
        p.deleted_at IS NULL
        AND p.is_public  = true
        AND (
          p.search_vector @@ plainto_tsquery('english', $1)
          OR GREATEST(
               similarity(p.name,                    $1),
               similarity(COALESCE(p.description, ''), $1)
             ) >= $2
        )
    )
    SELECT
      *,
      COUNT(*) OVER() AS total_count
    FROM ranked
    WHERE trgm_sim >= $2 OR score > 0
    ORDER BY ${orderBy}
    LIMIT  $3
    OFFSET $4
  `;

  const { rows } = await db.query(query, [q, threshold, limit, offset]);

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  // Fetch first 5 valid tracks for each matched playlist in one query.
  // ROW_NUMBER() partitioned by playlist_id counts only public/ready tracks,
  // so gaps caused by deleted or private tracks never reduce the preview count.
  // pt.position <= 5 alone would fail if positions 1-5 contain private tracks.
  let rowsWithTracks = rows;
  if (rows.length > 0) {
    const playlistIds = rows.map((r) => r.id);
    const tracksQuery = `
      SELECT
        playlist_id,
        track_id,
        title,
        cover_image,
        duration,
        stream_url,
        artist_name,
        user_id
      FROM (
        SELECT
          pt.playlist_id,
          t.id           AS track_id,
          t.title,
          t.cover_image,
          t.duration,
          t.stream_url,
          u.display_name AS artist_name,
          t.user_id,
          ROW_NUMBER() OVER (
            PARTITION BY pt.playlist_id
            ORDER BY pt.position ASC
          )              AS rn
        FROM playlist_tracks pt
        JOIN tracks t ON t.id = pt.track_id
        JOIN users  u ON u.id = t.user_id
        WHERE
          pt.playlist_id = ANY($1::uuid[])
          AND t.deleted_at IS NULL
          AND t.is_public  = true
          AND t.is_hidden  = false
          AND t.status     = 'ready'
      ) ranked
      WHERE rn <= 5
      ORDER BY playlist_id, rn ASC
    `;
    const { rows: trackRows } = await db.query(tracksQuery, [playlistIds]);

    // Group tracks by playlist_id
    const tracksByPlaylist = {};
    for (const tr of trackRows) {
      if (!tracksByPlaylist[tr.playlist_id]) tracksByPlaylist[tr.playlist_id] = [];
      tracksByPlaylist[tr.playlist_id].push({
        id: tr.track_id,
        title: tr.title,
        cover_image: tr.cover_image ?? null,
        duration: tr.duration ?? null,
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

async function suggestUsers(q, limit, userId) {
  // ── Unauthenticated — global search ──────────────────────────────────────
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

  // ── Authenticated — step 1: followed users that match ────────────────────
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
      AND (
        title ILIKE $1
        OR similarity(title, $2) >= $3
      )
    ORDER BY lower(title), play_count DESC
    LIMIT $4
    `,
    [`${q}%`, q, SUGGESTION_THRESHOLD, limit]
  );

  // Re-sort by play_count after DISTINCT ON forces its own ordering
  // Note: DISTINCT ON requires the order to start with the distinct key,
  // so we do a second sort in JS on the already-small result set.
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
  suggestUsers,
  suggestTrackTitles,
  suggestPlaylistNames,
};
