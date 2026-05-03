// ============================================================
// tests/comments/models/comment.model.test.js
// ============================================================
const CommentModel = require('../../../src/models/comment.model');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db');

describe('Comment Model', () => {
  const userId = 'user-1';
  const trackId = 'track-1';
  const commentId = 'comm-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrackComments', () => {
    it('returns comments and total', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ comment_id: 'c1', content: 'hello' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });
      
      const res = await CommentModel.getTrackComments(trackId, 10, 0, null, null, 'newest', userId);
      expect(res.comments).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it('supports sorting and filters', async () => {
      // Each call to getTrackComments does 2 db.query calls
      db.query
        .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] }) // call 1
        .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] }) // call 2
        .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] }); // call 3
      
      await CommentModel.getTrackComments(trackId, 10, 0, 0, 100, 'oldest', userId);
      await CommentModel.getTrackComments(trackId, 10, 0, null, null, 'timestamp', userId);
      await CommentModel.getTrackComments(trackId, 10, 0, null, null, 'top', userId);
      expect(db.query).toHaveBeenCalledTimes(6); 
    });
  });

  describe('createComment', () => {
    it('creates a comment', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
      const res = await CommentModel.createComment(userId, trackId, 'nice', 10);
      expect(res.id).toBe('c1');
    });
  });

  describe('getComment', () => {
    it('returns comment if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
      const res = await CommentModel.getComment('c1', userId);
      expect(res.id).toBe('c1');
    });
    it('returns null if not exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      expect(await CommentModel.getComment('c1')).toBeNull();
    });
  });

  describe('updateComment', () => {
    it('updates comment content', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ content: 'updated' }] });
      const res = await CommentModel.updateComment('c1', 'updated');
      expect(res.content).toBe('updated');
    });
    it('returns null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      expect(await CommentModel.updateComment('c1', 'updated')).toBeNull();
    });
  });

  describe('deleteComment', () => {
    it('deletes a top-level comment and its replies', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ parent_comment_id: null }] }) // check
        .mockResolvedValueOnce({}) // delete replies
        .mockResolvedValueOnce({ rows: [{ id: 'c1' }] }); // delete self
      
      const res = await CommentModel.deleteComment('c1');
      expect(res).toBe(true);
    });

    it('deletes a reply', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ parent_comment_id: 'p1' }] }) // check
        .mockResolvedValueOnce({ rows: [{ id: 'c2' }] }); // delete self
      
      const res = await CommentModel.deleteComment('c2');
      expect(res).toBe(true);
    });

    it('returns false if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      expect(await CommentModel.deleteComment('c1')).toBe(false);
    });
  });

  describe('getCommentReplies', () => {
    it('returns replies', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ parent_comment_id: null }] }) // parent check
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] }) // replies
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count
      
      const res = await CommentModel.getCommentReplies('c1', 10, 0, userId);
      expect(res.comments).toHaveLength(1);
    });

    it('throws if parent not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(CommentModel.getCommentReplies('c1', 10, 0)).rejects.toThrow('COMMENT_NOT_FOUND');
    });

    it('throws if parent is already a reply', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ parent_comment_id: 'gp1' }] });
      await expect(CommentModel.getCommentReplies('c1', 10, 0)).rejects.toThrow('CANNOT_REPLY_TO_REPLY');
    });
  });

  describe('createReply', () => {
    it('creates a reply', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ track_id: trackId, parent_comment_id: null }] }) // parent check
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] }); // insert
      
      const res = await CommentModel.createReply(userId, 'c1', 'reply');
      expect(res.id).toBe('r1');
    });

    it('throws if parent not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(CommentModel.createReply(userId, 'c1', 'reply')).rejects.toThrow('PARENT_COMMENT_NOT_FOUND');
    });

    it('throws if parent is already a reply', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ parent_comment_id: 'gp1' }] });
      await expect(CommentModel.createReply(userId, 'c1', 'reply')).rejects.toThrow('CANNOT_REPLY_TO_REPLY');
    });
  });

  describe('checkCommentOwner', () => {
    it('returns owner if match', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: userId }] });
      expect(await CommentModel.checkCommentOwner('c1', userId)).toBeTruthy();
    });
    it('returns null if no match', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 'other' }] });
      expect(await CommentModel.checkCommentOwner('c1', userId)).toBeNull();
    });
  });

  describe('isCommentLikedByUser', () => {
    it('returns boolean', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      expect(await CommentModel.isCommentLikedByUser('c1', userId)).toBe(true);
    });
  });
});
