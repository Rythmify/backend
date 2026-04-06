const db = require('../config/db');

const sharedExclusions = `
  AND u.id <> $1
  AND NOT EXISTS (
    SELECT 1
    FROM follows existing_follow
    WHERE existing_follow.follower_id = $1
      AND existing_follow.following_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM blocks blocked_by_me
    WHERE blocked_by_me.blocker_id = $1
      AND blocked_by_me.blocked_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM blocks blocking_me
    WHERE blocking_me.blocker_id = u.id
      AND blocking_me.blocked_id = $1
  )
`;

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
        u.followers_count::integer AS followers_count,
        COUNT(DISTINCT f1.follower_id)::integer AS mutual_count,
        'mutual'::text AS suggestion_source,
        false AS is_following,
        1 AS source_rank
      FROM follows f1
      JOIN follows f2
        ON f2.follower_id = f1.following_id
      JOIN users u
        ON u.id = f2.following_id
      WHERE f1.follower_id = $1
        AND u.deleted_at IS NULL
        ${sharedExclusions}
      GROUP BY
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count
    ),
    popular_candidates AS (
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count::integer AS followers_count,
        NULL::integer AS mutual_count,
        'popular'::text AS suggestion_source,
        false AS is_following,
        2 AS source_rank
      FROM users u
      WHERE u.deleted_at IS NULL
        ${sharedExclusions}
    ),
    candidate_users AS (
      SELECT * FROM mutual_candidates
      UNION ALL
      SELECT * FROM popular_candidates
    ),
    ranked_candidates AS (
      SELECT
        candidate_users.*,
        ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY source_rank ASC, mutual_count DESC NULLS LAST, followers_count DESC, display_name ASC, username ASC
        ) AS dedupe_rank
      FROM candidate_users
    ),
    deduped_candidates AS (
      SELECT *
      FROM ranked_candidates
      WHERE dedupe_rank = 1
    ),
    total_count_cte AS (
      SELECT COUNT(*)::integer AS total_count
      FROM deduped_candidates
    ),
    page_rows AS (
      SELECT
        id,
        display_name,
        username,
        profile_picture,
        is_verified,
        followers_count,
        mutual_count,
        suggestion_source,
        is_following
      FROM deduped_candidates
      ORDER BY source_rank ASC, mutual_count DESC NULLS LAST, followers_count DESC, display_name ASC, username ASC, id ASC
      LIMIT $2 OFFSET $3
    )
    SELECT
      p.id,
      p.display_name,
      p.username,
      p.profile_picture,
      p.is_verified,
      p.followers_count,
      p.mutual_count,
      p.suggestion_source,
      p.is_following,
      t.total_count
    FROM total_count_cte t
    LEFT JOIN page_rows p ON true
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? toInteger(rows[0].total_count) : 0;
  const items = rows
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      profile_picture: r.profile_picture,
      is_verified: r.is_verified,
      follower_count: toInteger(r.followers_count),
      mutual_count: r.mutual_count === null ? null : toInteger(r.mutual_count),
      suggestion_source: r.suggestion_source,
      is_following: false,
    }));

  return { items, total };
}

/**
 * Popular users the current user doesn't follow yet.
 * Used as fallback when mutual suggestions are insufficient.
 * Excludes the same blocked/self/already-followed set.
 */
async function getPopularUsers(userId, limit, offset) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name,
      u.username,
      u.profile_picture,
      u.is_verified,
      u.followers_count::integer AS followers_count,
      NULL::integer AS mutual_count,
      'popular'::text AS suggestion_source,
      false AS is_following,
      1 AS source_rank,
      COUNT(*) OVER() AS total_count
    FROM users u
    WHERE u.deleted_at IS NULL
      AND u.id <> $1
      AND NOT EXISTS (
        SELECT 1
        FROM follows existing_follow
        WHERE existing_follow.follower_id = $1
          AND existing_follow.following_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM blocks blocked_by_me
        WHERE blocked_by_me.blocker_id = $1
          AND blocked_by_me.blocked_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM blocks blocking_me
        WHERE blocking_me.blocker_id = u.id
          AND blocking_me.blocked_id = $1
      )
    ORDER BY u.followers_count DESC, u.display_name ASC, u.username ASC, u.id ASC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  return rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    username: r.username,
    profile_picture: r.profile_picture,
    is_verified: r.is_verified,
    follower_count: toInteger(r.followers_count),
    mutual_count: null,
    suggestion_source: r.suggestion_source,
    is_following: false,
    total_count: toInteger(r.total_count),
  }));
}

// ─────────────────────────────────────────────────────────────
// GET /users/suggested/artists — helpers
// ─────────────────────────────────────────────────────────────

/**
 * Artists who have tracks in the user's liked genres.
 *
 * Fallback returns globally popular artists that match the same safety filters.
 */
async function getArtistsByUserGenres(userId, limit, offset) {
  const { rows } = await db.query(
    `
    WITH liked_genres AS (
      SELECT DISTINCT t.genre_id
      FROM track_likes tl
      JOIN tracks t
        ON t.id = tl.track_id
      WHERE tl.user_id = $1
        AND t.deleted_at IS NULL
        AND t.genre_id IS NOT NULL
        AND t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
    ),
    genre_candidates AS (
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count::integer AS followers_count,
        (ARRAY_AGG(DISTINCT g.name ORDER BY g.name))[1] AS top_genre,
        COUNT(DISTINCT lg.genre_id)::integer AS matched_genre_count,
        false AS is_following,
        1 AS source_rank
      FROM liked_genres lg
      JOIN tracks t
        ON t.genre_id = lg.genre_id
        AND t.deleted_at IS NULL
        AND t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
      JOIN users u
        ON u.id = t.user_id
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
      LEFT JOIN genres g
        ON g.id = t.genre_id
      WHERE u.id <> $1
        AND NOT EXISTS (
          SELECT 1
          FROM follows existing_follow
          WHERE existing_follow.follower_id = $1
            AND existing_follow.following_id = u.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM blocks blocked_by_me
          WHERE blocked_by_me.blocker_id = $1
            AND blocked_by_me.blocked_id = u.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM blocks blocking_me
          WHERE blocking_me.blocker_id = u.id
            AND blocking_me.blocked_id = $1
        )
      GROUP BY
        u.id,
        u.display_name,
        u.username,
        u.profile_picture,
        u.is_verified,
        u.followers_count
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
          FROM tracks t2
          LEFT JOIN genres g
            ON g.id = t2.genre_id
          WHERE t2.user_id = u.id
            AND t2.deleted_at IS NULL
            AND t2.is_public = true
            AND t2.is_hidden = false
            AND t2.status = 'ready'
          ORDER BY t2.play_count DESC, t2.created_at DESC
          LIMIT 1
        ) AS top_genre,
        NULL::integer AS matched_genre_count,
        false AS is_following,
        2 AS source_rank
      FROM users u
      WHERE u.role = 'artist'
        AND u.deleted_at IS NULL
        AND u.id <> $1
        AND EXISTS (
          SELECT 1
          FROM tracks t
          WHERE t.user_id = u.id
            AND t.deleted_at IS NULL
            AND t.is_public = true
            AND t.is_hidden = false
            AND t.status = 'ready'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM follows existing_follow
          WHERE existing_follow.follower_id = $1
            AND existing_follow.following_id = u.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM blocks blocked_by_me
          WHERE blocked_by_me.blocker_id = $1
            AND blocked_by_me.blocked_id = u.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM blocks blocking_me
          WHERE blocking_me.blocker_id = u.id
            AND blocking_me.blocked_id = $1
        )
    ),
    candidate_artists AS (
      SELECT * FROM genre_candidates
      UNION ALL
      SELECT * FROM popular_artists
    ),
    ranked_candidates AS (
      SELECT
        candidate_artists.*,
        ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY source_rank ASC, matched_genre_count DESC NULLS LAST, followers_count DESC, display_name ASC, username ASC
        ) AS dedupe_rank
      FROM candidate_artists
    ),
    deduped_candidates AS (
      SELECT *
      FROM ranked_candidates
      WHERE dedupe_rank = 1
    ),
    total_count_cte AS (
      SELECT COUNT(*)::integer AS total_count
      FROM deduped_candidates
    ),
    page_rows AS (
      SELECT
        id,
        display_name,
        username,
        profile_picture,
        is_verified,
        followers_count,
        top_genre,
        is_following
      FROM deduped_candidates
      ORDER BY source_rank ASC, matched_genre_count DESC NULLS LAST, followers_count DESC, display_name ASC, username ASC, id ASC
      LIMIT $2 OFFSET $3
    )
    SELECT
      p.id,
      p.display_name,
      p.username,
      p.profile_picture,
      p.is_verified,
      p.followers_count,
      p.top_genre,
      p.is_following,
      t.total_count
    FROM total_count_cte t
    LEFT JOIN page_rows p ON true
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? toInteger(rows[0].total_count) : 0;
  const items = rows
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      profile_picture: r.profile_picture,
      is_verified: r.is_verified,
      follower_count: toInteger(r.followers_count),
      top_genre: r.top_genre ?? null,
      is_following: false,
    }));

  return { items, total };
}

/**
 * Global top artists fallback — used when the user has no genre history
 * or when genre-based results are insufficient.
 */
async function getPopularArtists(userId, limit) {
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
        FROM tracks t2
        LEFT JOIN genres g
          ON g.id = t2.genre_id
        WHERE t2.user_id = u.id
          AND t2.deleted_at IS NULL
          AND t2.is_public = true
          AND t2.is_hidden = false
          AND t2.status = 'ready'
        ORDER BY t2.play_count DESC, t2.created_at DESC
        LIMIT 1
      ) AS top_genre,
      NULL::integer AS matched_genre_count,
      false AS is_following,
      1 AS source_rank,
      COUNT(*) OVER() AS total_count
    FROM users u
    WHERE u.role = 'artist'
      AND u.deleted_at IS NULL
      AND u.id <> $1
      AND EXISTS (
        SELECT 1
        FROM tracks t
        WHERE t.user_id = u.id
          AND t.deleted_at IS NULL
          AND t.is_public = true
          AND t.is_hidden = false
          AND t.status = 'ready'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM follows existing_follow
        WHERE existing_follow.follower_id = $1
          AND existing_follow.following_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM blocks blocked_by_me
        WHERE blocked_by_me.blocker_id = $1
          AND blocked_by_me.blocked_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM blocks blocking_me
        WHERE blocking_me.blocker_id = u.id
          AND blocking_me.blocked_id = $1
      )
    ORDER BY u.followers_count DESC, u.display_name ASC, u.username ASC, u.id ASC
    LIMIT $2 OFFSET 0
    `,
    [userId, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    username: r.username,
    profile_picture: r.profile_picture,
    is_verified: r.is_verified,
    follower_count: toInteger(r.followers_count),
    top_genre: r.top_genre ?? null,
    is_following: false,
    total_count: toInteger(r.total_count),
  }));
}

module.exports = {
  getMutualFollowSuggestions,
  getPopularUsers,
  getArtistsByUserGenres,
  getPopularArtists,
};

function toInteger(value) {
  return Number.parseInt(value, 10) || 0;
}
