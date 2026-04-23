// ============================================================
// models/notification.model.js — PostgreSQL queries for Notifications
// Entity attributes: Notification_Id, Type, Reference_id, Reference_type, Actor_id, Message, Created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');
const {
  emitNotificationCreated,
  emitNotificationRead,
} = require('../sockets/notifications.socket');

// Valid notification types — matches DB enum and spec
const VALID_TYPES = ['follow', 'like', 'repost', 'comment', 'new_post_by_followed'];

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

  const created = rows[0];

  emitNotificationCreated({
    userId,
    notification: {
      id: created.id,
      type: created.type,
      resource_type: created.reference_type || null,
      resource_id: created.reference_id || null,
      is_read: created.is_read,
      created_at: created.created_at,
      action_user_id: created.action_user_id,
    },
  });

  return created;
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

exports.getUserEmailNotificationSettings = async (userId) => {
  const { rows } = await db.query(
    `SELECT
       u.id,
       u.email,
       u.display_name,
       u.username,
       COALESCE(np.new_message_email, false)         AS new_message_email,
       COALESCE(np.new_follower_email, false)        AS new_follower_email,
      COALESCE(np.new_post_by_followed_email, false) AS new_post_by_followed_email,
       COALESCE(np.likes_and_plays_email, false)     AS likes_and_plays_email,
       COALESCE(np.comment_on_post_email, false)     AS comment_on_post_email,
       COALESCE(np.repost_of_your_post_email, false) AS repost_of_your_post_email
     FROM users u
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE u.id = $1
       AND u.deleted_at IS NULL`,
    [userId]
  );

  return rows[0] || null;
};

exports.getUserEmailIdentity = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, email, display_name, username
     FROM users
     WHERE id = $1
       AND deleted_at IS NULL`,
    [userId]
  );

  return rows[0] || null;
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

  // type filter
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
       u.profile_picture  AS actor_avatar,
       -- Resource Details (Added joins)
       t.title AS track_title,
       p.name AS playlist_title,
       c.content AS comment_content
     FROM notifications n
     LEFT JOIN users u ON n.action_user_id = u.id
     LEFT JOIN tracks t ON (n.reference_type = 'track' AND n.reference_id = t.id AND t.deleted_at IS NULL)
     LEFT JOIN playlists p ON (n.reference_type = 'playlist' AND n.reference_id = p.id AND p.deleted_at IS NULL)
     LEFT JOIN comments c ON (n.reference_type = 'comment' AND n.reference_id = c.id AND c.deleted_at IS NULL)
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

// ============================================================
// ENDPOINT 2 — GET /notifications/UNREAD-COUNT
// ============================================================
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

// ============================================================
// ENDPOINT 3 — PATCH /notifications/:notification_id/read
// ============================================================

/**
 * Find a single notification by ID.
 * Used to verify existence and ownership before marking as read.
 */
exports.findNotificationById = async (notificationId) => {
  const { rows } = await db.query(
    `SELECT
       id,
       user_id,
       type,
       reference_type AS resource_type,
       reference_id   AS resource_id,
       is_read,
       created_at
     FROM notifications
     WHERE id = $1`,
    [notificationId]
  );
  return rows[0] || null;
};

/**
 * Mark a single notification as read.
 * Returns the updated notification row.
 */
exports.markAsRead = async (notificationId) => {
  const { rows } = await db.query(
    `UPDATE notifications
     SET is_read = true
     WHERE id = $1
     RETURNING
       id,
       user_id,
       type,
       reference_type AS resource_type,
       reference_id   AS resource_id,
       is_read,
       created_at`,
    [notificationId]
  );

  const updated = rows[0] || null;
  if (updated) {
    emitNotificationRead({
      userId: updated.user_id,
      notificationId: updated.id,
    });
  }

  return updated;
};

// ============================================================
// ENDPOINT 4 — GET /notifications/preferences
// ENDPOINT 5 — PATCH /notifications/preferences
// ============================================================

// All valid preference columns in the DB.
// Used for both formatting responses and validating PATCH fields.
// [NOTE] messages_from is a special enum field (everyone/followers_only)
//        not a boolean — handled separately in the service.
const PREFERENCE_BOOLEAN_FIELDS = [
  'new_follower_in_app',
  'new_follower_push',
  'new_follower_email',
  'repost_of_your_post_in_app',
  'repost_of_your_post_push',
  'repost_of_your_post_email',
  'new_post_by_followed_in_app',
  'new_post_by_followed_push',
  'new_post_by_followed_email',
  'likes_and_plays_in_app',
  'likes_and_plays_push',
  'likes_and_plays_email',
  'comment_on_post_in_app',
  'comment_on_post_push',
  'comment_on_post_email',
  'recommended_content_in_app',
  'recommended_content_push',
  'recommended_content_email',
  'new_message_in_app',
  'new_message_push',
  'new_message_email',
  'feature_updates_push',
  'feature_updates_email',
  'surveys_and_feedback_push',
  'surveys_and_feedback_email',
  'promotional_content_push',
  'promotional_content_email',
  'newsletter_email',
];

const MESSAGES_FROM_VALUES = ['everyone', 'followers_only', 'nobody'];

// Export for use in service validation
exports.PREFERENCE_BOOLEAN_FIELDS = PREFERENCE_BOOLEAN_FIELDS;
exports.MESSAGES_FROM_VALUES = MESSAGES_FROM_VALUES;

/**
 * Get notification preferences for a user.
 * Auto-creates a row with defaults if one doesn't exist yet
 * (handles the case where user was created before preferences row was seeded).
 */
exports.findOrCreatePreferences = async (userId) => {
  // Try to find existing row
  const { rows } = await db.query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [
    userId,
  ]);

  if (rows[0]) return rows[0];

  // Auto-create with all defaults — DB defaults handle everything
  const { rows: created } = await db.query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  );

  // If INSERT raced with another request, just fetch the existing row
  if (created[0]) return created[0];

  const { rows: fetched } = await db.query(
    `SELECT * FROM notification_preferences WHERE user_id = $1`,
    [userId]
  );

  return fetched[0];
};

/**
 * Get notification preferences for a user without creating a row.
 * Used by PATCH endpoint to enforce explicit row existence.
 */
exports.findPreferencesByUserId = async (userId) => {
  const { rows } = await db.query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [
    userId,
  ]);

  return rows[0] || null;
};

/**
 * Partially update notification preferences.
 * Only updates fields that are explicitly provided.
 * Uses dynamic query building — same pattern as updatePlaylist.
 *
 * @param {string} userId
 * @param {object} fields - key/value pairs of columns to update
 */
exports.updatePreferences = async (userId, fields) => {
  const updates = [];
  const params = [];

  for (const [key, value] of Object.entries(fields)) {
    params.push(value);
    updates.push(`"${key}" = $${params.length}`);
  }

  // Always bump updated_at
  updates.push(`updated_at = now()`);

  params.push(userId);

  const { rows } = await db.query(
    `UPDATE notification_preferences
     SET ${updates.join(', ')}
     WHERE user_id = $${params.length}
     RETURNING *`,
    params
  );

  return rows[0];
};

/**
 * Returns all follower IDs for a given user.
 * Used to fan-out "new post" notifications.
 */
exports.getFollowerIds = async (userId) => {
  const { rows } = await db.query(`SELECT follower_id FROM follows WHERE following_id = $1`, [
    userId,
  ]);
  return rows.map((r) => r.follower_id);
};
