const messageModel = require('../models/message.model');
const AppError = require('../utils/app-error');
const { validate: isUuid } = require('uuid');
const emailNotificationsService = require('./email-notifications.service');
const pushNotificationsService = require('./push-notifications.service');

const ALLOWED_EMBED_TYPES = ['track', 'playlist'];

const logNotificationFailure = (channel, err) => {
  console.error(`[Messages] ${channel} notification failed:`, err?.message || err);
};

const sendDirectMessageNotifications = ({
  conversationId,
  senderId,
  recipientId,
  messageBody,
  embedType,
}) => {
  emailNotificationsService
    .sendDirectMessageEmailIfEligible({
      conversationId,
      senderId,
      recipientId,
    })
    .catch((err) => logNotificationFailure('Email', err));

  pushNotificationsService
    .sendDirectMessagePushIfEligible({
      conversationId,
      senderId,
      recipientId,
      messageBody,
      embedType,
    })
    .catch((err) => logNotificationFailure('Push', err));
};

const validateSenderId = (senderId) => {
  if (!senderId) {
    throw new AppError('Authenticated sender is required.', 401, 'UNAUTHORIZED');
  }
};

const validateMessagePayload = async ({ body, resource, requireContent = true }) => {
  const normalizedBody = typeof body === 'string' ? body.trim() : '';

  if (normalizedBody && normalizedBody.length > 2000) {
    throw new AppError(
      'Message body must not exceed 2000 characters.',
      400,
      'MESSAGES_BODY_TOO_LONG'
    );
  }

  let normalizedResource = null;
  if (resource !== undefined && resource !== null) {
    if (typeof resource !== 'object' || Array.isArray(resource)) {
      throw new AppError(
        'Embedded resource must be an object with type and id.',
        400,
        'MESSAGES_INVALID_EMBED_RESOURCE'
      );
    }

    const type = typeof resource.type === 'string' ? resource.type.trim().toLowerCase() : '';
    const id = typeof resource.id === 'string' ? resource.id.trim() : '';

    if (!type || !id) {
      throw new AppError(
        'Embedded resource must include both type and id.',
        400,
        'MESSAGES_INVALID_EMBED_RESOURCE'
      );
    }

    if (!ALLOWED_EMBED_TYPES.includes(type)) {
      throw new AppError(
        'Embedded resource type must be "track" or "playlist".',
        400,
        'MESSAGES_INVALID_EMBED_TYPE'
      );
    }

    if (!isUuid(id)) {
      throw new AppError(
        'Embedded resource id must be a valid UUID.',
        400,
        'MESSAGES_INVALID_EMBED_ID'
      );
    }

    if (type === 'track') {
      const tracksService = require('./tracks.service');
      try {
        await tracksService.getTrackById(id);
      } catch (err) {
        if (err?.code === 'TRACK_NOT_FOUND') {
          throw new AppError('Embedded track not found.', 404, 'MESSAGES_EMBED_TRACK_NOT_FOUND');
        }
        throw err;
      }
    }

    normalizedResource = { type, id };
  }

  if (requireContent && !normalizedBody && !normalizedResource) {
    throw new AppError(
      'A message must contain a body or an embedded resource.',
      400,
      'MESSAGES_EMPTY'
    );
  }

  return {
    body: normalizedBody || null,
    resource: normalizedResource,
  };
};

const assertRecipientCanReceiveMessagesFromSender = async ({ senderId, recipientId }) => {
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
  const messagesFrom = await messageModel.getMessagesFromPreference(recipientId);
  if (messagesFrom === 'nobody') {
    throw new AppError('This user does not accept messages from anyone.', 403, 'MESSAGES_DISABLED');
  }
  if (messagesFrom === 'followers_only') {
    const recipientFollowsSender = await messageModel.isFollowing(recipientId, senderId);
    if (!recipientFollowsSender) {
      throw new AppError(
        'This user only accepts messages from people they follow.',
        403,
        'MESSAGES_FOLLOWERS_ONLY'
      );
    }
  }
};

exports.assertConversationAccess = async ({ conversationId, userId, allowSoftDeleted = false }) => {
  const conversation = await messageModel.findConversationById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  const isParticipant = conversation.user_a_id === userId || conversation.user_b_id === userId;
  if (!isParticipant) {
    throw new AppError('You do not have access to this conversation.', 403, 'FORBIDDEN');
  }

  if (!allowSoftDeleted) {
    const deletedByUser =
      (conversation.user_a_id === userId && conversation.deleted_by_a) ||
      (conversation.user_b_id === userId && conversation.deleted_by_b);
    if (deletedByUser) {
      throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
    }
  }

  return conversation;
};

// ------------------------------------------------------------
// Endpoint 1 — Start a new conversation
// ------------------------------------------------------------

exports.startConversation = async ({ senderId, recipientId, body, resource }) => {
  validateSenderId(senderId);
  await assertRecipientCanReceiveMessagesFromSender({ senderId, recipientId });

  const payload = await validateMessagePayload({ body, resource, requireContent: true });

  // 8. Order the pair for the DB constraint (user_a_id < user_b_id)
  const conversationBefore = await messageModel.findConversationByPair(senderId, recipientId);
  const isNew = !conversationBefore;
  const conversation = isNew
    ? await messageModel.createConversation(senderId, recipientId)
    : conversationBefore;

  // 9. Insert the message
  const message = await messageModel.createMessage({
    conversationId: conversation.id,
    senderId,
    body: payload.body,
    embedType: payload.resource?.type ?? null,
    embedId: payload.resource?.id ?? null,
  });

  sendDirectMessageNotifications({
    conversationId: conversation.id,
    senderId,
    recipientId,
    messageBody: payload.body,
    embedType: payload.resource?.type ?? null,
  });

  return { conversation, message, isNew };
};

// ------------------------------------------------------------
// Mobile helper — Ensure one-to-one conversation exists without sending a message
// ------------------------------------------------------------

exports.ensureConversation = async ({ senderId, recipientId }) => {
  validateSenderId(senderId);
  await assertRecipientCanReceiveMessagesFromSender({ senderId, recipientId });

  const conversationBefore = await messageModel.findConversationByPair(senderId, recipientId);
  const isNew = !conversationBefore;

  const conversation = isNew
    ? await messageModel.createConversation(senderId, recipientId)
    : conversationBefore;

  const senderIsUserA = conversation.user_a_id === senderId;
  const deletedBySender =
    (senderIsUserA && conversation.deleted_by_a) || (!senderIsUserA && conversation.deleted_by_b);

  if (deletedBySender) {
    await messageModel.restoreConversationForUser(conversation.id, senderIsUserA);
  }

  return { conversation, isNew };
};

// ------------------------------------------------------------
// Endpoint 2 — List all conversations   GET /messages/conversations
// ------------------------------------------------------------

exports.listConversations = async ({ userId, page, limit }) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    messageModel.findConversationsByUserId(userId, safeLimit, offset),
    messageModel.countConversationsByUserId(userId),
  ]);

  // No N+1 — last message is already included in each row
  const conversations = rows.map((row) => ({
    id: row.id,
    participant: {
      id: row.participant_id,
      display_name: row.participant_display_name,
      avatar: row.participant_avatar ?? null,
      username: row.participant_username ?? null,
    },
    last_message: row.last_message_id
      ? {
          id: row.last_message_id,
          conversation_id: row.id,
          sender_id: row.last_message_sender_id,
          body: row.last_message_body ?? null,
          embed_type: row.last_message_embed_type ?? null,
          embed_id: row.last_message_embed_id ?? null,
          is_read: row.last_message_is_read,
          created_at: row.last_message_created_at,
        }
      : null,
    unread_count: row.unread_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return {
    items: conversations,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: Math.ceil(total / safeLimit),
    },
  };
};

// ------------------------------------------------------------
// Endpoint 3 — Get a single conversation with messages   GET /messages/conversations/:conversationId
// ------------------------------------------------------------

exports.getConversation = async ({ conversationId, userId, page, limit, offset: rawOffset }) => {
  const conversationActivity = require('../utils/conversation-activity');

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

  // Mark as active for push-notification suppression (best-effort)
  conversationActivity.markActive({ userId, conversationId });

  // 4. Sanitize pagination inputs
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
  let offset;
  if (rawOffset !== undefined && rawOffset !== null) {
    // Direct offset — frontend calculated max(0, total - limit) to load latest
    offset = Math.max(0, parseInt(rawOffset) || 0);
  } else {
    const safePage = Math.max(1, parseInt(page) || 1);
    offset = (safePage - 1) * safeLimit;
  }

  // 5. Fetch messages, partner info, and counts in parallel
  const [messages, total, partner, unreadCount] = await Promise.all([
    messageModel.findMessagesByConversationId(conversationId, safeLimit, offset),
    messageModel.countMessagesByConversationId(conversationId),
    messageModel.findConversationPartner(conversationId, userId),
    messageModel.countUnreadMessages(conversationId, userId),
  ]);

  return {
    conversation: {
      id: conversation.id,
      participant: partner,
      unread_count: unreadCount,
      created_at: conversation.created_at,
      updated_at: conversation.last_message_at,
    },
    messages,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: Math.ceil(total / safeLimit),
    },
  };
};

// ------------------------------------------------------------
// Endpoint 4 — Send a message in an existing conversation
// POST /messages/conversations/:conversationId/messages
// ------------------------------------------------------------

exports.sendMessage = async ({ conversationId, senderId, body, resource }) => {
  validateSenderId(senderId);

  // 1. Find conversation
  const conversation = await messageModel.findConversationById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 2. Verify sender is a participant
  const isParticipant = conversation.user_a_id === senderId || conversation.user_b_id === senderId;
  if (!isParticipant) {
    throw new AppError('You do not have access to this conversation.', 403, 'FORBIDDEN');
  }

  // 3. Identify participants for restore checks below
  const senderIsUserA = conversation.user_a_id === senderId;
  const recipientId = senderIsUserA ? conversation.user_b_id : conversation.user_a_id;

  // 4. Restore conversation for sender if they had soft-deleted it
  const deletedBySender =
    (senderIsUserA && conversation.deleted_by_a) || (!senderIsUserA && conversation.deleted_by_b);
  if (deletedBySender) {
    await messageModel.restoreConversationForUser(conversationId, senderIsUserA);
  }

  // 5. Restore conversation for recipient if they had soft-deleted it
  const recipientIsUserA = conversation.user_a_id === recipientId;
  const deletedByRecipient =
    (recipientIsUserA && conversation.deleted_by_a) ||
    (!recipientIsUserA && conversation.deleted_by_b);

  if (deletedByRecipient) {
    await messageModel.restoreConversationForUser(conversationId, recipientIsUserA);
  }

  // 6. Check if recipient has blocked the sender
  const recipientBlockedSender = await messageModel.isBlocked(recipientId, senderId);
  if (recipientBlockedSender) {
    throw new AppError('You cannot send a message to this user.', 403, 'MESSAGES_BLOCKED');
  }

  // 7. Check recipient's messages_from preference
  // 'followers_only' means the recipient must be following the sender
  const messagesFrom = await messageModel.getMessagesFromPreference(recipientId);
  if (messagesFrom === 'nobody') {
    throw new AppError('This user does not accept messages from anyone.', 403, 'MESSAGES_DISABLED');
  }
  if (messagesFrom === 'followers_only') {
    const recipientFollowsSender = await messageModel.isFollowing(recipientId, senderId);
    if (!recipientFollowsSender) {
      throw new AppError(
        'This user only accepts messages from people they follow.',
        403,
        'MESSAGES_FOLLOWERS_ONLY'
      );
    }
  }

  const payload = await validateMessagePayload({ body, resource, requireContent: true });

  // 11. Insert the message
  const message = await messageModel.createMessage({
    conversationId,
    senderId,
    body: payload.body,
    embedType: payload.resource?.type ?? null,
    embedId: payload.resource?.id ?? null,
  });

  sendDirectMessageNotifications({
    conversationId,
    senderId,
    recipientId,
    messageBody: payload.body,
    embedType: payload.resource?.type ?? null,
  });

  return message;
};

// ------------------------------------------------------------
// Endpoint 5 — Get total unread message count
// GET /messages/unread-count
// ------------------------------------------------------------

exports.getUnreadCount = async ({ userId }) => {
  const unreadCount = await messageModel.countTotalUnreadMessages(userId);
  return { unread_count: unreadCount };
};

// ------------------------------------------------------------
// Endpoint 6 — Mark a message as read/unread
// PATCH /messages/conversations/:conversationId/messages/:messageId/read
// ------------------------------------------------------------

exports.markMessageReadState = async ({ conversationId, messageId, userId, isRead }) => {
  const conversationActivity = require('../utils/conversation-activity');

  // 1. Find conversation
  const conversation = await messageModel.findConversationById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 2. Verify user is a participant
  const isParticipant = conversation.user_a_id === userId || conversation.user_b_id === userId;
  if (!isParticipant) {
    throw new AppError('You do not have access to this conversation.', 403, 'FORBIDDEN');
  }

  // 3. Find the message
  const message = await messageModel.findMessageById(messageId, conversationId);
  if (!message) {
    throw new AppError('Message not found.', 404, 'MESSAGE_NOT_FOUND');
  }

  // 4. Only the recipient can change read state — not the sender
  if (message.sender_id === userId) {
    throw new AppError('You cannot change the read state of your own message.', 403, 'FORBIDDEN');
  }

  // Mark as active for push-notification suppression (best-effort)
  conversationActivity.markActive({ userId, conversationId });

  // 5. Check if already in the requested state — 409 conflict
  if (message.is_read === isRead) {
    throw new AppError(
      `Message is already marked as ${isRead ? 'read' : 'unread'}.`,
      409,
      'MESSAGES_READ_STATE_CONFLICT'
    );
  }

  // 6. Update the read state
  await messageModel.updateMessageReadState(messageId, isRead);

  // 7. Recalculate unread count for this conversation for the response
  const unreadCount = await messageModel.countUnreadMessages(conversationId, userId);

  return {
    message_id: messageId,
    is_read: isRead,
    conversation_unread_count: unreadCount,
  };
};

// ------------------------------------------------------------
// Endpoint 7 — Delete a specific message  (delete for eveyone feature --only to ur own messages--)
// DELETE /messages/conversations/:conversationId/messages/:messageId
// ------------------------------------------------------------

exports.deleteMessage = async ({ conversationId, messageId, userId }) => {
  // 1. Find conversation
  const conversation = await messageModel.findConversationById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 2. Verify user is a participant
  const isParticipant = conversation.user_a_id === userId || conversation.user_b_id === userId;
  if (!isParticipant) {
    throw new AppError('You do not have access to this conversation.', 403, 'FORBIDDEN');
  }

  // 3. Find the message
  const message = await messageModel.findMessageById(messageId, conversationId);
  if (!message) {
    throw new AppError('Message not found.', 404, 'MESSAGE_NOT_FOUND');
  }

  // 4. Only the original sender can delete their own message
  if (message.sender_id !== userId) {
    throw new AppError('You can only delete your own messages.', 403, 'FORBIDDEN');
  }

  // 5. Hard delete the message
  await messageModel.deleteMessageById(messageId);
};

// ------------------------------------------------------------
// Endpoint 8 — Delete a conversation (soft delete)
// DELETE /messages/conversations/:conversationId
// ------------------------------------------------------------

exports.deleteConversation = async ({ conversationId, userId }) => {
  // 1. Find conversation
  const conversation = await messageModel.findConversationById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 2. Verify user is a participant
  const isUserA = conversation.user_a_id === userId;
  const isUserB = conversation.user_b_id === userId;
  if (!isUserA && !isUserB) {
    throw new AppError('You do not have access to this conversation.', 403, 'FORBIDDEN');
  }

  // 3. Check if user has already soft-deleted this conversation
  const alreadyDeleted =
    (isUserA && conversation.deleted_by_a) || (isUserB && conversation.deleted_by_b);
  if (alreadyDeleted) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }

  // 4. Soft delete for this user
  // If both users have now deleted, DB trigger trg_conversation_purge_on_both_deleted
  // will automatically purge all messages and the conversation row
  await messageModel.softDeleteConversation(conversationId, isUserA);
};
