// ============================================================
// models/admin-track.model.js
// Admin moderation queries for tracks
// Keeps moderation SQL out of service layer
// ============================================================

const db = require('../config/db');

const PERIOD_INTERVALS = {
  day: '1 day',
  week: '7 days',
  month: '30 days',
};

exports.getTrackById = async (trackId) => {
  const { rows } = await db.query(
    `SELECT id, user_id, is_hidden, deleted_at
     FROM tracks
     WHERE id = $1
       AND deleted_at IS NULL`,
    [trackId]
  );

  return rows[0] || null;
};

exports.softDeleteTrack = async (trackId) => {
  const { rows } = await db.query(
    `UPDATE tracks
     SET deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id`,
    [trackId]
  );

  return rows[0] || null;
};

exports.updateTrackHiddenStatus = async (trackId, isHidden) => {
  const { rows } = await db.query(
    `UPDATE tracks
     SET is_hidden = $2,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, is_hidden, updated_at`,
    [trackId, isHidden]
  );

  return rows[0] || null;
};

exports.getTotalTracksCount = async (period = 'month') => {
  const intervalValue = PERIOD_INTERVALS[period] || PERIOD_INTERVALS.month;

  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM tracks
     WHERE deleted_at IS NULL
       AND created_at >= NOW() - $1::interval`,
    [intervalValue]
  );

  return rows[0]?.total || 0;
};

exports.getTotalPlaysCount = async (period = 'month') => {
  const intervalValue = PERIOD_INTERVALS[period] || PERIOD_INTERVALS.month;

  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM listening_history
     WHERE played_at >= NOW() - $1::interval`,
    [intervalValue]
  );

  return rows[0]?.total || 0;
};
