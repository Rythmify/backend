// ============================================================
// controllers/comment-likes.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const commentLikesService = require('../services/comment-likes.service');
const CommentModel = require('../models/comment.model');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

const normalizeComment = (comment) => {
  if (!comment) return comment;
  return {
    ...comment,
    is_liked_by_me: Boolean(comment.is_liked_by_me),
  };
};

/**
 * POST /comments/{comment_id}/like
 */
exports.likeComment = async (req, res) => {
  const { comment_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await commentLikesService.likeComment(userId, comment_id);

  const commentData = await CommentModel.getComment(comment_id, userId);
  if (!commentData) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Comment liked successfully' : 'Comment already liked';

  return success(res, normalizeComment(commentData), message, statusCode);
};

/**
 * DELETE /comments/{comment_id}/like
 */
exports.unlikeComment = async (req, res) => {
  const { comment_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await commentLikesService.unlikeComment(userId, comment_id);

  const commentData = await CommentModel.getComment(comment_id, userId);
  if (!commentData) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  return success(res, normalizeComment(commentData), 'Comment unliked successfully', 200);
};
