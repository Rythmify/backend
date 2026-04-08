// ============================================================
// routes/followdiscovery.routes.js
// ============================================================
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const controller = require('../controllers/followdiscovery.controller');

// All follow-discovery routes require authentication
router.use(authenticate);

router.get('/suggested', asyncHandler(controller.getSuggestedUsers));
router.get('/suggested/artists', asyncHandler(controller.getSuggestedArtists));

module.exports = router;