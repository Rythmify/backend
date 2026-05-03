// ============================================================
// tests/user/controllers/block.controller.test.js
// ============================================================
const BlockController = require('../../../src/controllers/block.controller');
const BlockService = require('../../../src/services/block.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/block.service');

describe('Block Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { user_id: 'target-1' },
      query: {},
      user: { sub: 'me' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('blockUser', () => {
    it('returns 201 for new block', async () => {
      BlockService.blockUser.mockResolvedValue({ isNew: true, data: {} });
      await BlockController.blockUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 200 for existing block', async () => {
      BlockService.blockUser.mockResolvedValue({ isNew: false, data: {} });
      await BlockController.blockUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('calls next with 401 if not authenticated', async () => {
      req.user = null;
      await BlockController.blockUser(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('unblockUser', () => {
    it('returns 204 on success', async () => {
      BlockService.unblockUser.mockResolvedValue(true);
      await BlockController.unblockUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('calls next with 401 if not authenticated', async () => {
      req.user = null;
      await BlockController.unblockUser(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('getBlockedUsers', () => {
    it('returns blocked users list', async () => {
      BlockService.getBlockedUsers.mockResolvedValue({ users: [], total: 0, limit: 10, offset: 0 });
      await BlockController.getBlockedUsers(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('calls next with 401 if not authenticated', async () => {
      req.user = null;
      await BlockController.getBlockedUsers(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });

    it('calls next with 400 on invalid pagination', async () => {
      req.query.limit = 'abc';
      await BlockController.getBlockedUsers(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });
});
