const db = require('../config/db');

// ------------------------------------------------------------
//Endpoint 1 — Start a new conversation
// ------------------------------------------------------------

// Conversation queries

/**
 * Find an existing conversation between two users.
 * Uses LEAST/GREATEST to normalize pair order in SQL
 */
exports.findConversationByPair = async (userAId, userBId) => {
  const { rows } = await db.query(
    `SELECT * FROM conversations
     WHERE user_a_id = LEAST($1::uuid, $2::uuid)
       AND user_b_id = GREATEST($1::uuid, $2::uuid)`, //userA is recipient if senderId > recipientId, else userA is sender
    [userAId, userBId]
  );
  return rows[0] || null;
};

/**
 * Create a new conversation between two users.
 * Caller must guarantee userAId < userBId (UUID string comparison).
 */
exports.createConversation = async (userAId, userBId) => {
  const { rows } = await db.query(
    `INSERT INTO conversations (user_a_id, user_b_id)
     VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))
     ON CONFLICT (user_a_id, user_b_id) DO NOTHING
     RETURNING *`,
    [userAId, userBId]
  );

  if (rows.length === 0) {
    const existing = await db.query(
      `SELECT * FROM conversations
       WHERE user_a_id = LEAST($1::uuid, $2::uuid)
         AND user_b_id = GREATEST($1::uuid, $2::uuid)`,
      [userAId, userBId]
    );
    return existing.rows[0];
  }

  return rows[0];
};

// ------------------------------------------------------------
// Message queries
// ------------------------------------------------------------

/**
 * Insert a new message into a conversation.
 * content = body (DB stores as 'content', API exposes as 'body') [v3-FIX-21]
 */
exports.createMessage = async ({ conversationId, senderId, body, embedType, embedId }) => {
  const { rows } = await db.query(
    `INSERT INTO messages (conversation_id, sender_id, content, embed_type, embed_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       conversation_id,
       sender_id,
       content  AS body,
       embed_type,
       embed_id,
       is_read,
       created_at`,
    [conversationId, senderId, body ?? null, embedType ?? null, embedId ?? null]
  );
  return rows[0];
};

// Block & preference checks

/**
 * Returns true if blockerID has blocked blockedId.                 ////another module responisbility?? BESHOY
 */
exports.isBlocked = async (blockerId, blockedId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM blocks
     WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return rows.length > 0;
};

/**
 * Returns the recipient's messages_from preference.
 * Possible values: 'everyone' | 'followers_only' | 'nobody'
 * Returns 'everyone' as default if no preference row exists.
 */
exports.getMessagesFromPreference = async (userId) => {
  const { rows } = await db.query(
    `SELECT messages_from FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.messages_from ?? 'everyone';
};

/**
 * Returns true if followerId is following followingId.
 */
exports.isFollowing = async (followerId, followingId) => {
  //another module responisbility?? BESHOY
  const { rows } = await db.query(
    `SELECT 1 FROM follows
     WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return rows.length > 0;
};

/**
 * Returns the user row (id only) if the user exists and is not deleted/suspended.
 */
exports.findActiveUserById = async (userId) => {
  const { rows } = await db.query(
    `SELECT id FROM users
     WHERE id = $1
       AND deleted_at IS NULL
       AND is_suspended = false`,
    [userId]
  );
  return rows[0] || null;
};

// ------------------------------------------------------------
//Endpoint 2 — List all conversations   GET /messages/conversations
// ------------------------------------------------------------

/**
 * Returns paginated conversations for a user, sorted by most recent message.
 * Excludes conversations soft-deleted by this user.
 * Joins partner user info for the response.
 * [DEPENDS: users module] — joins users table for participant info
 */
exports.findConversationsByUserId = async (userId, limit, offset) => {
  const { rows } = await db.query(
    `SELECT
       c.id,
       c.created_at,
       c.last_message_at                         AS updated_at,

       -- Partner user info
       p.id                                      AS participant_id,
       p.display_name                            AS participant_display_name,
       p.profile_picture                         AS participant_avatar,
       p.username                                AS participant_username,

       -- Unread count
       COUNT(m_unread.id)::int                   AS unread_count,

       -- Last message (fetched in same query via subquery)
       lm.id                                     AS last_message_id,
       lm.sender_id                              AS last_message_sender_id,
       lm.content                                AS last_message_body,
       lm.embed_type                             AS last_message_embed_type,
       lm.embed_id                               AS last_message_embed_id,
       lm.is_read                                AS last_message_is_read,
       lm.created_at                             AS last_message_created_at

     FROM conversations c

     -- Join the other participant
     JOIN users p ON p.id = CASE
       WHEN c.user_a_id = $1 THEN c.user_b_id
       ELSE c.user_a_id
     END

     -- Last message per conversation using DISTINCT ON
     LEFT JOIN LATERAL (
       SELECT id, sender_id, content, embed_type, embed_id, is_read, created_at
       FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) lm ON true

     -- Unread messages from partner
     LEFT JOIN messages m_unread
       ON m_unread.conversation_id = c.id
      AND m_unread.is_read = false
      AND m_unread.sender_id != $1

     WHERE
       (c.user_a_id = $1 OR c.user_b_id = $1)
       AND NOT (c.user_a_id = $1 AND c.deleted_by_a = true)
       AND NOT (c.user_b_id = $1 AND c.deleted_by_b = true)
       AND p.deleted_at IS NULL

     GROUP BY c.id, p.id, p.display_name, p.profile_picture, p.username,
              lm.id, lm.sender_id, lm.content, lm.embed_type,
              lm.embed_id, lm.is_read, lm.created_at
     ORDER BY c.last_message_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
};

/**
 * Returns the total count of active conversations for a user.
 * Used for pagination metadata.
 */
exports.countConversationsByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM conversations c
     WHERE
       (c.user_a_id = $1 OR c.user_b_id = $1)
       AND NOT (c.user_a_id = $1 AND c.deleted_by_a = true)
       AND NOT (c.user_b_id = $1 AND c.deleted_by_b = true)`,
    [userId]
  );
  return rows[0].total;
};

// ------------------------------------------------------------
// Endpoint 3 — Get a single conversation    GET /messages/conversations/:conversationId
// ------------------------------------------------------------

/**
 * Find a single conversation by its ID.
 * Returns null if not found.
 */
exports.findConversationById = async (conversationId) => {
  const { rows } = await db.query(
    `SELECT * FROM conversations
     WHERE id = $1`,
    [conversationId]
  );
  return rows[0] || null;
};

/**
 * Returns paginated messages for a conversation, oldest to newest.
 * content aliased as body [v3-FIX-21]
 */
exports.findMessagesByConversationId = async (conversationId, limit, offset) => {
  const { rows } = await db.query(
    `SELECT
       id,
       conversation_id,
       sender_id,
       content    AS body,
       embed_type,
       embed_id,
       is_read,
       created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );
  return rows;
};

/**
 * Returns total message count for a conversation.
 * Used for pagination metadata.
 */
exports.countMessagesByConversationId = async (conversationId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM messages
     WHERE conversation_id = $1`,
    [conversationId]
  );
  return rows[0].total;
};

/**
 * Returns partner user info for a conversation.
 * [DEPENDS: users module] — joins users table
 */
exports.findConversationPartner = async (conversationId, userId) => {
  const { rows } = await db.query(
    `SELECT
       p.id,
       p.display_name,
       p.profile_picture    AS avatar,
       p.username
     FROM conversations c
     JOIN users p ON p.id = CASE
       WHEN c.user_a_id = $2 THEN c.user_b_id
       ELSE c.user_a_id
     END
     WHERE c.id = $1
       AND p.deleted_at IS NULL`,
    [conversationId, userId]
  );
  return rows[0] || null;
};

/**
 * Returns unread message count for a conversation for the current user.
 */
exports.countUnreadMessages = async (conversationId, userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM messages
     WHERE conversation_id = $1
       AND is_read = false
       AND sender_id != $2`,
    [conversationId, userId]
  );
  return rows[0].unread_count;
};

// --------------------------------------------------------------
//Endpoint 4 — Send a message in an existing conversation
//POST /messages/conversations/:conversationId/messages
// ------------------------------------------------------------
//no new models for this endpoint

// ------------------------------------------------------------
// Endpoint 5 — Get total unread message count   GET /messages/unread-count
// ------------------------------------------------------------

/**
 * Returns total unread message count across all active conversations for a user.
 * Excludes soft-deleted conversations for this user.
 */
exports.countTotalUnreadMessages = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(m.id)::int AS unread_count
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE
       m.is_read = false
       AND m.sender_id != $1
       AND (c.user_a_id = $1 OR c.user_b_id = $1)
       AND NOT (c.user_a_id = $1 AND c.deleted_by_a = true)
       AND NOT (c.user_b_id = $1 AND c.deleted_by_b = true)`,
    [userId]
  );
  return rows[0].unread_count;
};

// ------------------------------------------------------------
// Endpoint 6 — Mark a message as read/unread
// PATCH /messages/conversations/:conversationId/messages/:messageId/read
// ------------------------------------------------------------

/**
 * Find a single message by its ID and conversation ID.
 * content aliased as body [v3-FIX-21]
 */
exports.findMessageById = async (messageId, conversationId) => {
  const { rows } = await db.query(
    `SELECT
       id,
       conversation_id,
       sender_id,
       content    AS body,
       embed_type,
       embed_id,
       is_read,
       created_at
     FROM messages
     WHERE id = $1
       AND conversation_id = $2`,
    [messageId, conversationId]
  );
  return rows[0] || null;
};

/**
 * Update the is_read state of a message.
 */
exports.updateMessageReadState = async (messageId, isRead) => {
  const { rows } = await db.query(
    `UPDATE messages
     SET is_read = $2
     WHERE id = $1
     RETURNING
       id,
       conversation_id,
       sender_id,
       content    AS body,
       embed_type,
       embed_id,
       is_read,
       created_at`,
    [messageId, isRead]
  );
  return rows[0] || null;
};

// ------------------------------------------------------------
// Endpoint 7 — Delete a specific message  (delete for eveyone feature --only to ur own messages--)
// DELETE /messages/conversations/:conversationId/messages/:messageId
// ------------------------------------------------------------

/**
 * Hard deletes a message by ID.
 */
exports.deleteMessageById = async (messageId) => {
  await db.query(
    `DELETE FROM messages
     WHERE id = $1`,
    [messageId]
  );
};

// ------------------------------------------------------------
// Endpoint 8 — Delete a conversation (soft delete)
// DELETE /messages/conversations/:conversationId
// ------------------------------------------------------------

/**
 * Soft deletes a conversation for one user by setting their
 * deleted_by_a or deleted_by_b flag to true.
 * DB trigger trg_conversation_purge_on_both_deleted will permanently
 * purge the conversation and all messages if both flags are true.
 */
exports.softDeleteConversation = async (conversationId, isUserA) => {
  const column = isUserA ? 'deleted_by_a' : 'deleted_by_b';
  const { rows } = await db.query(
    `UPDATE conversations
     SET ${column} = true
     WHERE id = $1
     RETURNING *`,
    [conversationId]
  );
  return rows[0] || null;
};

/**
 * Resets the soft-delete flag for a user in a conversation.
 * Called when a user sends a new message after having deleted the conversation.
 */
exports.restoreConversationForUser = async (conversationId, isUserA) => {
  const column = isUserA ? 'deleted_by_a' : 'deleted_by_b';
  await db.query(
    `UPDATE conversations
     SET ${column} = false
     WHERE id = $1`,
    [conversationId]
  );
};
