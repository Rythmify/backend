// ============================================================
// routes/followers.routes.js
// Owner : Beshoy Maher (BE-3)
// Modules: Module 3 — Followers & Social Graph
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/followers.controller');
const blockController = require('../controllers/blockcontroller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// Specific routes (more specific first)
router.get('/me/following', authenticate, asyncHandler(controller.getMyFollowing));
router.get('/suggested', authenticate, asyncHandler(controller.getSuggestedUsersToFollow));
router.get('/:user_id/follow-status', authenticate, asyncHandler(controller.getFollowStatus));
router.post('/:user_id/follow', authenticate, asyncHandler(controller.followUser));
router.delete('/:user_id/follow', authenticate, asyncHandler(controller.unfollowUser));
router.get('/:user_id/following', authenticate, asyncHandler(controller.getFollowing));
router.get('/:user_id/followers', authenticate, asyncHandler(controller.getFollowers));

// Module 3.2 — Follow request flow (private accounts)
// GET /api/v1/users/me/follow-requests
// List pending follow requests TO authenticated user (paginated)
router.get('/me/follow-requests', authenticate, asyncHandler(controller.getPendingFollowRequests));

// POST /api/v1/users/me/follow-requests/:request_id/accept
// Accept a follow request (creates follow relationship)
router.post(
  '/me/follow-requests/:request_id/accept',
  authenticate,
  asyncHandler(controller.acceptFollowRequest)
);

// POST /api/v1/users/me/follow-requests/:request_id/reject
// Reject a follow request (deletes request without creating follow)
router.post(
  '/me/follow-requests/:request_id/reject',
  authenticate,
  asyncHandler(controller.rejectFollowRequest)
);

// DELETE /api/v1/users/me/follow-requests/:request_id
// Cancel a follow request sent by authenticated user
router.delete(
  '/me/follow-requests/:request_id',
  authenticate,
  asyncHandler(controller.cancelFollowRequest)
);

// Module 3.1 — Block relationships
// POST /api/v1/users/:user_id/block
// Block a user (idempotent - 200 if already blocked, 201 if new)
router.post('/:user_id/block', authenticate, asyncHandler(blockController.blockUser));

// DELETE /api/v1/users/:user_id/block
// Unblock a user (204 No Content)
router.delete('/:user_id/block', authenticate, asyncHandler(blockController.unblockUser));

// GET /api/v1/users/me/blocked
// List all users blocked by authenticated user (paginated)
router.get('/me/blocked', authenticate, asyncHandler(blockController.getBlockedUsers));

module.exports = router;
