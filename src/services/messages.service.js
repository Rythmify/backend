
const messageModel = require('../models/message.model');
const AppError = require('../utils/app-error');

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Returns the correctly ordered pair [userAId, userBId]
 * satisfying the DB CHECK (user_a_id < user_b_id).
 */
const orderPair = (idOne, idTwo) => {
  return idOne < idTwo ? [idOne, idTwo] : [idTwo, idOne];
};

// ------------------------------------------------------------
// Endpoint 1 — Start a new conversation
// ------------------------------------------------------------

exports.startConversation = async ({ senderId, recipientId, body, resource }) => {
  // 1. Prevent self-messaging
  if (senderId === recipientId) {
    throw new AppError('You cannot send a message to yourself.', 400, 'MESSAGES_SELF_MESSAGE');
  }

  // 2. Verify recipient exists and is active
  // [DEPENDS: users module] — queries users table
  const recipient = await messageModel.findActiveUserById(recipientId);
  if (!recipient) {
    throw new AppError('Recipient not found.', 404, 'USER_NOT_FOUND');
  }

  // 3. Check if recipient has blocked the sender
  const recipientBlockedSender = await messageModel.isBlocked(recipientId, senderId);
  if (recipientBlockedSender) {
    throw new AppError('You cannot send a message to this user.', 403, 'MESSAGES_BLOCKED');
  }

  // 4. Check recipient's messages_from preference
  // 'followers_only' means the recipient must be following the sender
  const messagesFrom = await messageModel.getMessagesFromPreference(recipientId);
  if (messagesFrom === 'followers_only') {
    const recipientFollowsSender = await messageModel.isFollowing(recipientId, senderId);
    if (!recipientFollowsSender) {
      throw new AppError('This user only accepts messages from people they follow.', 403, 'MESSAGES_FOLLOWERS_ONLY');
    }
  }

  // 5. Validate message content — at least body or resource required
  const hasBody = typeof body === 'string' && body.trim().length > 0;
  const hasResource = resource && resource.type && resource.id;
  if (!hasBody && !hasResource) {
    throw new AppError('A message must contain a body or an embedded resource.', 400, 'MESSAGES_EMPTY');
  }

  // 6. Validate body length
  if (hasBody && body.length > 2000) {
    throw new AppError('Message body must not exceed 2000 characters.', 400, 'MESSAGES_BODY_TOO_LONG');
  }

  // 7. Validate resource type if provided
  // [DEPENDS: tracks/playlists module] — embed_id references tracks or playlists table
  if (hasResource && !['track', 'playlist'].includes(resource.type)) {
    throw new AppError('Embedded resource type must be "track" or "playlist".', 400, 'MESSAGES_INVALID_EMBED_TYPE');
  }

  // 8. Order the pair for the DB constraint (user_a_id < user_b_id)
  const [userAId, userBId] = orderPair(senderId, recipientId);

  // 9. Find or create the conversation
  let conversation = await messageModel.findConversationByPair(userAId, userBId);
  const isNew = !conversation;

  if (isNew) {
    conversation = await messageModel.createConversation(userAId, userBId);         //userA is recipient if senderId > recipientId, else userA is sender
  }

  // 10. Insert the message
  const message = await messageModel.createMessage({
    conversationId: conversation.id,
    senderId,
    body: hasBody ? body.trim() : null,
    embedType: hasResource ? resource.type : null,
    embedId: hasResource ? resource.id : null,
  });

  return { conversation, message, isNew };
};

// ------------------------------------------------------------
// Endpoint 2 — List all conversations   GET /messages/conversations
// ------------------------------------------------------------

exports.listConversations = async ({ userId, page, limit }) => {

  // Sanitize pagination inputs
  const safePage  = Math.max(1, parseInt(page)  || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) ||20));
  const offset    = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    messageModel.findConversationsByUserId(userId, safeLimit, offset),
    messageModel.countConversationsByUserId(userId),
  ]);

  // Fetch last message for each conversation
  const conversations = await Promise.all(
    rows.map(async (row) => {
      const lastMessage = await messageModel.findLastMessageByConversationId(row.id);

      return {
        id: row.id,
        participant: {
          id:            row.participant_id,
          display_name:  row.participant_display_name,
          avatar:        row.participant_avatar ?? null,
          username:      row.participant_username ?? null,
        },
        last_message:  lastMessage ?? null,
        unread_count:  row.unread_count,
        created_at:    row.created_at,
        updated_at:    row.updated_at,
      };
    })
  );

  return {
    items: conversations,
    pagination: {
      page:        safePage,
      limit:       safeLimit,
      total,
      total_pages: Math.ceil(total / safeLimit),
    },
  };
};

// ------------------------------------------------------------
// Endpoint 3 — Get a single conversation with messages   GET /messages/conversations/:conversationId
// ------------------------------------------------------------

exports.getConversation = async ({ conversationId, userId, page, limit }) => {

  // 1. Find conversation
  const conversation = await messageModel.findConversationById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 2. Verify the user is a participant
  const isParticipant = conversation.user_a_id === userId || conversation.user_b_id === userId;
  if (!isParticipant) {
    throw new AppError('You do not have access to this conversation.', 403, 'FORBIDDEN');
  }

  // 3. Check if the user has soft-deleted this conversation
  const deletedByUser =
    (conversation.user_a_id === userId && conversation.deleted_by_a) ||
    (conversation.user_b_id === userId && conversation.deleted_by_b);
  if (deletedByUser) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 4. Sanitize pagination inputs
  const safePage  = Math.max(1, parseInt(page)  || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset    = (safePage - 1) * safeLimit;

  // 5. Fetch messages, partner info, and counts in parallel
  const [messages, total, partner, unreadCount] = await Promise.all([
    messageModel.findMessagesByConversationId(conversationId, safeLimit, offset),
    messageModel.countMessagesByConversationId(conversationId),
    messageModel.findConversationPartner(conversationId, userId),
    messageModel.countUnreadMessages(conversationId, userId),
  ]);

  return {
    conversation: {
      id:           conversation.id,
      participant:  partner,
      unread_count: unreadCount,
      created_at:   conversation.created_at,
      updated_at:   conversation.last_message_at,
    },
    messages,
    pagination: {
      page:        safePage,
      limit:       safeLimit,
      total,
      total_pages: Math.ceil(total / safeLimit),
    },
  };
};