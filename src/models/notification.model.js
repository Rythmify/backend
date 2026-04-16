// ============================================================
// models/notification.model.js — PostgreSQL queries for Notifications
// Entity attributes: Notification_Id, Type, Reference_id, Reference_type, Actor_id, Message, Created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

// Valid notification types — matches DB enum and spec
const VALID_TYPES = ['follow', 'like', 'repost', 'comment'];

/**
 * Create a notification row.
 * Caller is responsible for passing valid enum values and avoiding self-notify.
 */
exports.createNotification = async ({
  userId,
  actionUserId,
  type,
  referenceId = null,
  referenceType = null,
}) => {
  const { rows } = await db.query(
    `INSERT INTO notifications (
       user_id,
       action_user_id,
       type,
       reference_id,
       reference_type,
       is_read,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, false, now())
     RETURNING id, user_id, action_user_id, type, reference_id, reference_type, is_read, created_at`,
    [userId, actionUserId, type, referenceId, referenceType]
  );

  return rows[0];
};

exports.getTrackOwnerId = async (trackId) => {
  const { rows } = await db.query(
    `SELECT user_id
     FROM tracks
     WHERE id = $1
       AND deleted_at IS NULL`,
    [trackId]
  );

  return rows[0]?.user_id || null;
};

exports.getPlaylistOwnerId = async (playlistId) => {
  const { rows } = await db.query(
    `SELECT user_id
     FROM playlists
     WHERE id = $1
       AND deleted_at IS NULL`,
    [playlistId]
  );

  return rows[0]?.user_id || null;
};

exports.getAlbumOwnerId = async (albumId) => {
  const { rows } = await db.query(
    `SELECT user_id
     FROM albums
     WHERE id = $1
       AND deleted_at IS NULL`,
    [albumId]
  );

  return rows[0]?.user_id || null;
};

exports.getCommentOwnerId = async (commentId) => {
  const { rows } = await db.query(
    `SELECT user_id
     FROM comments
     WHERE id = $1
       AND deleted_at IS NULL`,
    [commentId]
  );

  return rows[0]?.user_id || null;
};

// ------------------------------------------------------------
// Endpoint 1 — GET /notifications
// ------------------------------------------------------------

/**
 * Fetch paginated notifications for a user.
 * Joins users table to get actor info (who triggered the notification).
 * Supports optional type filter — not in spec but needed for UI dropdown.
 *
 * @param {string}  userId
 * @param {object}  opts
 * @param {boolean} opts.unreadOnly  - only return unread notifications
 * @param {string}  opts.type        - filter by notification type (follow/like/repost/comment)
 * @param {number}  opts.limit
 * @param {number}  opts.offset
 */
exports.findNotifications = async (userId, { unreadOnly, type, limit, offset }) => {
  const params = [userId];
  let idx = 2;
  let where = `WHERE n.user_id = $1`;

  if (unreadOnly === true) {
    where += ` AND n.is_read = false`;
  } else if (unreadOnly === false) {
    where += ` AND n.is_read = true`;
  }

  // [UI EXTENSION] type filter — not in spec but required for FE dropdown
  if (type && VALID_TYPES.includes(type)) {
    where += ` AND n.type = $${idx++}`;
    params.push(type);
  }

  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT
       n.id,
       n.type,
       n.reference_type   AS resource_type,
       n.reference_id     AS resource_id,
       n.is_read,
       n.created_at,
       -- Actor (who triggered this notification)
       u.id               AS actor_id,
       u.username         AS actor_username,
       u.display_name     AS actor_display_name,
       u.profile_picture  AS actor_avatar
     FROM notifications n
     LEFT JOIN users u ON n.action_user_id = u.id
     ${where}
     ORDER BY n.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return rows;
};

exports.countNotifications = async (userId, { unreadOnly, type }) => {
  const params = [userId];
  let idx = 2;
  let where = `WHERE n.user_id = $1`;

  if (unreadOnly === true) {
    where += ` AND n.is_read = false`;
  } else if (unreadOnly === false) {
    where += ` AND n.is_read = true`;
  }

  if (type && VALID_TYPES.includes(type)) {
    where += ` AND n.type = $${idx++}`;
    params.push(type);
  }

  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM notifications n
     ${where}`,
    params
  );

  return rows[0].total;
};

/**
 * Count unread notifications for badge counters.
 * This intentionally ignores pagination and type filters.
 */
exports.countUnread = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM notifications
     WHERE user_id = $1
       AND is_read = false`,
    [userId]
  );

  return rows[0].total;
};
