// ============================================================
// tests/user/controllers/followers.controller.test.js
// ============================================================
const controller = require('../../../src/controllers/followers.controller');
const followersService = require('../../../src/services/followers.service');
const followRequestService = require('../../../src/services/follow-request.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/followers.service');
jest.mock('../../../src/services/follow-request.service');

describe('Followers Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { user_id: 'user-1' },
      query: {},
      user: { sub: 'me' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getFollowing', () => {
    it('returns following list', async () => {
      followersService.getFollowing.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
      await controller.getFollowing(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getFollowers', () => {
    it('returns followers list', async () => {
      followersService.getFollowers.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
      await controller.getFollowers(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getMyFollowing', () => {
    it('returns following list without query', async () => {
      followersService.getFollowing.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
      await controller.getMyFollowing(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns search results with query', async () => {
      req.query.q = 'test';
      followersService.searchMyFollowing.mockResolvedValue({ items: [], total: 0 });
      await controller.getMyFollowing(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getSuggestedUsersToFollow', () => {
    it('returns suggested users', async () => {
      followersService.getSuggestedUsersToFollow.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
      await controller.getSuggestedUsersToFollow(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getFollowStatus', () => {
    it('returns follow status', async () => {
      followersService.getFollowStatus.mockResolvedValue({ following: true });
      await controller.getFollowStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('followUser', () => {
    it('returns 201 for direct follow', async () => {
      followersService.followUser.mockResolvedValue({ isRequest: false, alreadyFollowing: false });
      await controller.followUser(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 200 for already following', async () => {
      followersService.followUser.mockResolvedValue({ isRequest: false, alreadyFollowing: true });
      await controller.followUser(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 202 for follow request', async () => {
      followersService.followUser.mockResolvedValue({ isRequest: true, alreadyRequested: false });
      await controller.followUser(req, res);
      expect(res.status).toHaveBeenCalledWith(202);
    });

    it('returns 200 for already requested', async () => {
      followersService.followUser.mockResolvedValue({ isRequest: true, alreadyRequested: true });
      await controller.followUser(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('unfollowUser', () => {
    it('returns 204 on success', async () => {
      await controller.unfollowUser(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('getPendingFollowRequests', () => {
    it('returns pending requests', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
      await controller.getPendingFollowRequests(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('acceptFollowRequest', () => {
    it('returns 201 on success', async () => {
      req.params.request_id = 'req-1';
      followRequestService.acceptFollowRequest.mockResolvedValue({ isNew: true });
      await controller.acceptFollowRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 200 if already accepted', async () => {
      req.params.request_id = 'req-1';
      followRequestService.acceptFollowRequest.mockResolvedValue({ isNew: false });
      await controller.acceptFollowRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectFollowRequest', () => {
    it('returns 204 on success', async () => {
      req.params.request_id = 'req-1';
      await controller.rejectFollowRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('cancelFollowRequest', () => {
    it('returns 204 on success', async () => {
      req.params.request_id = 'req-1';
      await controller.cancelFollowRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});
