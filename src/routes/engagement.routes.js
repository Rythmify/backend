// ============================================================
// routes/engagement.routes.js
// Owner : Beshoy Maher (BE-3)
// Modules: Module 6 — Engagement & Social Interactions
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/engagement.controller');
const albumLikesController = require('../controllers/album-likes.controller');
const trackLikesController = require('../controllers/track-likes.controller');
const playlistLikesController = require('../controllers/playlist-likes.controller');
const commentLikesController = require('../controllers/comment-likes.controller');
const commentController = require('../controllers/comment.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// Module 6.6 — Comments & Replies

// GET /api/v1/tracks/:track_id/comments
// List paginated top-level comments with optional timestamp filtering and sorting
router.get('/tracks/:track_id/comments', asyncHandler(commentController.getTrackComments));

// POST /api/v1/tracks/:track_id/comments
// Create a new top-level comment on a track
router.post(
  '/tracks/:track_id/comments',
  authenticate,
  asyncHandler(commentController.createComment)
);

// GET /api/v1/comments/:comment_id
// Fetch a single comment by ID
router.get('/comments/:comment_id', asyncHandler(commentController.getComment));

// PATCH /api/v1/comments/:comment_id
// Update a comment (only author can update)
router.patch('/comments/:comment_id', authenticate, asyncHandler(commentController.updateComment));

// DELETE /api/v1/comments/:comment_id
// Delete a comment (only author can delete, cascade deletes all replies)
router.delete('/comments/:comment_id', authenticate, asyncHandler(commentController.deleteComment));

// GET /api/v1/comments/:comment_id/replies
// List paginated replies to a top-level comment
router.get('/comments/:comment_id/replies', asyncHandler(commentController.getCommentReplies));

// POST /api/v1/comments/:comment_id/replies
// Create a reply to a top-level comment
router.post(
  '/comments/:comment_id/replies',
  authenticate,
  asyncHandler(commentController.createReply)
);

module.exports = router;
