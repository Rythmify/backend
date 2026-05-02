// ============================================================
// tests/comments/controllers/comment.controller.branches.test.js
// Coverage Target: 100%
// ============================================================

const CommentController = require('../../../src/controllers/comment.controller');
const CommentService = require('../../../src/services/comment.service');

jest.mock('../../../src/services/comment.service');

describe('Comment Controller - Branch Coverage Expansion', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {}, user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('normalizeComment Branches', () => {
    it('returns null if comment is null', async () => {
        CommentService.getComment.mockResolvedValue(null);
        req.params.comment_id = 'c1';
        await CommentController.getComment(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: null }));
    });

    it('normalizes boolean flags', async () => {
        const comment = { id: 'c1', is_liked_by_me: 1, is_user_blocked: 0 };
        CommentService.getComment.mockResolvedValue(comment);
        req.params.comment_id = 'c1';
        await CommentController.getComment(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ is_liked_by_me: true, is_user_blocked: false })
        }));
    });
  });

  describe('userId Fallback Branches', () => {
    it('uses req.user.sub if id missing', async () => {
        req.user = { sub: 's1' };
        req.params.track_id = 't1';
        req.body = { content: 'hi' };
        CommentService.createComment.mockResolvedValue({ id: 'c1' });
        
        await CommentController.createComment(req, res);
        expect(CommentService.createComment).toHaveBeenCalledWith('s1', 't1', 'hi', undefined);
    });

    it('uses req.user.user_id if sub and id missing', async () => {
        req.user = { user_id: 'u1' };
        req.params.track_id = 't1';
        req.body = { content: 'hi' };
        CommentService.createComment.mockResolvedValue({ id: 'c1' });
        
        await CommentController.createComment(req, res);
        expect(CommentService.createComment).toHaveBeenCalledWith('u1', 't1', 'hi', undefined);
    });
  });

  describe('Pagination Branches', () => {
    it('uses default values for track comments', async () => {
        req.params.track_id = 't1';
        CommentService.getTrackComments.mockResolvedValue({ comments: [], total: 0 });
        
        await CommentController.getTrackComments(req, res);
        expect(CommentService.getTrackComments).toHaveBeenCalledWith('t1', 20, 0, null, null, 'newest', undefined);
    });

    it('parses timestamps if provided', async () => {
        req.params.track_id = 't1';
        req.query = { timestamp_from: '1000', timestamp_to: '2000' };
        CommentService.getTrackComments.mockResolvedValue({ comments: [], total: 0 });
        
        await CommentController.getTrackComments(req, res);
        expect(CommentService.getTrackComments).toHaveBeenCalledWith('t1', 20, 0, 1000, 2000, 'newest', undefined);
    });
  });
});
