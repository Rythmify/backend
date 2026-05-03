// ============================================================
// tests/comments/services/comment-likes.service.test.js
// ============================================================
const service = require('../../../src/services/comment-likes.service');
const model = require('../../../src/models/comment-like.model');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/comment-like.model');

describe('Comment Likes Service', () => {
  const userId = 'user-123';
  const commentId = 'comment-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('likeComment', () => {
    it('successfully likes a new comment', async () => {
      const mockLike = {
        id: 'like-789',
        user_id: userId,
        comment_id: commentId,
        created_at: new Date().toISOString(),
      };

      model.likeComment.mockResolvedValue({
        created: true,
        like: mockLike,
      });

      const result = await service.likeComment(userId, commentId);

      expect(result).toEqual({
        likeId: 'like-789',
        userId: userId,
        commentId: commentId,
        createdAt: mockLike.created_at,
        isNew: true,
      });
      expect(model.likeComment).toHaveBeenCalledWith(userId, commentId);
    });

    it('successfully likes an already liked comment', async () => {
      const mockLike = {
        id: 'like-789',
        user_id: userId,
        comment_id: commentId,
        created_at: new Date().toISOString(),
      };

      model.likeComment.mockResolvedValue({
        created: false,
        like: mockLike,
      });

      const result = await service.likeComment(userId, commentId);

      expect(result.isNew).toBe(false);
    });

    it('throws error if userId is missing', async () => {
      await expect(service.likeComment('', commentId)).rejects.toThrow(
        new AppError('User ID is required', 400, 'INVALID_REQUEST')
      );
    });

    it('throws error if commentId is missing', async () => {
      await expect(service.likeComment(userId, '')).rejects.toThrow(
        new AppError('Comment ID is required', 400, 'INVALID_REQUEST')
      );
    });
  });

  describe('unlikeComment', () => {
    it('successfully unlikes a comment', async () => {
      model.unlikeComment.mockResolvedValue(true);

      const result = await service.unlikeComment(userId, commentId);

      expect(result).toBe(true);
      expect(model.unlikeComment).toHaveBeenCalledWith(userId, commentId);
    });

    it('throws 404 if like not found', async () => {
      model.unlikeComment.mockResolvedValue(false);

      await expect(service.unlikeComment(userId, commentId)).rejects.toThrow(
        new AppError('Like not found', 404, 'LIKE_NOT_FOUND')
      );
    });

    it('throws error if userId is missing', async () => {
      await expect(service.unlikeComment(' ', commentId)).rejects.toThrow(
        new AppError('User ID is required', 400, 'INVALID_REQUEST')
      );
    });

    it('throws error if commentId is missing', async () => {
      await expect(service.unlikeComment(userId, null)).rejects.toThrow(
        new AppError('Comment ID is required', 400, 'INVALID_REQUEST')
      );
    });
  });

  describe('isCommentLikedByUser', () => {
    it('returns true if liked', async () => {
      model.isCommentLikedByUser.mockResolvedValue(true);
      const result = await service.isCommentLikedByUser(userId, commentId);
      expect(result).toBe(true);
    });

    it('returns false if userId is missing', async () => {
      const result = await service.isCommentLikedByUser(null, commentId);
      expect(result).toBe(false);
      expect(model.isCommentLikedByUser).not.toHaveBeenCalled();
    });
  });

  describe('getCommentLikeCount', () => {
    it('returns count', async () => {
      model.getCommentLikeCount.mockResolvedValue(10);
      const result = await service.getCommentLikeCount(commentId);
      expect(result).toBe(10);
    });

    it('returns 0 if commentId is missing', async () => {
      const result = await service.getCommentLikeCount(null);
      expect(result).toBe(0);
      expect(model.getCommentLikeCount).not.toHaveBeenCalled();
    });
  });
});
