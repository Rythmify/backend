// models/feed.model.js

const db = require('../config/db');

async function getDailyTracks(limit) {
  const { rows } = await db.query(
    `
      SELECT
        t.id,
        t.title,
        t.cover_image,
        t.duration,
        g.name AS genre_name,
        t.play_count,
        t.like_count,
        COALESCE(t.repost_count, 0) AS repost_count,
        t.user_id,
        u.display_name AS artist_name,
        t.audio_url AS stream_url,
        t.created_at
      FROM tracks t
      JOIN users u
        ON u.id = t.user_id
      LEFT JOIN genres g
        ON g.id = t.genre_id
      WHERE t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
      ORDER BY t.created_at DESC, t.play_count DESC
      LIMIT $1
    `,
    [limit]
  );

  return rows;
}

async function getWeeklyTracks(userId, limit) {
  const { rows } = await db.query(
    `
      WITH top_listened_artists AS (
        SELECT
          t.user_id AS artist_id,
          COUNT(*) AS play_count,
          MAX(lh.played_at) AS last_played
        FROM listening_history lh
        JOIN tracks t
          ON t.id = lh.track_id
        WHERE lh.user_id = $1
        GROUP BY t.user_id
      ),
      top_listened_genres AS (
        SELECT
          t.genre_id,
          COUNT(*) AS play_count,
          MAX(lh.played_at) AS last_played
        FROM listening_history lh
        JOIN tracks t
          ON t.id = lh.track_id
        WHERE lh.user_id = $1
          AND t.genre_id IS NOT NULL
        GROUP BY t.genre_id
      ),
      followed_artists AS (
        SELECT f.following_id AS artist_id
        FROM follows f
        JOIN users u
          ON u.id = f.following_id
        WHERE f.follower_id = $1
          AND u.role = 'artist'
          AND u.deleted_at IS NULL
      ),
      favorite_genres AS (
        SELECT ufg.genre_id
        FROM user_favorite_genres ufg
        WHERE ufg.user_id = $1
      ),
      liked_genres AS (
        SELECT DISTINCT t.genre_id
        FROM track_likes tl
        JOIN tracks t
          ON t.id = tl.track_id
        WHERE tl.user_id = $1
          AND t.genre_id IS NOT NULL
      )
      SELECT
        t.id,
        t.title,
        t.cover_image,
        t.duration,
        g.name AS genre_name,
        t.play_count,
        t.like_count,
        COALESCE(t.repost_count, 0) AS repost_count,
        t.user_id,
        u.display_name AS artist_name,
        t.audio_url AS stream_url,
        t.created_at,
        CASE
          WHEN tla.artist_id IS NOT NULL THEN 1
          WHEN fa.artist_id IS NOT NULL THEN 2
          WHEN tlg.genre_id IS NOT NULL THEN 3
          WHEN fg.genre_id IS NOT NULL THEN 4
          WHEN lg.genre_id IS NOT NULL THEN 5
          ELSE 6
        END AS source_rank
      FROM tracks t
      JOIN users u
        ON u.id = t.user_id
      LEFT JOIN genres g
        ON g.id = t.genre_id
      LEFT JOIN top_listened_artists tla
        ON tla.artist_id = t.user_id
      LEFT JOIN top_listened_genres tlg
        ON tlg.genre_id = t.genre_id
      LEFT JOIN followed_artists fa
        ON fa.artist_id = t.user_id
      LEFT JOIN favorite_genres fg
        ON fg.genre_id = t.genre_id
      LEFT JOIN liked_genres lg
        ON lg.genre_id = t.genre_id
      WHERE t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
      ORDER BY source_rank ASC, tla.last_played DESC NULLS LAST, t.play_count DESC, t.created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return rows;
}

async function getHomeTrendingByGenre(trackLimit) {
  const { rows: genreRows } = await db.query(
    `
      SELECT
        g.id AS genre_id,
        g.name AS genre_name
      FROM genres g
      JOIN tracks t
        ON t.genre_id = g.id
      JOIN users u
        ON u.id = t.user_id
      WHERE t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
      GROUP BY g.id, g.name
      ORDER BY SUM(t.play_count) DESC, g.name ASC
      LIMIT 10
    `
  );

  const genres = genreRows.map((row) => ({
    genre_id: row.genre_id,
    genre_name: row.genre_name,
  }));

  if (genres.length === 0) {
    return { genres: [], initial_tab: null };
  }

  const initialGenre = genres[0];
  const initialTracks = await findTracksByGenreId(initialGenre.genre_id, trackLimit);

  return {
    genres,
    initial_tab: {
      genre_id: initialGenre.genre_id,
      genre_name: initialGenre.genre_name,
      tracks: Array.isArray(initialTracks) ? initialTracks : [],
    },
  };
}

async function getArtistsToWatch(limit) {
  const { rows } = await db.query(
    `
      SELECT
        u.id,
        u.display_name,
        u.profile_picture,
        (
          SELECT g.name
          FROM tracks t2
          LEFT JOIN genres g
            ON g.id = t2.genre_id
          WHERE t2.user_id = u.id
            AND t2.is_public = true
            AND t2.is_hidden = false
            AND t2.status = 'ready'
            AND t2.deleted_at IS NULL
          ORDER BY t2.play_count DESC, t2.created_at DESC
          LIMIT 1
        ) AS top_genre,
        COALESCE(SUM(t.play_count), 0)::integer AS play_velocity,
        COUNT(t.id)::integer AS track_count
      FROM users u
      LEFT JOIN tracks t
        ON t.user_id = u.id
        AND t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
      WHERE u.role = 'artist'
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.display_name, u.profile_picture
      ORDER BY play_velocity DESC, track_count DESC, u.display_name ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    display_name: row.display_name,
    profile_picture: row.profile_picture ?? null,
    top_genre: row.top_genre ?? null,
    play_velocity: Number(row.play_velocity) || 0,
    track_count: Number(row.track_count) || 0,
  }));
}

async function getDiscoverWithStations(limit) {
  const { rows } = await db.query(
    `
      SELECT
        u.id,
        u.display_name,
        u.profile_picture,
        COALESCE(COUNT(t.id), 0)::integer AS track_count,
        COALESCE(u.followers_count, 0)::integer AS follower_count
      FROM users u
      LEFT JOIN tracks t
        ON t.user_id = u.id
        AND t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
      WHERE u.role = 'artist'
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.display_name, u.profile_picture, u.followers_count
      ORDER BY follower_count DESC, track_count DESC, u.display_name ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    name: `Based on ${row.display_name}`,
    artist_id: row.id,
    artist_name: row.display_name,
    cover_image: row.profile_picture ?? null,
    track_count: Number(row.track_count) || 0,
    follower_count: Number(row.follower_count) || 0,
  }));
}

async function getPersonalizedMixGenreCandidates(userId, limit) {
  const { rows } = await db.query(
    `
      WITH top_listened_genres AS (
        SELECT
          t.genre_id,
          COUNT(*)::integer AS play_count,
          MAX(lh.played_at) AS last_played
        FROM listening_history lh
        JOIN tracks t
          ON t.id = lh.track_id
        WHERE lh.user_id = $1
          AND t.genre_id IS NOT NULL
        GROUP BY t.genre_id
      ),
      favorite_genres AS (
        SELECT
          ufg.genre_id,
          NULL::integer AS play_count,
          NULL::timestamptz AS last_played
        FROM user_favorite_genres ufg
        WHERE ufg.user_id = $1
      ),
      liked_genres AS (
        SELECT
          t.genre_id,
          COUNT(*)::integer AS play_count,
          MAX(tl.created_at) AS last_played
        FROM track_likes tl
        JOIN tracks t
          ON t.id = tl.track_id
        WHERE tl.user_id = $1
          AND t.genre_id IS NOT NULL
          AND t.is_public = true
          AND t.is_hidden = false
          AND t.status = 'ready'
          AND t.deleted_at IS NULL
        GROUP BY t.genre_id
      ),
      candidate_genres AS (
        SELECT genre_id, 1 AS source_rank, play_count, last_played
        FROM top_listened_genres
        UNION ALL
        SELECT genre_id, 2 AS source_rank, play_count, last_played
        FROM favorite_genres
        UNION ALL
        SELECT genre_id, 3 AS source_rank, play_count, last_played
        FROM liked_genres
      ),
      deduped AS (
        SELECT
          cg.genre_id,
          MIN(cg.source_rank)::integer AS source_rank,
          MAX(cg.last_played) AS last_played,
          MAX(cg.play_count)::integer AS signal_count
        FROM candidate_genres cg
        GROUP BY cg.genre_id
      )
      SELECT
        d.genre_id,
        g.name AS genre_name,
        d.source_rank,
        d.last_played,
        d.signal_count
      FROM deduped d
      JOIN genres g
        ON g.id = d.genre_id
      ORDER BY
        d.source_rank ASC,
        d.last_played DESC NULLS LAST,
        d.signal_count DESC NULLS LAST,
        g.name ASC
      LIMIT $2
    `,
    [userId, limit]
  );

  return rows;
}

async function getTrendingMixGenreCandidates(limit) {
  const { rows } = await db.query(
    `
      SELECT
        g.id AS genre_id,
        g.name AS genre_name
      FROM genres g
      JOIN tracks t
        ON t.genre_id = g.id
      JOIN users u
        ON u.id = t.user_id
      WHERE t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
      GROUP BY g.id, g.name
      ORDER BY SUM(t.play_count) DESC, g.name ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows;
}

async function getTopPreviewTracksByGenreIds(genreIds) {
  if (!Array.isArray(genreIds) || genreIds.length === 0) {
    return [];
  }

  const { rows } = await db.query(
    `
      WITH selected_genres AS (
        SELECT
          genre_id,
          ordinality::integer AS genre_order
        FROM unnest($1::uuid[]) WITH ORDINALITY AS g(genre_id, ordinality)
      ),
      ranked_tracks AS (
        SELECT
          sg.genre_id,
          sg.genre_order,
          t.id,
          t.title,
          t.cover_image,
          t.duration,
          g.name AS genre_name,
          t.play_count,
          t.like_count,
          COALESCE(t.repost_count, 0) AS repost_count,
          t.user_id,
          u.display_name AS artist_name,
          t.audio_url AS stream_url,
          t.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY sg.genre_id
            ORDER BY t.play_count DESC, t.created_at DESC
          ) AS track_rank
        FROM selected_genres sg
        JOIN tracks t
          ON t.genre_id = sg.genre_id
        JOIN users u
          ON u.id = t.user_id
        LEFT JOIN genres g
          ON g.id = t.genre_id
        WHERE t.is_public = true
          AND t.is_hidden = false
          AND t.status = 'ready'
          AND t.deleted_at IS NULL
          AND u.role = 'artist'
          AND u.deleted_at IS NULL
      )
      SELECT
        genre_id,
        genre_order,
        id,
        title,
        cover_image,
        duration,
        genre_name,
        play_count,
        like_count,
        repost_count,
        user_id,
        artist_name,
        stream_url,
        created_at
      FROM ranked_tracks
      WHERE track_rank = 1
      ORDER BY genre_order ASC
    `,
    [genreIds]
  );

  return rows;
}

async function getMoreOfWhatYouLike(userId, limit, offset) {
  const query = `
    WITH top_listened_artists AS (
      SELECT
        t.user_id AS artist_id,
        COUNT(*) AS play_count,
        MAX(lh.played_at) AS last_played
      FROM listening_history lh
      JOIN tracks t ON t.id = lh.track_id
      WHERE lh.user_id = $1
      GROUP BY t.user_id
    ),

    top_listened_genres AS (
      SELECT
        t.genre_id,
        COUNT(*) AS play_count,
        MAX(lh.played_at) AS last_played
      FROM listening_history lh
      JOIN tracks t ON t.id = lh.track_id
      WHERE lh.user_id = $1
        AND t.genre_id IS NOT NULL
      GROUP BY t.genre_id
    ),

    followed_artists AS (
      SELECT u.id
      FROM follows f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $1
        AND u.role = 'artist'
    ),

    favorite_genres AS (
      SELECT genre_id
      FROM user_favorite_genres
      WHERE user_id = $1
    ),

    liked_genres AS (
      SELECT DISTINCT t.genre_id
      FROM track_likes tl
      JOIN tracks t ON t.id = tl.track_id
      WHERE tl.user_id = $1
        AND t.genre_id IS NOT NULL
        AND t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
    ),

    ranked_candidates AS (
      SELECT
        t.id,
        t.title,
        t.cover_image,
        t.duration,
        g.name AS genre_name,
        t.user_id,
        t.play_count,
        t.like_count,
        COALESCE(t.repost_count, 0) AS repost_count,
        u.display_name AS artist_name,
        t.audio_url AS stream_url,
        t.created_at,
        tla.artist_id AS listened_artist_id,
        tla.last_played AS listened_artist_last_played,
        tlg.genre_id AS listened_genre_id,
        fa.id AS followed_artist_id,
        fg.genre_id AS favorite_genre_id,
        lg.genre_id AS liked_genre_id
      FROM tracks t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN genres g ON g.id = t.genre_id
      LEFT JOIN top_listened_artists tla ON tla.artist_id = t.user_id
      LEFT JOIN top_listened_genres tlg ON tlg.genre_id = t.genre_id
      LEFT JOIN followed_artists fa ON fa.id = t.user_id
      LEFT JOIN favorite_genres fg ON fg.genre_id = t.genre_id
      LEFT JOIN liked_genres lg ON lg.genre_id = t.genre_id
      WHERE t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
    ),

    candidate_tracks AS (
      SELECT
        rc.id,
        rc.title,
        rc.cover_image,
        rc.duration,
        rc.genre_name,
        rc.user_id,
        rc.play_count,
        rc.like_count,
        rc.repost_count,
        rc.artist_name,
        rc.stream_url,
        rc.created_at,
        rc.listened_artist_last_played,

        CASE
          WHEN rc.listened_artist_id IS NOT NULL THEN 1
          WHEN rc.followed_artist_id IS NOT NULL THEN 2
          WHEN rc.listened_genre_id IS NOT NULL THEN 3
          WHEN rc.favorite_genre_id IS NOT NULL THEN 4
          WHEN rc.liked_genre_id IS NOT NULL THEN 5
          ELSE 6
        END AS source_rank

      FROM ranked_candidates rc
    ),

    ranked AS (
      SELECT
        id,
        title,
        cover_image,
        duration,
        genre_name,
        user_id,
        play_count,
        like_count,
        repost_count,
        artist_name,
        stream_url,
        created_at,
        listened_artist_last_played,
        source_rank,
        COUNT(*) OVER()::integer AS total_count
      FROM candidate_tracks
      ORDER BY
        source_rank ASC,
        listened_artist_last_played DESC NULLS LAST,
        play_count DESC,
        created_at DESC
      LIMIT $2 OFFSET $3
    )

    SELECT
      id,
      title,
      cover_image,
      duration,
      genre_name,
      user_id,
      play_count,
      like_count,
      repost_count,
      artist_name,
      stream_url,
      created_at,
      source_rank,
      total_count
    FROM ranked;
  `;

  const result = await db.query(query, [userId, limit, offset]);

  const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
  const primarySourceRank = result.rows.length > 0 ? Number(result.rows[0].source_rank) : 6;
  const items = result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    cover_image: row.cover_image ?? null,
    duration: row.duration,
    genre_name: row.genre_name ?? null,
    user_id: row.user_id,
    play_count: row.play_count,
    like_count: row.like_count,
    repost_count: row.repost_count,
    artist_name: row.artist_name ?? null,
    stream_url: row.stream_url ?? null,
    created_at: row.created_at,
  }));

  return {
    items,
    total,
    source: primarySourceRank <= 5 ? 'personalized' : 'trending_fallback',
  };
}

async function getAlbumsFromFollowedArtists(userId, limit, offset) {
  const { rows } = await db.query(
    `
      SELECT
        a.id,
        a.title AS name,
        a.cover_image,
        a.artist_id AS owner_id,
        u.display_name AS owner_name,
        a.track_count,
        a.like_count,
        a.created_at,
        COUNT(*) OVER()::integer AS total_count
      FROM follows f
      JOIN users u
        ON u.id = f.following_id
      JOIN albums a
        ON a.artist_id = u.id
      WHERE f.follower_id = $1
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
        AND a.deleted_at IS NULL
      ORDER BY a.like_count DESC, a.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    cover_image: row.cover_image,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    track_count: row.track_count,
    like_count: row.like_count,
    created_at: row.created_at,
  }));

  return {
    items,
    total,
  };
}

async function getTopAlbums(limit, offset) {
  const { rows } = await db.query(
    `
      SELECT
        a.id,
        a.title AS name,
        a.cover_image,
        a.artist_id AS owner_id,
        u.display_name AS owner_name,
        a.track_count,
        a.like_count,
        a.created_at,
        COUNT(*) OVER()::integer AS total_count
      FROM albums a
      JOIN users u
        ON u.id = a.artist_id
      WHERE u.role = 'artist'
        AND u.deleted_at IS NULL
        AND a.deleted_at IS NULL
      ORDER BY a.like_count DESC, a.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    cover_image: row.cover_image,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    track_count: row.track_count,
    like_count: row.like_count,
    created_at: row.created_at,
  }));

  return {
    items,
    total,
  };
}

async function findGenreById(genreId) {
  const { rows } = await db.query(
    `
      SELECT g.id, g.name
      FROM genres g
      WHERE g.id = $1
      LIMIT 1
    `,
    [genreId]
  );

  return rows[0] ?? null;
}

async function findTracksByGenreId(genreId, limit) {
  const { rows } = await db.query(
    `
      SELECT
        t.id,
        t.title,
        t.cover_image,
        t.duration,
        g.name AS genre_name,
        t.play_count,
        t.like_count,
        COALESCE(t.repost_count, 0) AS repost_count,
        t.user_id,
        u.display_name AS artist_name,
        t.audio_url AS stream_url,
        t.created_at
      FROM tracks t
      JOIN users u
        ON u.id = t.user_id
      LEFT JOIN genres g
        ON g.id = t.genre_id
      WHERE t.genre_id = $1
        AND t.is_public = true
        AND t.is_hidden = false
        AND t.status = 'ready'
        AND t.deleted_at IS NULL
        AND u.role = 'artist'
        AND u.deleted_at IS NULL
      ORDER BY t.play_count DESC, t.created_at DESC
      LIMIT $2
    `,
    [genreId, limit]
  );

  return rows;
}

module.exports = {
  getDailyTracks,
  getWeeklyTracks,
  getHomeTrendingByGenre,
  getArtistsToWatch,
  getDiscoverWithStations,
  getPersonalizedMixGenreCandidates,
  getTrendingMixGenreCandidates,
  getTopPreviewTracksByGenreIds,
  getMoreOfWhatYouLike,
  getAlbumsFromFollowedArtists,
  getTopAlbums,
  findGenreById,
  findTracksByGenreId,
};
