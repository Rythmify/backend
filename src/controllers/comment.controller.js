const CommentService = require('../services/comment.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');

class CommentController {
  /**
   * GET /tracks/{track_id}/comments
   * List paginated top-level comments with optional timestamp filtering and sorting.
   */
  static getTrackComments = asyncHandler(async (req, res) => {
    const { track_id: trackId } = req.params;
    const { limit = 20, offset = 0, timestamp_from, timestamp_to, sort = 'newest' } = req.query;

    // Extract user ID (might be null for unauthenticated requests)
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;

    // Validate pagination
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 1 || limitNum > 100 || offsetNum < 0) {
      throw new AppError('Limit must be 1-100, offset must be >= 0', 400, 'VALIDATION_FAILED');
    }

    // Validate and parse timestamp filters
    let timestampFrom = null;
    let timestampTo = null;

    if (timestamp_from !== undefined) {
      timestampFrom = parseInt(timestamp_from, 10);
      if (isNaN(timestampFrom) || timestampFrom < 0) {
        throw new AppError(
          'timestamp_from must be a non-negative integer',
          400,
          'VALIDATION_FAILED'
        );
      }
    }

    if (timestamp_to !== undefined) {
      timestampTo = parseInt(timestamp_to, 10);
      if (isNaN(timestampTo) || timestampTo < 0) {
        throw new AppError('timestamp_to must be a non-negative integer', 400, 'VALIDATION_FAILED');
      }
    }

    const result = await CommentService.getTrackComments(
      trackId,
      limitNum,
      offsetNum,
      timestampFrom,
      timestampTo,
      sort,
      userId
    );

    return success(res, result.comments, 'Track comments fetched successfully', 200, {
      limit: limitNum,
      offset: offsetNum,
      total: result.total,
    });
  });

  /**
   * POST /tracks/{track_id}/comments
   * Create a new top-level comment on a track.
   * Requires: authentication
   */
  static createComment = asyncHandler(async (req, res) => {
    const { track_id: trackId } = req.params;
    const { content, track_timestamp: trackTimestamp } = req.body;

    // Verify authentication
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;
    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const normalizedTrackTimestamp =
      trackTimestamp === undefined || trackTimestamp === null
        ? trackTimestamp
        : Number(trackTimestamp);

    const comment = await CommentService.createComment(
      userId,
      trackId,
      content,
      normalizedTrackTimestamp
    );

    return success(res, comment, 'Comment posted successfully', 201);
  });

  /**
   * GET /comments/{comment_id}
   * Fetch a single comment by ID.
   */
  static getComment = asyncHandler(async (req, res) => {
    const { comment_id: commentId } = req.params;
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;

    const comment = await CommentService.getComment(commentId, userId);

    return success(res, comment, 'Comment fetched successfully', 200);
  });

  /**
   * PATCH /comments/{comment_id}
   * Update a comment (only author can update).
   * Requires: authentication & ownership
   */
  static updateComment = asyncHandler(async (req, res) => {
    const { comment_id: commentId } = req.params;
    const { content } = req.body;

    // Verify authentication
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;
    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const updated = await CommentService.updateComment(commentId, userId, content);

    return success(res, updated, 'Comment updated successfully', 200);
  });

  /**
   * DELETE /comments/{comment_id}
   * Delete a comment and all nested replies (only author can delete).
   * Requires: authentication & ownership
   */
  static deleteComment = asyncHandler(async (req, res) => {
    const { comment_id: commentId } = req.params;

    // Verify authentication
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;
    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    await CommentService.deleteComment(commentId, userId);

    return success(res, null, 'Comment deleted successfully', 204);
  });

  /**
   * GET /comments/{comment_id}/replies
   * List paginated replies to a top-level comment.
   * Replies ordered by creation time (oldest first).
   */
  static getCommentReplies = asyncHandler(async (req, res) => {
    const { comment_id: commentId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;

    // Validate pagination
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 1 || limitNum > 100 || offsetNum < 0) {
      throw new AppError('Limit must be 1-100, offset must be >= 0', 400, 'VALIDATION_FAILED');
    }

    const result = await CommentService.getCommentReplies(commentId, limitNum, offsetNum, userId);

    return success(res, result.comments, 'Comment replies fetched successfully', 200, {
      limit: limitNum,
      offset: offsetNum,
      total: result.total,
    });
  });

  /**
   * POST /comments/{comment_id}/replies
   * Create a reply to a top-level comment.
   * Requires: authentication
   */
  static createReply = asyncHandler(async (req, res) => {
    const { comment_id: commentId } = req.params;
    const { content } = req.body;

    // Verify authentication
    const userId = req.user?.id || req.user?.sub || req.user?.user_id;
    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const reply = await CommentService.createReply(userId, commentId, content);

    return success(res, reply, 'Reply posted successfully', 201);
  });
}

module.exports = CommentController;
