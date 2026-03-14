
const express = require('express');
const router = express.Router();
const controller = require('../controllers/messages.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// POST /messages/new — Start a new conversation (or append to existing)
router.post('/new', authenticate, asyncHandler(controller.startConversation));

// GET /messages/conversations — List all conversations
router.get('/conversations', authenticate, asyncHandler(controller.listConversations));

// GET /messages/conversations/:conversationId — Get a single conversation with messages
router.get('/conversations/:conversationId', authenticate, asyncHandler(controller.getConversation));

module.exports = router;