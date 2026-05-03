// ============================================================
// routes/followdiscovery.routes.js
// ============================================================
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const controller = require('../controllers/followdiscovery.controller');

// All follow-discovery routes require authentication.
// Keep auth on the concrete routes so this router does not intercept other /users paths.
router.get('/suggested', authenticate, asyncHandler(controller.getSuggestedUsers));
router.get('/suggested/artists', authenticate, asyncHandler(controller.getSuggestedArtists));

module.exports = router;
