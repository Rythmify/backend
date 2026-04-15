// routes/feed.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/feed.controller');
const authenticate = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// GET /feed
router.get('/', authenticate, asyncHandler(controller.getActivityFeedController));

module.exports = router;
