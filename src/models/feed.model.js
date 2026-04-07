// models/feed.model.js

const db = require('../config/db');

async function getMoreOfWhatYouLike(userId, limit, offset) {
  const query = `
    WITH followed_artists AS (
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
        t.user_id,
        t.genre_id,
        t.play_count,
        t.created_at,
        fa.id AS followed_artist_id,
        fg.genre_id AS favorite_genre_id,
        lg.genre_id AS liked_genre_id
      FROM tracks t
      JOIN users u ON u.id = t.user_id
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
        rc.user_id,
        rc.genre_id,
        rc.play_count,
        rc.created_at,

        CASE
          WHEN rc.followed_artist_id IS NOT NULL THEN 1
          WHEN rc.favorite_genre_id IS NOT NULL THEN 2
          WHEN rc.liked_genre_id IS NOT NULL THEN 3
          ELSE 4
        END AS source_rank

      FROM ranked_candidates rc
    ),

    ranked AS (
      SELECT
        id,
        title,
        user_id,
        genre_id,
        play_count,
        created_at,
        source_rank,
        COUNT(*) OVER()::integer AS total_count
      FROM candidate_tracks
      ORDER BY
        source_rank ASC,
        play_count DESC,
        created_at DESC
      LIMIT $2 OFFSET $3
    )

    SELECT
      id,
      title,
      user_id,
      genre_id,
      play_count,
      created_at,
      source_rank,
      total_count
    FROM ranked;
  `;

  const result = await db.query(query, [userId, limit, offset]);

  const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
  const primarySourceRank = result.rows.length > 0 ? Number(result.rows[0].source_rank) : 4;
  const items = result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    user_id: row.user_id,
    genre_id: row.genre_id,
    play_count: row.play_count,
    created_at: row.created_at,
  }));

  return {
    items,
    total,
    source: primarySourceRank <= 3 ? 'personalized' : 'trending_fallback',
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
        t.user_id,
        t.genre_id,
        t.cover_image,
        t.play_count,
        t.created_at
      FROM tracks t
      JOIN users u
        ON u.id = t.user_id
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
  getMoreOfWhatYouLike,
  findGenreById,
  findTracksByGenreId,
};
