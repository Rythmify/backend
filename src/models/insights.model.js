// ============================================================
// models/insights.model.js
// PostgreSQL queries for creator insights analytics.
// All SQL lives HERE - no SQL outside models/
// ============================================================
const db = require('../config/db');

const METRICS = ['plays', 'likes', 'comments', 'reposts', 'downloads'];

const toIntegerMetric = (value) => Number.parseInt(value ?? 0, 10) || 0;

const buildEmptyTotals = () =>
  METRICS.reduce((totals, metric) => {
    totals[metric] = 0;
    return totals;
  }, {});

const normalizeBucket = (bucket, granularity) => {
  if (bucket instanceof Date) {
    return bucket.toISOString().slice(0, 10);
  }

  const value = String(bucket);
  return granularity === 'month' ? value.slice(0, 7) : value.slice(0, 10);
};

const mapSeriesRow = (row, granularity) => ({
  bucket: normalizeBucket(row.bucket, granularity),
  plays: toIntegerMetric(row.plays),
  likes: toIntegerMetric(row.likes),
  comments: toIntegerMetric(row.comments),
  reposts: toIntegerMetric(row.reposts),
  downloads: toIntegerMetric(row.downloads),
});

exports.findOwnedTrackById = async ({ userId, trackId }) => {
  const { rows } = await db.query(
    `
      SELECT id
      FROM tracks
      WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [trackId, userId]
  );

  return rows[0] || null;
};

exports.getCreatorInsights = async ({
  userId,
  trackId = null,
  granularity,
  bucketCount,
  timezone,
}) => {
  const bucketStep = granularity === 'month' ? '1 month' : '1 day';
  const bucketUnit = granularity === 'month' ? 'month' : 'day';

  const query = `
    WITH params AS (
      SELECT
        $1::uuid AS user_id,
        $2::uuid AS track_id,
        $3::text AS timezone,
        $4::int AS bucket_count
    ),
    bounds AS (
      SELECT
        date_trunc('${bucketUnit}', timezone(params.timezone, now()))
          - (($4::int - 1) * INTERVAL '${bucketStep}') AS start_local,
        date_trunc('${bucketUnit}', timezone(params.timezone, now())) AS end_local
      FROM params
    ),
    buckets AS (
      SELECT generate_series(
        bounds.start_local,
        bounds.end_local,
        INTERVAL '${bucketStep}'
      ) AS bucket_local
      FROM bounds
    ),
    owned_tracks AS (
      SELECT t.id
      FROM tracks t, params
      WHERE t.user_id = params.user_id
        AND t.deleted_at IS NULL
        AND (params.track_id IS NULL OR t.id = params.track_id)
    ),
    plays AS (
      SELECT
        date_trunc('${bucketUnit}', lh.played_at AT TIME ZONE params.timezone) AS bucket_local,
        COUNT(*)::int AS count
      FROM listening_history lh
      JOIN owned_tracks ot
        ON ot.id = lh.track_id
      CROSS JOIN params
      CROSS JOIN bounds
      WHERE lh.played_at >= bounds.start_local AT TIME ZONE params.timezone
        AND lh.played_at < (bounds.end_local + INTERVAL '${bucketStep}') AT TIME ZONE params.timezone
        AND lh.deleted_at IS NULL
      GROUP BY 1
    ),
    likes AS (
      SELECT
        date_trunc('${bucketUnit}', tl.created_at AT TIME ZONE params.timezone) AS bucket_local,
        COUNT(*)::int AS count
      FROM track_likes tl
      JOIN owned_tracks ot
        ON ot.id = tl.track_id
      CROSS JOIN params
      CROSS JOIN bounds
      WHERE tl.created_at >= bounds.start_local AT TIME ZONE params.timezone
        AND tl.created_at < (bounds.end_local + INTERVAL '${bucketStep}') AT TIME ZONE params.timezone
      GROUP BY 1
    ),
    comments AS (
      SELECT
        date_trunc('${bucketUnit}', c.created_at AT TIME ZONE params.timezone) AS bucket_local,
        COUNT(*)::int AS count
      FROM comments c
      JOIN owned_tracks ot
        ON ot.id = c.track_id
      CROSS JOIN params
      CROSS JOIN bounds
      WHERE c.created_at >= bounds.start_local AT TIME ZONE params.timezone
        AND c.created_at < (bounds.end_local + INTERVAL '${bucketStep}') AT TIME ZONE params.timezone
        AND c.deleted_at IS NULL
      GROUP BY 1
    ),
    reposts AS (
      SELECT
        date_trunc('${bucketUnit}', tr.created_at AT TIME ZONE params.timezone) AS bucket_local,
        COUNT(*)::int AS count
      FROM track_reposts tr
      JOIN owned_tracks ot
        ON ot.id = tr.track_id
      CROSS JOIN params
      CROSS JOIN bounds
      WHERE tr.created_at >= bounds.start_local AT TIME ZONE params.timezone
        AND tr.created_at < (bounds.end_local + INTERVAL '${bucketStep}') AT TIME ZONE params.timezone
      GROUP BY 1
    )
    SELECT
      to_char(buckets.bucket_local, CASE WHEN $5::text = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END) AS bucket,
      COALESCE(plays.count, 0)::int AS plays,
      COALESCE(likes.count, 0)::int AS likes,
      COALESCE(comments.count, 0)::int AS comments,
      COALESCE(reposts.count, 0)::int AS reposts,
      0::int AS downloads
    FROM buckets
    LEFT JOIN plays
      ON plays.bucket_local = buckets.bucket_local
    LEFT JOIN likes
      ON likes.bucket_local = buckets.bucket_local
    LEFT JOIN comments
      ON comments.bucket_local = buckets.bucket_local
    LEFT JOIN reposts
      ON reposts.bucket_local = buckets.bucket_local
    ORDER BY buckets.bucket_local ASC
  `;

  // TODO: Wire downloads to a dedicated downloads/offline_downloads event table when one exists.
  const { rows } = await db.query(query, [userId, trackId, timezone, bucketCount, granularity]);
  const series = rows.map((row) => mapSeriesRow(row, granularity));
  const totals = series.reduce((accumulator, bucket) => {
    METRICS.forEach((metric) => {
      accumulator[metric] += bucket[metric];
    });
    return accumulator;
  }, buildEmptyTotals());

  return { totals, series };
};
