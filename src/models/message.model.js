

const db = require('../config/db');

// ------------------------------------------------------------
// Conversation queries
// ------------------------------------------------------------

/**
 * Find an existing conversation between two users.
 * Always pass (MIN(id), MAX(id)) — enforced by DB CHECK constraint.
 */
exports.findConversationByPair = async (userAId, userBId) => {
  const { rows } = await db.query(
    `SELECT * FROM conversations
     WHERE user_a_id = $1 AND user_b_id = $2`,              //$1, $2 for security because it prevents SQL injection
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
     VALUES ($1, $2)
     RETURNING *`,
    [userAId, userBId]
  );
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
 * Possible values: 'everyone' | 'followers_only'
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
exports.isFollowing = async (followerId, followingId) => {              //another module responisbility?? BESHOY
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