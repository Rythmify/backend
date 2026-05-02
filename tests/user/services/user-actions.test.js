// ============================================================
// tests/user-actions.unit.test.js
// Comprehensive unit tests for user actions:
// Like, Comment, Block, Repost, Follow
// ============================================================

const trackLikesController = require('../../../src/controllers/track-likes.controller');
const trackLikesService = require('../../../src/services/track-likes.service');
const commentController = require('../../../src/controllers/comment.controller');
const CommentService = require('../../../src/services/comment.service');
const BlockController = require('../../../src/controllers/block.controller');
const BlockService = require('../../../src/services/block.service');
const trackRepostsController = require('../../../src/controllers/track-reposts.controller');
const trackRepostsService = require('../../../src/services/track-reposts.service');
const followersController = require('../../../src/controllers/followers.controller');
const followersService = require('../../../src/services/followers.service');
const followRequestService = require('../../../src/services/follow-request.service');
const api = require('../../../src/utils/api-response');

jest.mock('../../../src/services/track-likes.service');
jest.mock('../../../src/services/comment.service');
jest.mock('../../../src/services/block.service');
jest.mock('../../../src/services/track-reposts.service');
jest.mock('../../../src/services/followers.service');
jest.mock('../../../src/services/follow-request.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// ========== HELPER FUNCTIONS ==========

const mkReq = ({ userId = 'user-1', body = {}, params = {}, query = {}, user } = {}) => ({
  user: user || (userId ? { id: userId, sub: userId, user_id: userId } : undefined),
  body,
  params,
  query,
});

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const mkNext = () => jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// 1️-LIKE TRACK TESTS (54% coverage)
// ============================================================

describe('Like Track Action', () => {
  describe('Happy Path', () => {
    it('should successfully like a track (201 - new like)', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackLikesService.likeTrack.mockResolvedValue({
        likeId: 'like-1',
        userId: 'user-1',
        trackId: 'track-1',
        createdAt: '2026-05-02T10:00:00Z',
        isNew: true,
      });

      await trackLikesController.likeTrack(req, res);

      expect(trackLikesService.likeTrack).toHaveBeenCalledWith('user-1', 'track-1');
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ like_id: 'like-1' }),
        'Track liked successfully',
        201
      );
    });

    it('should return 200 if track already liked (idempotent)', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackLikesService.likeTrack.mockResolvedValue({
        likeId: 'like-1',
        userId: 'user-1',
        trackId: 'track-1',
        createdAt: '2026-05-02T09:00:00Z',
        isNew: false,
      });

      await trackLikesController.likeTrack(req, res);

      expect(api.success).toHaveBeenCalledWith(res, expect.any(Object), 'Track already liked', 200);
    });

    it('should successfully unlike a track (204)', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackLikesService.unlikeTrack.mockResolvedValue(true);

      await trackLikesController.unlikeTrack(req, res);

      expect(trackLikesService.unlikeTrack).toHaveBeenCalledWith('user-1', 'track-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should fetch paginated list of track likers', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        query: { limit: '10', offset: '0' },
      });
      const res = mkRes();

      trackLikesService.getTrackLikers.mockResolvedValue({
        likers: [
          { id: 'user-2', username: 'alice' },
          { id: 'user-3', username: 'bob' },
        ],
        total: 2,
      });

      await trackLikesController.getTrackLikers(req, res);

      expect(trackLikesService.getTrackLikers).toHaveBeenCalledWith('track-1', 10, 0);
      expect(api.success).toHaveBeenCalled();
    });

    it("should fetch authenticated user's liked tracks", async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '5', offset: '0' } });
      const res = mkRes();

      trackLikesService.getUserLikedTracks.mockResolvedValue({
        items: [{ id: 'track-1', title: 'Song A' }],
        total: 1,
      });

      await trackLikesController.getMyLikedTracks(req, res);

      expect(trackLikesService.getUserLikedTracks).toHaveBeenCalledWith('user-1', 5, 0);
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'My liked tracks fetched successfully',
        200
      );
    });
  });

  describe('Error Cases', () => {
    it('should return 401 if user not authenticated (like)', async () => {
      const req = mkReq({ userId: null, params: { track_id: 'track-1' }, user: undefined });
      const res = mkRes();

      await expect(trackLikesController.likeTrack(req, res)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('should handle unlike on non-liked track', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackLikesService.unlikeTrack.mockRejectedValue(new Error('Like not found'));

      await expect(trackLikesController.unlikeTrack(req, res)).rejects.toThrow('Like not found');
    });

    it('should validate pagination parameters are numbers (getTrackLikers)', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        query: { limit: 'invalid', offset: '0' },
      });
      const res = mkRes();

      await expect(trackLikesController.getTrackLikers(req, res)).rejects.toThrow(
        'Limit and offset must be numbers'
      );
    });

    it('should validate pagination parameters are numbers (getMyLikedTracks)', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '20', offset: 'abc' } });
      const res = mkRes();

      await expect(trackLikesController.getMyLikedTracks(req, res)).rejects.toThrow(
        'Limit and offset must be numbers'
      );
    });
  });
});

// ============================================================
// 2️-COMMENT TESTS (92% coverage)
// ============================================================

describe('Comment Action', () => {
  describe('Happy Path', () => {
    it('should successfully create a comment (201)', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        body: { content: 'Great track!', track_timestamp: 45 },
      });
      const res = mkRes();
      const next = mkNext();

      CommentService.createComment.mockResolvedValue({
        comment_id: 'comment-1',
        user_id: 'user-1',
        track_id: 'track-1',
        content: 'Great track!',
        is_liked_by_me: false,
      });

      await commentController.createComment(req, res, next);

      expect(CommentService.createComment).toHaveBeenCalledWith(
        'user-1',
        'track-1',
        'Great track!',
        45
      );
      expect(api.success).toHaveBeenCalledWith(res, expect.any(Object), 'Comment posted', 201);
    });

    it('should allow null track_timestamp', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        body: { content: 'Nice!', track_timestamp: null },
      });
      const res = mkRes();
      const next = mkNext();

      CommentService.createComment.mockResolvedValue({ comment_id: 'comment-2', content: 'Nice!' });

      await commentController.createComment(req, res, next);

      expect(CommentService.createComment).toHaveBeenCalledWith('user-1', 'track-1', 'Nice!', null);
    });

    it('should successfully update a comment', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { comment_id: 'comment-1' },
        body: { content: 'Updated!' },
      });
      const res = mkRes();
      const next = mkNext();

      CommentService.updateComment.mockResolvedValue({
        comment_id: 'comment-1',
        content: 'Updated!',
      });

      await commentController.updateComment(req, res, next);

      expect(CommentService.updateComment).toHaveBeenCalledWith('comment-1', 'user-1', 'Updated!');
      expect(api.success).toHaveBeenCalledWith(res, expect.any(Object), 'Comment updated', 200);
    });

    it('should successfully delete a comment (204)', async () => {
      const req = mkReq({ userId: 'user-1', params: { comment_id: 'comment-1' } });
      const res = mkRes();
      const next = mkNext();

      CommentService.deleteComment.mockResolvedValue(true);

      await commentController.deleteComment(req, res, next);

      expect(CommentService.deleteComment).toHaveBeenCalledWith('comment-1', 'user-1');
      expect(api.success).toHaveBeenCalledWith(res, null, 'Comment deleted', 204);
    });

    it('should successfully create a reply', async () => {
      const req = mkReq({
        userId: 'user-2',
        params: { comment_id: 'comment-1' },
        body: { content: 'Great reply!' },
      });
      const res = mkRes();
      const next = mkNext();

      CommentService.createReply.mockResolvedValue({
        comment_id: 'reply-1',
        user_id: 'user-2',
        parent_comment_id: 'comment-1',
        content: 'Great reply!',
      });

      await commentController.createReply(req, res, next);

      expect(CommentService.createReply).toHaveBeenCalledWith(
        'user-2',
        'comment-1',
        'Great reply!'
      );
      expect(api.success).toHaveBeenCalledWith(res, expect.any(Object), 'Reply posted', 201);
    });

    it('should fetch comments with pagination and sorting', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        query: { limit: '20', offset: '0', sort: 'newest' },
      });
      const res = mkRes();
      const next = mkNext();

      CommentService.getTrackComments.mockResolvedValue({
        comments: [
          { comment_id: 'c1', content: 'First!' },
          { comment_id: 'c2', content: 'Second!' },
        ],
        total: 2,
      });

      await commentController.getTrackComments(req, res, next);

      expect(CommentService.getTrackComments).toHaveBeenCalledWith(
        'track-1',
        20,
        0,
        null,
        null,
        'newest',
        'user-1'
      );
    });

    it('should fetch a single comment', async () => {
      const req = mkReq({ userId: 'user-1', params: { comment_id: 'comment-1' } });
      const res = mkRes();
      const next = mkNext();

      CommentService.getComment.mockResolvedValue({ comment_id: 'comment-1', content: 'Hello' });

      await commentController.getComment(req, res, next);

      expect(CommentService.getComment).toHaveBeenCalledWith('comment-1', 'user-1');
      expect(api.success).toHaveBeenCalledWith(res, expect.any(Object), 'Comment fetched', 200);
    });

    it('should fetch comment replies', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { comment_id: 'comment-1' },
        query: { limit: '10', offset: '0' },
      });
      const res = mkRes();
      const next = mkNext();

      CommentService.getCommentReplies.mockResolvedValue({
        comments: [{ comment_id: 'reply-1', content: 'Reply' }],
        total: 1,
      });

      await commentController.getCommentReplies(req, res, next);

      expect(CommentService.getCommentReplies).toHaveBeenCalledWith('comment-1', 10, 0, 'user-1');
      expect(api.success).toHaveBeenCalledWith(res, expect.any(Object), 'Replies fetched', 200, {
        total: 1,
      });
    });
  });

  describe('Error Cases', () => {
    it('should pass service errors to next', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        body: { content: '' },
      });
      const res = mkRes();
      const next = mkNext();

      const error = new Error('Content must be 1-500 chars');
      CommentService.createComment.mockRejectedValue(error);

      // Using the fact that asyncHandler catches errors and calls next
      await commentController.createComment(req, res, next);

      // We need to wait for the promise inside asyncHandler to resolve
      // In a real environment, we'd use a more sophisticated way to wait,
      // but here we can just wait for one tick.
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should prevent non-owner from updating comment', async () => {
      const req = mkReq({
        userId: 'user-2',
        params: { comment_id: 'comment-1' },
        body: { content: 'Hacked!' },
      });
      const res = mkRes();
      const next = mkNext();

      const error = new Error('Not authorized');
      CommentService.updateComment.mockRejectedValue(error);

      await commentController.updateComment(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should prevent non-owner from deleting comment', async () => {
      const req = mkReq({ userId: 'user-2', params: { comment_id: 'comment-1' } });
      const res = mkRes();
      const next = mkNext();

      const error = new Error('Not authorized');
      CommentService.deleteComment.mockRejectedValue(error);

      await commentController.deleteComment(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle invalid parent comment for reply', async () => {
      const req = mkReq({
        userId: 'user-2',
        params: { comment_id: 'invalid' },
        body: { content: 'Reply' },
      });
      const res = mkRes();
      const next = mkNext();

      const error = new Error('Comment not found');
      CommentService.createReply.mockRejectedValue(error);

      await commentController.createReply(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

// ============================================================
// 3️-BLOCK USER TESTS (78% coverage)
// ============================================================

describe('Block User Action', () => {
  describe('Happy Path', () => {
    it('should successfully block a user (201)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();
      const next = mkNext();

      BlockService.blockUser.mockResolvedValue({
        blocked: true,
        isNew: true,
        data: {
          blocker_id: 'user-1',
          blocked_id: 'user-2',
          created_at: '2026-05-02T10:00:00Z',
        },
      });

      await BlockController.blockUser(req, res, next);

      expect(BlockService.blockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'User blocked successfully',
        201
      );
    });

    it('should return 200 if user already blocked (idempotent)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();
      const next = mkNext();

      BlockService.blockUser.mockResolvedValue({ blocked: true, isNew: false, data: null });

      await BlockController.blockUser(req, res, next);

      expect(api.success).toHaveBeenCalledWith(res, null, 'User already blocked', 200);
    });

    it('should successfully unblock a user (204)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();
      const next = mkNext();

      BlockService.unblockUser.mockResolvedValue(true);

      await BlockController.unblockUser(req, res, next);

      expect(BlockService.unblockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(api.success).toHaveBeenCalledWith(res, null, 'User unblocked successfully', 204);
    });

    it('should fetch paginated blocked users list', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '20', offset: '0' } });
      const res = mkRes();
      const next = mkNext();

      BlockService.getBlockedUsers.mockResolvedValue({
        users: [
          { id: 'user-2', username: 'blocked-user-1' },
          { id: 'user-3', username: 'blocked-user-2' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      });

      await BlockController.getBlockedUsers(req, res, next);

      expect(BlockService.getBlockedUsers).toHaveBeenCalledWith('user-1', 20, 0);
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'Blocked users list fetched successfully',
        200
      );
    });
  });

  describe('Error Cases', () => {
    it('should pass self-block error to next', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-1' } });
      const res = mkRes();
      const next = mkNext();

      const error = new Error('Cannot block yourself');
      BlockService.blockUser.mockRejectedValue(error);

      await BlockController.blockUser(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle unblocking non-blocked user', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();
      const next = mkNext();

      const error = new Error('User not in block list');
      BlockService.unblockUser.mockRejectedValue(error);

      await BlockController.unblockUser(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should validate limit range (1-100)', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '150', offset: '0' } });
      const res = mkRes();
      const next = mkNext();

      await BlockController.getBlockedUsers(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Limit must be 1-100, offset must be >= 0' })
      );
    });

    it('should validate non-negative offset', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '20', offset: '-1' } });
      const res = mkRes();
      const next = mkNext();

      await BlockController.getBlockedUsers(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Limit must be 1-100, offset must be >= 0' })
      );
    });

    it('should handle NaN pagination parameters', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: 'abc', offset: '0' } });
      const res = mkRes();
      const next = mkNext();

      await BlockController.getBlockedUsers(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Limit must be 1-100, offset must be >= 0' })
      );
    });
  });
});

// ============================================================
// 4️-REPOST TRACK TESTS (65% coverage)
// ============================================================

describe('Repost Track Action', () => {
  describe('Happy Path', () => {
    it('should successfully repost a track (201)', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackRepostsService.repostTrack.mockResolvedValue({
        repostId: 'repost-1',
        userId: 'user-1',
        trackId: 'track-1',
        createdAt: '2026-05-02T10:00:00Z',
        isNew: true,
      });

      await trackRepostsController.repostTrack(req, res);

      expect(trackRepostsService.repostTrack).toHaveBeenCalledWith('user-1', 'track-1');
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ repost_id: 'repost-1' }),
        'Track reposted successfully',
        201
      );
    });

    it('should return 200 if track already reposted (idempotent)', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackRepostsService.repostTrack.mockResolvedValue({
        repostId: 'repost-1',
        userId: 'user-1',
        trackId: 'track-1',
        createdAt: '2026-05-02T09:00:00Z',
        isNew: false,
      });

      await trackRepostsController.repostTrack(req, res);

      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'Track already reposted',
        200
      );
    });

    it('should successfully remove a repost (204)', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackRepostsService.removeRepost.mockResolvedValue(true);

      await trackRepostsController.removeRepost(req, res);

      expect(trackRepostsService.removeRepost).toHaveBeenCalledWith('user-1', 'track-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should fetch paginated reposters list', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { track_id: 'track-1' },
        query: { limit: '10', offset: '0' },
      });
      const res = mkRes();

      trackRepostsService.getTrackReposters.mockResolvedValue({
        reposters: [
          { id: 'user-2', username: 'alice' },
          { id: 'user-3', username: 'bob' },
        ],
        total: 2,
      });

      await trackRepostsController.getTrackReposters(req, res);

      expect(trackRepostsService.getTrackReposters).toHaveBeenCalledWith('track-1', 10, 0);
      expect(api.success).toHaveBeenCalled();
    });

    it("should fetch authenticated user's reposted tracks", async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '20', offset: '0' } });
      const res = mkRes();

      trackRepostsService.getUserRepostedTracks.mockResolvedValue({ items: [], total: 0 });

      await trackRepostsController.getMyRepostedTracks(req, res);

      expect(trackRepostsService.getUserRepostedTracks).toHaveBeenCalledWith('user-1', 20, 0);
      expect(api.success).toHaveBeenCalled();
    });

    it("should fetch public user's reposted tracks", async () => {
      const req = mkReq({
        userId: 'requester-1',
        params: { user_id: 'user-2' },
        query: { limit: '10', offset: '0' },
      });
      const res = mkRes();

      trackRepostsService.getPublicUserRepostedTracks.mockResolvedValue({ items: [], total: 0 });

      await trackRepostsController.getUserRepostedTracks(req, res);

      expect(trackRepostsService.getPublicUserRepostedTracks).toHaveBeenCalledWith(
        'user-2',
        'requester-1',
        10,
        0
      );
      expect(api.success).toHaveBeenCalled();
    });
  });

  describe('Error Cases', () => {
    it('should handle service error when reposting own track', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackRepostsService.repostTrack.mockRejectedValue(new Error('Cannot repost your own track'));

      await expect(trackRepostsController.repostTrack(req, res)).rejects.toThrow(
        'Cannot repost your own track'
      );
    });

    it('should handle removing non-reposted track', async () => {
      const req = mkReq({ userId: 'user-1', params: { track_id: 'track-1' } });
      const res = mkRes();

      trackRepostsService.removeRepost.mockRejectedValue(new Error('Repost not found'));

      await expect(trackRepostsController.removeRepost(req, res)).rejects.toThrow(
        'Repost not found'
      );
    });

    it('should validate pagination in getMyRepostedTracks', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: 'abc' } });
      const res = mkRes();

      await expect(trackRepostsController.getMyRepostedTracks(req, res)).rejects.toThrow(
        'Limit and offset must be numbers'
      );
    });
  });
});

// ============================================================
// 5-FOLLOW USER TESTS (81% coverage)
// ============================================================

describe('Follow User Action', () => {
  describe('Happy Path', () => {
    it('should successfully follow a public user (201)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();

      followersService.followUser.mockResolvedValue({
        follower_id: 'user-1',
        followed_id: 'user-2',
        isRequest: false,
        alreadyFollowing: false,
        created_at: '2026-05-02T10:00:00Z',
      });

      await followersController.followUser(req, res);

      expect(followersService.followUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'You are now following this user.',
        201
      );
    });

    it('should return 200 if already following (idempotent)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();

      followersService.followUser.mockResolvedValue({
        follower_id: 'user-1',
        followed_id: 'user-2',
        isRequest: false,
        alreadyFollowing: true,
      });

      await followersController.followUser(req, res);

      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'You are already following this user.',
        200
      );
    });

    it('should create a follow request for private accounts (202)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'private-user' } });
      const res = mkRes();

      followersService.followUser.mockResolvedValue({
        id: 'req-1',
        follower_id: 'user-1',
        following_id: 'private-user',
        status: 'pending',
        isRequest: true,
        alreadyRequested: false,
        created_at: '2026-05-02T10:00:00Z',
      });

      await followersController.followUser(req, res);

      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'Follow request sent. Waiting for user to accept.',
        202
      );
    });

    it('should successfully unfollow a user (204)', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();

      followersService.unfollowUser.mockResolvedValue(true);

      await followersController.unfollowUser(req, res);

      expect(followersService.unfollowUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should fetch followers with pagination', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { user_id: 'user-1' },
        query: { limit: '20', offset: '0' },
      });
      const res = mkRes();

      followersService.getFollowers.mockResolvedValue({
        items: [{ id: 'user-2', username: 'alice' }],
        total: 1,
        limit: 20,
        offset: 0,
      });

      await followersController.getFollowers(req, res);

      expect(followersService.getFollowers).toHaveBeenCalledWith('user-1', 20, 0);
      expect(api.success).toHaveBeenCalled();
    });

    it('should fetch my following list', async () => {
      const req = mkReq({ userId: 'user-1', query: { limit: '10' } });
      const res = mkRes();

      followersService.getFollowing.mockResolvedValue({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
      });

      await followersController.getMyFollowing(req, res);

      expect(followersService.getFollowing).toHaveBeenCalled();
      expect(api.success).toHaveBeenCalled();
    });

    it('should search within my following list', async () => {
      const req = mkReq({ userId: 'user-1', query: { q: 'alice' } });
      const res = mkRes();

      followersService.searchMyFollowing.mockResolvedValue({ items: [], total: 0 });

      await followersController.getMyFollowing(req, res);

      expect(followersService.searchMyFollowing).toHaveBeenCalledWith('user-1', 'alice', 10, 0);
    });

    it('should fetch follow status', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-2' } });
      const res = mkRes();

      followersService.getFollowStatus.mockResolvedValue({ following: true, followed_by: false });

      await followersController.getFollowStatus(req, res);

      expect(followersService.getFollowStatus).toHaveBeenCalledWith('user-1', 'user-2');
      expect(api.success).toHaveBeenCalled();
    });

    it('should fetch pending follow requests', async () => {
      const req = mkReq({ userId: 'user-1' });
      const res = mkRes();

      followRequestService.getPendingFollowRequests.mockResolvedValue({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
      });

      await followersController.getPendingFollowRequests(req, res);

      expect(followRequestService.getPendingFollowRequests).toHaveBeenCalledWith('user-1', 10, 0);
      expect(api.success).toHaveBeenCalled();
    });

    it('should accept a follow request', async () => {
      const req = mkReq({ userId: 'user-1', params: { request_id: 'req-1' } });
      const res = mkRes();

      followRequestService.acceptFollowRequest.mockResolvedValue({ isNew: true });

      await followersController.acceptFollowRequest(req, res);

      expect(followRequestService.acceptFollowRequest).toHaveBeenCalledWith('req-1', 'user-1');
      expect(api.success).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        'Follow request accepted. User is now following you.',
        201
      );
    });

    it('should reject a follow request', async () => {
      const req = mkReq({ userId: 'user-1', params: { request_id: 'req-1' } });
      const res = mkRes();

      await followersController.rejectFollowRequest(req, res);

      expect(followRequestService.rejectFollowRequest).toHaveBeenCalledWith('req-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('Error Cases', () => {
    it('should handle self-follow error', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'user-1' } });
      const res = mkRes();

      followersService.followUser.mockRejectedValue(new Error('Cannot follow yourself'));

      await expect(followersController.followUser(req, res)).rejects.toThrow(
        'Cannot follow yourself'
      );
    });

    it('should handle following blocked user', async () => {
      const req = mkReq({ userId: 'user-1', params: { user_id: 'blocked-user' } });
      const res = mkRes();

      followersService.followUser.mockRejectedValue(new Error('Cannot follow blocked user'));

      await expect(followersController.followUser(req, res)).rejects.toThrow(
        'Cannot follow blocked user'
      );
    });

    it('should enforce pagination limit (1-100)', async () => {
      const req = mkReq({
        userId: 'user-1',
        params: { user_id: 'user-1' },
        query: { limit: '200', offset: '0' },
      });
      const res = mkRes();

      followersService.getFollowing.mockResolvedValue({
        items: [],
        total: 0,
        limit: 100,
        offset: 0,
      });

      await followersController.getFollowing(req, res);

      expect(followersService.getFollowing).toHaveBeenCalledWith('user-1', 100, 0);
      expect(api.success).toHaveBeenCalled();
    });
  });
});
