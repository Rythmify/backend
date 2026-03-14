
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