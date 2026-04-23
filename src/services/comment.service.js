const CommentModel = require('../models/comment.model');
const notificationModel = require('../models/notification.model');
const emailNotificationsService = require('./email-notifications.service');
const AppError = require('../utils/app-error');

class CommentService {
  /**
   * Fetch comments. Optimized to remove extra database calls.
   */
  static async getTrackComments(trackId, limit, offset, timestampFrom, timestampTo, sort, userId) {
    if (sort && !['newest', 'oldest', 'timestamp', 'top'].includes(sort)) {
      throw new AppError('Invalid sort parameter', 400, 'INVALID_SORT');
    }

    return await CommentModel.getTrackComments(
      trackId,
      limit,
      offset,
      timestampFrom,
      timestampTo,
      sort || 'newest',
      userId || null
    );
  }

  /**
   * Create comment with fixed timestamp validation.
   */
  static async createComment(userId, trackId, content, trackTimestamp) {
    if (!content || content.trim().length === 0 || content.trim().length > 500) {
      throw new AppError('Content must be 1-500 chars', 400, 'VALIDATION_FAILED');
    }

    // Fixed validation: allow null/undefined trackTimestamp
    if (trackTimestamp !== null && trackTimestamp !== undefined) {
      if (!Number.isInteger(trackTimestamp) || trackTimestamp < 0) {
        throw new AppError('Timestamp must be a positive integer', 400, 'VALIDATION_FAILED');
      }
    }

    const comment = await CommentModel.createComment(
      userId,
      trackId,
      content.trim(),
      trackTimestamp
    );
    await notifyTrackCommentIfNeeded({
      actorUserId: userId,
      trackId,
      commentId: comment.comment_id,
    });

    const fullComment = await CommentModel.getComment(comment.comment_id, userId);
    return fullComment;
  }

  static async getComment(commentId, userId) {
    const comment = await CommentModel.getComment(commentId, userId);
    if (!comment) throw new AppError('Comment not found', 404, 'NOT_FOUND');
    return comment;
  }

  static async updateComment(commentId, userId, content) {
    if (!content || content.trim().length === 0 || content.trim().length > 500) {
      throw new AppError('Content must be 1-500 chars', 400, 'VALIDATION_FAILED');
    }

    const owner = await CommentModel.checkCommentOwner(commentId, userId);
    if (!owner) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const updated = await CommentModel.updateComment(commentId, content.trim());
    return await CommentModel.getComment(updated.comment_id, userId);
  }

  static async deleteComment(commentId, userId) {
    const owner = await CommentModel.checkCommentOwner(commentId, userId);
    if (!owner) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const deleted = await CommentModel.deleteComment(commentId);
    if (!deleted) throw new AppError('Comment not found', 404, 'NOT_FOUND');
    return true;
  }

  static async getCommentReplies(parentCommentId, limit, offset, userId) {
    try {
      return await CommentModel.getCommentReplies(parentCommentId, limit, offset, userId || null);
    } catch (err) {
      if (err.message === 'COMMENT_NOT_FOUND') throw new AppError('Not found', 404, 'NOT_FOUND');
      if (err.message === 'CANNOT_REPLY_TO_REPLY')
        throw new AppError('Invalid operation', 400, 'INVALID_OP');
      throw err;
    }
  }

  static async createReply(userId, parentCommentId, content) {
    if (!content || content.trim().length === 0 || content.trim().length > 500) {
      throw new AppError('Content required', 400, 'VALIDATION_FAILED');
    }

    try {
      const reply = await CommentModel.createReply(userId, parentCommentId, content.trim());
      return await CommentModel.getComment(reply.comment_id, userId);
    } catch (err) {
      if (err.message === 'PARENT_COMMENT_NOT_FOUND')
        throw new AppError('Not found', 404, 'NOT_FOUND');
      if (err.message === 'CANNOT_REPLY_TO_REPLY')
        throw new AppError('Invalid operation', 400, 'INVALID_OP');
      throw err;
    }
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
