// ============================================================
// controllers/comment-likes.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const commentLikesService = require('../services/comment-likes.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * POST /comments/{comment_id}/like
 * Like a comment (idempotent)
 * Returns: 201 if newly liked, 200 if already liked
 * Auth: Required
 */
exports.likeComment = async (req, res) => {
  const { comment_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await commentLikesService.likeComment(userId, comment_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Comment liked successfully' : 'Comment already liked';

  return success(
    res,
    {
      like_id: result.likeId,
      user_id: result.userId,
      comment_id: result.commentId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /comments/{comment_id}/like
 * Unlike a comment
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.unlikeComment = async (req, res) => {
  const { comment_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await commentLikesService.unlikeComment(userId, comment_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};
