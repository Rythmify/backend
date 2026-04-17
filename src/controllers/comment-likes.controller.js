// ============================================================
// controllers/comment-likes.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const commentLikesService = require('../services/comment-likes.service');
const CommentService = require('../services/comment.service');
const CommentModel = require('../models/comment.model');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * POST /comments/{comment_id}/like
 * Like a comment (idempotent)
 * Returns: 201 if newly liked, 200 if already liked
 * Response includes updated comment with is_liked_by_me = true
 * Auth: Required
 */
exports.likeComment = async (req, res) => {
  const { comment_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await commentLikesService.likeComment(userId, comment_id);

  // Fetch updated comment with is_liked_by_me flag
  const commentData = await CommentModel.getComment(comment_id);
  if (!commentData) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  // Enrich comment with is_liked_by_me flag (will be true since we just liked it)
  const isLiked = await CommentModel.isCommentLikedByUser(comment_id, userId);
  const enrichedComment = {
    ...commentData,
    is_liked_by_me: isLiked,
  };

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Comment liked successfully' : 'Comment already liked';

  return success(res, enrichedComment, message, statusCode);
};

/**
 * DELETE /comments/{comment_id}/like
 * Unlike a comment
 * Returns: 200 OK with updated comment (is_liked_by_me = false)
 * Auth: Required
 */
exports.unlikeComment = async (req, res) => {
  const { comment_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await commentLikesService.unlikeComment(userId, comment_id);

  // Fetch updated comment with is_liked_by_me flag
  const commentData = await CommentModel.getComment(comment_id);
  if (!commentData) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  // Enrich comment with is_liked_by_me flag (will be false since we just unliked it)
  const isLiked = await CommentModel.isCommentLikedByUser(comment_id, userId);
  const enrichedComment = {
    ...commentData,
    is_liked_by_me: isLiked,
  };

  // Return 200 OK with updated comment
  return success(res, enrichedComment, 'Comment unliked successfully', 200);
};
