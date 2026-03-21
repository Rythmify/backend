
const express = require('express');
const router = express.Router();
const controller = require('../controllers/messages.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// POST /messages/new — Start a new conversation (or append to existing)
router.post('/new', authenticate, asyncHandler(controller.startConversation));

// POST /messages/conversations/ensure — Create/fetch conversation without sending message
router.post('/conversations/ensure', authenticate, asyncHandler(controller.ensureConversation));

// GET /messages/conversations — List all conversations
router.get('/conversations', authenticate, asyncHandler(controller.listConversations));

// GET /messages/conversations/:conversationId — Get a single conversation with messages
router.get('/conversations/:conversationId', authenticate, asyncHandler(controller.getConversation));

// POST /messages/conversations/:conversationId/messages — Send a message in a conversation
router.post('/conversations/:conversationId/messages', authenticate, asyncHandler(controller.sendMessage));

// GET /messages/unread-count — Get total unread message count
router.get('/unread-count', authenticate, asyncHandler(controller.getUnreadCount));

// PATCH /messages/conversations/:conversationId/messages/:messageId/read — Mark a message as read/unread
router.patch('/conversations/:conversationId/messages/:messageId/read', authenticate, asyncHandler(controller.markMessageReadState));

// DELETE /messages/conversations/:conversationId/messages/:messageId — Delete a specific message
router.delete('/conversations/:conversationId/messages/:messageId', authenticate, asyncHandler(controller.deleteMessage));

// DELETE /messages/conversations/:conversationId — Soft delete a conversation
router.delete('/conversations/:conversationId', authenticate, asyncHandler(controller.deleteConversation));

module.exports = router;