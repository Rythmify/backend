
const messagesService = require('../services/messages.service');
const { success, error } = require('../utils/api-response');

// POST /messages/new
exports.startConversation = async (req, res) => {
  const senderId = req.user.sub;
  const { recipient_id, body, resource } = req.body;

  if (!recipient_id) {
    return error(res, 'VALIDATION_FAILED', 'recipient_id is required.', 400);
  }

  const { conversation, message, isNew } = await messagesService.startConversation({
    senderId,
    recipientId: recipient_id,
    body,
    resource,
  });

  if (isNew) {
    return success(res, { conversation, message }, 'Conversation created and first message sent.', 201);
  }

  return success(res, { message }, 'Message sent.', 200);
};

// GET /messages/conversations
exports.listConversations = async (req, res) => {
  const userId = req.user.sub;
  const { page, limit } = req.query;

  const data = await messagesService.listConversations({ userId, page, limit });

  return success(res, data, 'Conversations fetched successfully.');
};


// GET /messages/conversations/:conversationId
exports.getConversation = async (req, res) => {
  const userId         = req.user.sub;
  const { conversationId } = req.params;
  const { page, limit }    = req.query;

  const data = await messagesService.getConversation({
    conversationId,
    userId,
    page,
    limit,
  });

  return success(res, data, 'Conversation fetched successfully.');
};


// POST /messages/conversations/:conversationId/messages
exports.sendMessage = async (req, res) => {
  const senderId           = req.user.sub;
  const { conversationId } = req.params;
  const { body, resource } = req.body;

  const message = await messagesService.sendMessage({
    conversationId,
    senderId,
    body,
    resource,
  });

  return success(res, message, 'Message sent.', 201);
};


// GET /messages/unread-count
exports.getUnreadCount = async (req, res) => {
  const userId = req.user.sub;

  const data = await messagesService.getUnreadCount({ userId });

  return success(res, data, 'Unread message count fetched successfully.');
};


// PATCH /messages/conversations/:conversationId/messages/:messageId/read
exports.markMessageReadState = async (req, res) => {
  const userId                       = req.user.sub;
  const { conversationId, messageId } = req.params;
  const { is_read }                  = req.body;

  if (is_read === undefined || is_read === null) {
    return error(res, 'VALIDATION_FAILED', 'is_read is required.', 400);
  }

  if (typeof is_read !== 'boolean') {
    return error(res, 'VALIDATION_FAILED', 'is_read must be a boolean.', 400);
  }

  const data = await messagesService.markMessageReadState({
    conversationId,
    messageId,
    userId,
    isRead: is_read,
  });

  return success(res, data, 'Message read state updated successfully.');
};


// DELETE /messages/conversations/:conversationId/messages/:messageId
exports.deleteMessage = async (req, res) => {
  const userId                        = req.user.sub;
  const { conversationId, messageId } = req.params;

  await messagesService.deleteMessage({ conversationId, messageId, userId });

  return success(res, null, 'Message deleted.');
};