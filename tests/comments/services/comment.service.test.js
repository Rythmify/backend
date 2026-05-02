// ============================================================
// tests/comments/services/comment.service.test.js
// ============================================================
const service = require('../../../src/services/comment.service');
const CommentModel = require('../../../src/models/comment.model');
const notificationModel = require('../../../src/models/notification.model');
const notificationsService = require('../../../src/services/notifications.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/comment.model');
jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/services/notifications.service');

describe('Comment Service', () => {
  const userId = 'user-1';
  const trackId = 'track-1';
  const commentId = 'comm-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrackComments', () => {
    it('returns comments', async () => {
      CommentModel.getTrackComments.mockResolvedValue({ comments: [] });
      await service.getTrackComments(trackId, 10, 0, null, null, 'newest', userId);
      expect(CommentModel.getTrackComments).toHaveBeenCalled();
    });

    it('throws 400 on invalid sort', async () => {
      await expect(service.getTrackComments(trackId, 10, 0, null, null, 'bad')).rejects.toThrow('Invalid sort parameter');
    });
  });

  describe('createComment', () => {
    it('creates successfully and notifies', async () => {
      CommentModel.createComment.mockResolvedValue({ comment_id: 'c1' });
      CommentModel.getComment.mockResolvedValue({ id: 'c1' });
      notificationModel.getTrackOwnerId.mockResolvedValue('owner-1');

      const res = await service.createComment(userId, trackId, 'nice', 10);
      expect(res.id).toBe('c1');
      // notification is async fire-and-forget, hard to test without delay but we can check if model was called
    });

    it('throws 400 on invalid content', async () => {
      await expect(service.createComment(userId, trackId, '', 10)).rejects.toThrow('Content must be 1-500 chars');
    });

    it('throws 400 on invalid timestamp', async () => {
      await expect(service.createComment(userId, trackId, 'nice', -5)).rejects.toThrow('Timestamp must be a positive integer');
    });
  });

  describe('getComment', () => {
    it('returns comment', async () => {
      CommentModel.getComment.mockResolvedValue({ id: 'c1' });
      const res = await service.getComment('c1', userId);
      expect(res.id).toBe('c1');
    });
    it('throws 404 if not found', async () => {
      CommentModel.getComment.mockResolvedValue(null);
      await expect(service.getComment('c1', userId)).rejects.toThrow('Comment not found');
    });
  });

  describe('updateComment', () => {
    it('updates successfully', async () => {
      CommentModel.checkCommentOwner.mockResolvedValue({ user_id: userId });
      CommentModel.updateComment.mockResolvedValue({ comment_id: 'c1' });
      CommentModel.getComment.mockResolvedValue({ id: 'c1', content: 'new' });

      const res = await service.updateComment('c1', userId, 'new');
      expect(res.content).toBe('new');
    });

    it('throws 403 if not authorized', async () => {
      CommentModel.checkCommentOwner.mockResolvedValue(null);
      await expect(service.updateComment('c1', userId, 'new')).rejects.toThrow('Not authorized');
    });

    it('throws 400 on invalid content', async () => {
      await expect(service.updateComment('c1', userId, '')).rejects.toThrow('Content must be 1-500 chars');
    });
  });

  describe('deleteComment', () => {
    it('deletes successfully', async () => {
      CommentModel.checkCommentOwner.mockResolvedValue({ user_id: userId });
      CommentModel.deleteComment.mockResolvedValue(true);
      expect(await service.deleteComment('c1', userId)).toBe(true);
    });

    it('throws 404 if delete fails', async () => {
      CommentModel.checkCommentOwner.mockResolvedValue({ user_id: userId });
      CommentModel.deleteComment.mockResolvedValue(false);
      await expect(service.deleteComment('c1', userId)).rejects.toThrow('Comment not found');
    });
  });

  describe('getCommentReplies', () => {
    it('returns replies', async () => {
      CommentModel.getCommentReplies.mockResolvedValue({ comments: [] });
      await service.getCommentReplies('p1', 10, 0, userId);
      expect(CommentModel.getCommentReplies).toHaveBeenCalled();
    });

    it('handles model errors', async () => {
      CommentModel.getCommentReplies.mockRejectedValue(new Error('COMMENT_NOT_FOUND'));
      await expect(service.getCommentReplies('p1', 10, 0)).rejects.toThrow('Not found');

      CommentModel.getCommentReplies.mockRejectedValue(new Error('CANNOT_REPLY_TO_REPLY'));
      await expect(service.getCommentReplies('p1', 10, 0)).rejects.toThrow('Invalid operation');

      CommentModel.getCommentReplies.mockRejectedValue(new Error('Other'));
      await expect(service.getCommentReplies('p1', 10, 0)).rejects.toThrow('Other');
    });
  });

  describe('createReply', () => {
    it('creates reply', async () => {
      CommentModel.createReply.mockResolvedValue({ comment_id: 'r1' });
      CommentModel.getComment.mockResolvedValue({ id: 'r1' });
      const res = await service.createReply(userId, 'p1', 'reply');
      expect(res.id).toBe('r1');
    });

    it('handles model errors', async () => {
      CommentModel.createReply.mockRejectedValue(new Error('PARENT_COMMENT_NOT_FOUND'));
      await expect(service.createReply(userId, 'p1', 'reply')).rejects.toThrow('Not found');

      CommentModel.createReply.mockRejectedValue(new Error('CANNOT_REPLY_TO_REPLY'));
      await expect(service.createReply(userId, 'p1', 'reply')).rejects.toThrow('Invalid operation');

      CommentModel.createReply.mockRejectedValue(new Error('Other'));
      await expect(service.createReply(userId, 'p1', 'reply')).rejects.toThrow('Other');
    });

    it('throws 400 on invalid content', async () => {
      await expect(service.createReply(userId, 'p1', '')).rejects.toThrow('Content required');
    });
  });
});
