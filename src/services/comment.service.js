const CommentModel = require('../models/comment.model');
const notificationModel = require('../models/notification.model');
const emailNotificationsService = require('./email-notifications.service');
const AppError = require('../utils/app-error');

class CommentService {
  /**
   * Fetch paginated top-level comments for a track.
   * Supports waveform floating with timestamp filtering and 4 sort strategies.
   *
   * @param {string} trackId - Track UUID
   * @param {number} limit - Pagination limit (1-100)
   * @param {number} offset - Pagination offset
   * @param {number|null} timestampFrom - Min track_timestamp filter (seconds)
   * @param {number|null} timestampTo - Max track_timestamp filter (seconds)
   * @param {string} sort - Sort strategy (newest|oldest|timestamp|top)
   * @param {string} userId - Current user ID for is_liked_by_me check
   * @returns {Promise<{comments: Array, total: number}>}
   */
  static async getTrackComments(trackId, limit, offset, timestampFrom, timestampTo, sort, userId) {
    // Validate sort parameter
    if (sort && !['newest', 'oldest', 'timestamp', 'top'].includes(sort)) {
      throw new AppError(
        'Invalid sort parameter. Must be: newest, oldest, timestamp, or top',
        400,
        'INVALID_SORT'
      );
    }

    // Fetch comments from model
    const { comments, total } = await CommentModel.getTrackComments(
      trackId,
      limit,
      offset,
      timestampFrom,
      timestampTo,
      sort || 'newest'
    );

    // Enrich with author info and is_liked_by_me flag
    const enriched = await Promise.all(
      comments.map(async (comment) => {
        // Fetch author user info
        const authorResult = await CommentModel.getComment(comment.comment_id);
        const author = authorResult?.author || null;

        // Check if current user likes this comment
        const isLiked = userId
          ? await CommentModel.isCommentLikedByUser(comment.comment_id, userId)
          : false;

        return {
          ...comment,
          is_liked_by_me: isLiked,
          author,
        };
      })
    );

    return { comments: enriched, total };
  }

  /**
   * Create a new comment on a track.
   *
   * @param {string} userId - Author user UUID
   * @param {string} trackId - Track UUID
   * @param {string} content - Comment text (1-500 chars)
   * @param {number} trackTimestamp - Position in track (seconds)
   * @returns {Promise<{comment_id, ...}>}
   * @throws AppError on validation failures
   */
  static async createComment(userId, trackId, content, trackTimestamp) {
    // Validate inputs
    if (!content || typeof content !== 'string') {
      throw new AppError('Comment content is required', 400, 'VALIDATION_FAILED');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      throw new AppError(
        'Comment content must be between 1 and 500 characters',
        400,
        'VALIDATION_FAILED'
      );
    }

    if (typeof trackTimestamp !== 'number' || trackTimestamp < 0) {
      throw new AppError(
        'Track timestamp must be a non-negative integer',
        400,
        'VALIDATION_FAILED'
      );
    }

    // Create comment in database
    const comment = await CommentModel.createComment(
      userId,
      trackId,
      trimmedContent,
      trackTimestamp
    );

    await notifyTrackCommentIfNeeded({
      actorUserId: userId,
      trackId,
      commentId: comment.comment_id,
    });

    // Enrich response with author and likes
    const commentInfo = await CommentModel.getComment(comment.comment_id);
    return {
      ...comment,
      is_liked_by_me: false,
      author: commentInfo?.author,
    };
  }

  /**
   * Fetch a single comment with all its metadata.
   *
   * @param {string} commentId - Comment UUID
   * @param {string} userId - Current user ID for is_liked_by_me check
   * @returns {Promise<{comment_id, ..., is_liked_by_me: boolean}>}
   * @throws AppError if comment not found
   */
  static async getComment(commentId, userId) {
    const comment = await CommentModel.getComment(commentId);

    if (!comment) {
      throw new AppError('Comment not found', 404, 'NOT_FOUND');
    }

    const isLiked = userId ? await CommentModel.isCommentLikedByUser(commentId, userId) : false;

    return {
      ...comment,
      is_liked_by_me: isLiked,
    };
  }

  /**
   * Update a comment's content (only author can update).
   * Sets updated_at timestamp automatically.
   *
   * @param {string} commentId - Comment UUID
   * @param {string} userId - Current user ID (for ownership verification)
   * @param {string} content - New comment text (1-500 chars)
   * @returns {Promise<{comment_id, ...}>}
   * @throws AppError if not authorized or validation fails
   */
  static async updateComment(commentId, userId, content) {
    // Validate content
    if (!content || typeof content !== 'string') {
      throw new AppError('Comment content is required', 400, 'VALIDATION_FAILED');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      throw new AppError(
        'Comment content must be between 1 and 500 characters',
        400,
        'VALIDATION_FAILED'
      );
    }

    // Verify ownership
    const owner = await CommentModel.checkCommentOwner(commentId, userId);
    if (!owner) {
      throw new AppError('You are not authorized to edit this comment', 403, 'FORBIDDEN');
    }

    // Update comment
    const updated = await CommentModel.updateComment(commentId, trimmedContent);

    if (!updated) {
      throw new AppError('Comment not found', 404, 'NOT_FOUND');
    }

    // Enrich with author and likes
    const commentInfo = await CommentModel.getComment(updated.comment_id);
    const isLiked = await CommentModel.isCommentLikedByUser(commentId, userId);

    return {
      ...updated,
      is_liked_by_me: isLiked,
      author: commentInfo?.author,
    };
  }

  /**
   * Delete a comment (only author can delete).
   * Cascade deletes all nested replies.
   *
   * @param {string} commentId - Comment UUID
   * @param {string} userId - Current user ID (for ownership verification)
   * @returns {Promise<boolean>} True if deleted successfully
   * @throws AppError if not authorized or comment not found
   */
  static async deleteComment(commentId, userId) {
    // Verify ownership
    const owner = await CommentModel.checkCommentOwner(commentId, userId);
    if (!owner) {
      throw new AppError('You are not authorized to delete this comment', 403, 'FORBIDDEN');
    }

    // Delete comment (cascade handled by triggers + ON DELETE CASCADE)
    const deleted = await CommentModel.deleteComment(commentId);

    if (!deleted) {
      throw new AppError('Comment not found', 404, 'NOT_FOUND');
    }

    return true;
  }

  /**
   * Fetch paginated replies to a top-level comment.
   * Replies ordered by creation time (oldest first).
   *
   * @param {string} parentCommentId - Parent comment UUID
   * @param {number} limit - Pagination limit (1-100)
   * @param {number} offset - Pagination offset
   * @param {string} userId - Current user ID for is_liked_by_me check
   * @returns {Promise<{comments: Array, total: number}>}
   */
  static async getCommentReplies(parentCommentId, limit, offset, userId) {
    let replies, total;

    try {
      ({ comments: replies, total } = await CommentModel.getCommentReplies(
        parentCommentId,
        limit,
        offset
      ));
    } catch (err) {
      if (err.message === 'COMMENT_NOT_FOUND') {
        throw new AppError('Parent comment not found', 404, 'NOT_FOUND');
      }
      if (err.message === 'CANNOT_REPLY_TO_REPLY') {
        throw new AppError('Cannot list replies of a reply', 400, 'INVALID_OPERATION');
      }
      throw err;
    }

    // Enrich with author and likes
    const enriched = await Promise.all(
      replies.map(async (reply) => {
        const authorResult = await CommentModel.getComment(reply.comment_id);
        const author = authorResult?.author || null;
        const isLiked = userId
          ? await CommentModel.isCommentLikedByUser(reply.comment_id, userId)
          : false;

        return {
          ...reply,
          is_liked_by_me: isLiked,
          author,
        };
      })
    );

    return { comments: enriched, total };
  }

  /**
   * Create a reply to a top-level comment.
   * reply_count is incremented automatically by database trigger.
   *
   * @param {string} userId - Author user UUID
   * @param {string} parentCommentId - Parent comment UUID
   * @param {string} content - Reply text (1-500 chars)
   * @returns {Promise<{comment_id, ...}>}
   * @throws AppError on validation or constraint failures
   */
  static async createReply(userId, parentCommentId, content) {
    // Validate content
    if (!content || typeof content !== 'string') {
      throw new AppError('Reply content is required', 400, 'VALIDATION_FAILED');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      throw new AppError(
        'Reply content must be between 1 and 500 characters',
        400,
        'VALIDATION_FAILED'
      );
    }

    let reply;
    try {
      reply = await CommentModel.createReply(userId, parentCommentId, trimmedContent);
    } catch (err) {
      if (err.message === 'PARENT_COMMENT_NOT_FOUND') {
        throw new AppError('Parent comment not found', 404, 'NOT_FOUND');
      }
      if (err.message === 'CANNOT_REPLY_TO_REPLY') {
        throw new AppError('Cannot reply to a reply', 400, 'INVALID_OPERATION');
      }
      throw err;
    }

    // Enrich response with author
    const commentInfo = await CommentModel.getComment(reply.comment_id);

    return {
      ...reply,
      is_liked_by_me: false,
      author: commentInfo?.author,
    };
  }
}

module.exports = CommentService;

async function notifyTrackCommentIfNeeded({ actorUserId, trackId, commentId }) {
  const trackOwnerId = await notificationModel.getTrackOwnerId(trackId);
  if (!trackOwnerId || trackOwnerId === actorUserId) return;

  await notificationModel.createNotification({
    userId: trackOwnerId,
    actionUserId: actorUserId,
    type: 'comment',
    referenceId: commentId,
    referenceType: 'comment',
  });

  await emailNotificationsService.sendGeneralNotificationEmailIfEligible({
    recipientUserId: trackOwnerId,
    actionUserId: actorUserId,
    type: 'comment',
  });
}
