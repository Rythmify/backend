// ============================================================
// tests/comments/models/comment-like.model.test.js
// ============================================================
const model = require('../../../src/models/comment-like.model');
const db = require('../../../src/config/db');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/config/db');

describe('Comment Like Model', () => {
  const userId = 'user-1';
  const commentId = 'comm-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkCommentLike', () => {
    it('returns id if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      expect(await model.checkCommentLike(userId, commentId)).toBe('l1');
    });
    it('returns false if not exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      expect(await model.checkCommentLike(userId, commentId)).toBe(false);
    });
  });

  describe('likeComment', () => {
    it('creates new like', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: commentId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      
      const res = await model.likeComment(userId, commentId);
      expect(res.created).toBe(true);
    });

    it('handles already liked', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: commentId }] })
        .mockRejectedValueOnce({ code: '23505' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      
      const res = await model.likeComment(userId, commentId);
      expect(res.created).toBe(false);
    });

    it('throws 404 if comment not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.likeComment(userId, commentId)).rejects.toThrow('Comment not found');
    });

    it('throws other db errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: commentId }] })
        .mockRejectedValueOnce(new Error('DB Fail'));
      await expect(model.likeComment(userId, commentId)).rejects.toThrow('DB Fail');
    });
  });

  describe('unlikeComment', () => {
    it('unlikes successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: commentId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
      expect(await model.unlikeComment(userId, commentId)).toBe(true);
    });

    it('throws 404 if comment not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.unlikeComment(userId, commentId)).rejects.toThrow('Comment not found');
    });
  });

  describe('getCommentLikeCount', () => {
    it('returns count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ like_count: '10' }] });
      expect(await model.getCommentLikeCount(commentId)).toBe(10);
    });
  });

  describe('isCommentLikedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_liked: true }] });
      expect(await model.isCommentLikedByUser(userId, commentId)).toBe(true);
    });
    it('returns false if no userId', async () => {
      expect(await model.isCommentLikedByUser(null, commentId)).toBe(false);
    });
  });
});
