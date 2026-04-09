// ============================================================
// models/followdiscovery.model.js
// ============================================================
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────
// Shared safety-filter fragment (parametric — $1 = current userId)
// ─────────────────────────────────────────────────────────────
// NOTE: This string is embedded into queries that already bind $1
// as userId — do NOT add new bind params inside this fragment.

const sharedExclusions = `
  AND u.id <> $1
  AND NOT EXISTS (
    SELECT 1 FROM follows ef
    WHERE ef.follower_id = $1 AND ef.following_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocks bbm
    WHERE bbm.blocker_id = $1 AND bbm.blocked_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocks bme
    WHERE bme.blocker_id = u.id AND bme.blocked_id = $1
  )
`;

// Used by: getMutualFollowSuggestions, getPopularUsers
// Returns listeners only — artists have their own endpoint
const sharedListenerEligibility = `
  u.deleted_at IS NULL
  AND u.is_suspended = false
  AND u.role = 'listener'
`;

// Used by: getArtistsByUserGenres, getPopularArtists
const sharedArtistEligibility = `
  u.deleted_at IS NULL
  AND u.is_suspended = false
  AND u.role = 'artist'
`;

// ─────────────────────────────────────────────────────────────
// getMutualFollowSuggestions
// Priority: mutual follows → popular listeners
// Returns listeners only.
// ─────────────────────────────────────────────────────────────

async function getMutualFollowSuggestions(userId, limit, offset) {
  const { rows } = await db.query(
    `
    WITH mutual_candidates AS (
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count::integer         AS followers_count,
        COUNT(DISTINCT f1.follower_id)::integer AS mutual_count,
        'mutual'::text                     AS suggestion_source,
        false                              AS is_following,
        1                                  AS source_rank
      FROM   follows f1
      JOIN   follows f2 ON f2.follower_id = f1.following_id
      JOIN   users   u  ON u.id           = f2.following_id
      WHERE  f1.follower_id = $1
        AND  ${sharedListenerEligibility}
        ${sharedExclusions}
      GROUP  BY u.id, u.display_name, u.username,
                u.profile_picture, u.is_verified, u.followers_count
    ),
    popular_candidates AS (
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count::integer AS followers_count,
        NULL::integer              AS mutual_count,
        'popular'::text            AS suggestion_source,
        false                      AS is_following,
        2                          AS source_rank
      FROM   users u
      WHERE  ${sharedListenerEligibility}
        ${sharedExclusions}
    ),
    all_candidates AS (
      SELECT * FROM mutual_candidates
      UNION ALL
      SELECT * FROM popular_candidates
    ),
    -- Keep best source_rank when a user appears in both CTEs
    deduped AS (
      SELECT DISTINCT ON (id)
        id, display_name, username, profile_picture,
        is_verified, followers_count, mutual_count,
        suggestion_source, is_following, source_rank
      FROM   all_candidates
      ORDER  BY id, source_rank ASC, mutual_count DESC NULLS LAST,
                followers_count DESC, display_name ASC
    ),
    total_cte AS (
      SELECT COUNT(*)::integer AS total_count FROM deduped
    )
    SELECT
      d.id, d.display_name, d.username, d.profile_picture,
      d.is_verified, d.followers_count, d.mutual_count,
      d.suggestion_source, d.is_following,
      t.total_count
    FROM   total_cte t
    LEFT   JOIN (
      SELECT * FROM deduped
      ORDER  BY source_rank ASC,
                mutual_count DESC NULLS LAST,
                followers_count  DESC,
                display_name     ASC,
                username         ASC,
                id               ASC
      LIMIT  $2 OFFSET $3
    ) d ON true
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? toInt(rows[0].total_count) : 0;
  const items = rows
    .filter((r) => r.id != null)
    .map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      profile_picture: r.profile_picture ?? null,
      is_verified: r.is_verified,
      follower_count: toInt(r.followers_count),
      mutual_count: r.mutual_count === null ? null : toInt(r.mutual_count),
      suggestion_source: r.suggestion_source,
      is_following: false,
    }));

  return { items, total };
}

// ─────────────────────────────────────────────────────────────
// getPopularUsers  (exported for potential direct use)
// Returns listeners only.
// ─────────────────────────────────────────────────────────────

async function getPopularUsers(userId, limit, offset) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.username,
      u.profile_picture,
      u.is_verified,
      u.followers_count::integer  AS followers_count,
      NULL::integer               AS mutual_count,
      'popular'::text             AS suggestion_source,
      false                       AS is_following,
      COUNT(*) OVER()::integer    AS total_count
    FROM   users u
    WHERE  ${sharedListenerEligibility}
      ${sharedExclusions}
    ORDER  BY u.followers_count DESC,
              u.display_name    ASC,
              u.username        ASC,
              u.id              ASC
    LIMIT  $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? toInt(rows[0].total_count) : 0;
  const items = rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    username: r.username,
    profile_picture: r.profile_picture ?? null,
    is_verified: r.is_verified,
    follower_count: toInt(r.followers_count),
    mutual_count: null,
    suggestion_source: r.suggestion_source,
    is_following: false,
  }));

  return { items, total };
}

// ─────────────────────────────────────────────────────────────
// getArtistsByUserGenres
// Priority: genre-matched artists → popular artists fallback
// ─────────────────────────────────────────────────────────────

async function getArtistsByUserGenres(userId, limit, offset) {
  const { rows } = await db.query(
    `
    WITH liked_genres AS (
      SELECT DISTINCT t.genre_id
      FROM   track_likes tl
      JOIN   tracks t ON t.id = tl.track_id
      WHERE  tl.user_id   = $1
        AND  t.deleted_at IS NULL
        AND  t.genre_id   IS NOT NULL
        AND  t.is_public  = true
        AND  t.is_hidden  = false
        AND  t.status     = 'ready'
    ),
    genre_candidates AS (
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count::integer              AS followers_count,
        (ARRAY_AGG(DISTINCT g.name ORDER BY g.name))[1] AS top_genre,
        COUNT(DISTINCT lg.genre_id)::integer    AS matched_genre_count,
        false                                   AS is_following,
        1                                       AS source_rank
      FROM   liked_genres lg
      JOIN   tracks t
               ON t.genre_id   = lg.genre_id
              AND t.deleted_at IS NULL
              AND t.is_public  = true
              AND t.is_hidden  = false
              AND t.status     = 'ready'
      JOIN   users  u
               ON u.id         = t.user_id
              AND ${sharedArtistEligibility}
      LEFT   JOIN genres g ON g.id = t.genre_id
      WHERE  1=1
        ${sharedExclusions}
      GROUP  BY u.id, u.display_name, u.username,
                u.profile_picture, u.is_verified, u.followers_count
    ),
    popular_artists AS (
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count::integer AS followers_count,
        (
          SELECT g.name
          FROM   tracks t2
          LEFT   JOIN genres g ON g.id = t2.genre_id
          WHERE  t2.user_id    = u.id
            AND  t2.deleted_at IS NULL
            AND  t2.is_public  = true
            AND  t2.is_hidden  = false
            AND  t2.status     = 'ready'
          ORDER  BY t2.play_count DESC, t2.created_at DESC
          LIMIT  1
        ) AS top_genre,
        NULL::integer              AS matched_genre_count,
        false                      AS is_following,
        2                          AS source_rank
      FROM   users u
      WHERE  ${sharedArtistEligibility}
        AND  EXISTS (
          SELECT 1 FROM tracks t
          WHERE t.user_id    = u.id
            AND t.deleted_at IS NULL
            AND t.is_public  = true
            AND t.is_hidden  = false
            AND t.status     = 'ready'
        )
        ${sharedExclusions}
    ),
    all_candidates AS (
      SELECT * FROM genre_candidates
      UNION ALL
      SELECT * FROM popular_artists
    ),
    deduped AS (
      SELECT DISTINCT ON (id)
        id, display_name, username, profile_picture,
        is_verified, followers_count, top_genre,
        matched_genre_count, is_following, source_rank
      FROM   all_candidates
      ORDER  BY id, source_rank ASC,
                matched_genre_count DESC NULLS LAST,
                followers_count DESC,
                display_name ASC
    ),
    total_cte AS (
      SELECT COUNT(*)::integer AS total_count FROM deduped
    )
    SELECT
      d.id, d.display_name, d.username, d.profile_picture,
      d.is_verified, d.followers_count, d.top_genre, d.is_following,
      t.total_count
    FROM   total_cte t
    LEFT   JOIN (
      SELECT * FROM deduped
      ORDER  BY source_rank ASC,
                matched_genre_count DESC NULLS LAST,
                followers_count     DESC,
                display_name        ASC,
                username            ASC,
                id                  ASC
      LIMIT  $2 OFFSET $3
    ) d ON true
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? toInt(rows[0].total_count) : 0;
  const items = rows
    .filter((r) => r.id != null)
    .map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      profile_picture: r.profile_picture ?? null,
      is_verified: r.is_verified,
      follower_count: toInt(r.followers_count),
      top_genre: r.top_genre ?? null,
      is_following: false,
    }));

  return { items, total };
}

// ─────────────────────────────────────────────────────────────
// getPopularArtists  (global top artists fallback)
// ─────────────────────────────────────────────────────────────

async function getPopularArtists(userId, limit, offset = 0) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.username,
      u.profile_picture,
      u.is_verified,
      u.followers_count::integer AS followers_count,
      (
        SELECT g.name
        FROM   tracks t2
        LEFT   JOIN genres g ON g.id = t2.genre_id
        WHERE  t2.user_id    = u.id
          AND  t2.deleted_at IS NULL
          AND  t2.is_public  = true
          AND  t2.is_hidden  = false
          AND  t2.status     = 'ready'
        ORDER  BY t2.play_count DESC, t2.created_at DESC
        LIMIT  1
      ) AS top_genre,
      false                      AS is_following,
      COUNT(*) OVER()::integer   AS total_count
    FROM   users u
    WHERE  ${sharedArtistEligibility}
      AND  EXISTS (
        SELECT 1 FROM tracks t
        WHERE t.user_id    = u.id
          AND t.deleted_at IS NULL
          AND t.is_public  = true
          AND t.is_hidden  = false
          AND t.status     = 'ready'
      )
      ${sharedExclusions}
    ORDER  BY u.followers_count DESC,
              u.display_name    ASC,
              u.username        ASC,
              u.id              ASC
    LIMIT  $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? toInt(rows[0].total_count) : 0;
  const items = rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    username: r.username,
    profile_picture: r.profile_picture ?? null,
    is_verified: r.is_verified,
    follower_count: toInt(r.followers_count),
    top_genre: r.top_genre ?? null,
    is_following: false,
  }));

  return { items, total };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toInt(value) {
  return Number.parseInt(value, 10) || 0;
}

module.exports = {
  getMutualFollowSuggestions,
  getPopularUsers,
  getArtistsByUserGenres,
  getPopularArtists,
};
