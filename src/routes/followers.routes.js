// ============================================================
// routes/followers.routes.js
// Owner : Beshoy Maher (BE-3)
// Modules: Module 3 — Followers & Social Graph
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/followers.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// Specific routes (more specific first)
router.get('/me/following', authenticate, asyncHandler(controller.getMyFollowing));
router.get('/suggested', authenticate, asyncHandler(controller.getSuggestedUsersToFollow));
router.get('/:user_id/follow-status', authenticate, asyncHandler(controller.getFollowStatus));
router.get('/:user_id/following', authenticate, asyncHandler(controller.getFollowing));
router.get('/:user_id/followers', authenticate, asyncHandler(controller.getFollowers));

 module.exports = router;