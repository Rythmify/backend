const CommentService = require('../services/comment.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');

const normalizeComment = (comment) => {
  if (!comment) return comment;
  return {
    ...comment,
    is_liked_by_me: Boolean(comment.is_liked_by_me),
  };
};

class CommentController {
  /**
   * GET /tracks/{track_id}/comments
   */
  static getTrackComments = asyncHandler(async (req, res) => {
    const { track_id: trackId } = req.params;
    const { limit = 20, offset = 0, timestamp_from, timestamp_to, sort = 'newest' } = req.query;
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;

    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    const tsFrom = timestamp_from ? parseInt(timestamp_from, 10) : null;
    const tsTo = timestamp_to ? parseInt(timestamp_to, 10) : null;

    const result = await CommentService.getTrackComments(
      trackId,
      limitNum,
      offsetNum,
      tsFrom,
      tsTo,
      sort,
      userId
    );

    const normalizedComments = result.comments.map(normalizeComment);

    return success(res, normalizedComments, 'Comments fetched', 200, {
      limit: limitNum,
      offset: offsetNum,
      total: result.total,
    });
  });

  /**
   * POST /tracks/{track_id}/comments
   */
  static createComment = asyncHandler(async (req, res) => {
    const { track_id: trackId } = req.params;
    const { content, track_timestamp } = req.body;
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;

    const comment = await CommentService.createComment(userId, trackId, content, track_timestamp);

    // تأكيد إن الكومنت الجديد راجع مظبوط
    return success(res, normalizeComment(comment), 'Comment posted', 201);
  });

  static getComment = asyncHandler(async (req, res) => {
    const comment = await CommentService.getComment(req.params.comment_id, req.user?.id);
    return success(res, normalizeComment(comment), 'Comment fetched', 200);
  });

  static updateComment = asyncHandler(async (req, res) => {
    const updated = await CommentService.updateComment(
      req.params.comment_id,
      req.user.id,
      req.body.content
    );
    return success(res, normalizeComment(updated), 'Comment updated', 200);
  });

  static deleteComment = asyncHandler(async (req, res) => {
    await CommentService.deleteComment(req.params.comment_id, req.user.id);
    return success(res, null, 'Comment deleted', 204);
  });

  static getCommentReplies = asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const result = await CommentService.getCommentReplies(
      req.params.comment_id,
      parseInt(limit, 10),
      parseInt(offset, 10),
      req.user?.id
    );

    const normalizedReplies = result.comments.map(normalizeComment);

    return success(res, normalizedReplies, 'Replies fetched', 200, { total: result.total });
  });

  static createReply = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id; // Add the fallback here
  const reply = await CommentService.createReply(
    userId,
    req.params.comment_id,
    req.body.content
  );
  return success(res, normalizeComment(reply), 'Reply posted', 201);
  });
}

module.exports = CommentController;
