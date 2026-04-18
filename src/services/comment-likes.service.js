// ============================================================
// services/comment-likes.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const commentLikeModel = require('../models/comment-like.model');
const AppError = require('../utils/app-error');

/**
 * Like a comment (idempotent operation)
 * Returns:
 *   - 201: Comment newly liked
 *   - 200: Already liked (no change)
 */
exports.likeComment = async (userId, commentId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!commentId || commentId.trim() === '') {
    throw new AppError('Comment ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to like comment
  const { created, like } = await commentLikeModel.likeComment(userId, commentId);

  return {
    likeId: like.id,
    userId: like.user_id,
    commentId: like.comment_id,
    createdAt: like.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Unlike a comment (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.unlikeComment = async (userId, commentId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!commentId || commentId.trim() === '') {
    throw new AppError('Comment ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to unlike comment
  const deleted = await commentLikeModel.unlikeComment(userId, commentId);

  if (!deleted) {
    throw new AppError('Like not found', 404, 'LIKE_NOT_FOUND');
  }

  return true;
};

/**
 * Check if user likes a comment (used for response decoration)
 */
exports.isCommentLikedByUser = async (userId, commentId) => {
  if (!userId) return false;
  return await commentLikeModel.isCommentLikedByUser(userId, commentId);
};

/**
 * Get total like count for a comment
 */
exports.getCommentLikeCount = async (commentId) => {
  if (!commentId) return 0;
  return await commentLikeModel.getCommentLikeCount(commentId);
};
