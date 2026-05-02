const controller = require('../../../src/controllers/followdiscovery.controller');
const service = require('../../../src/services/followdiscovery.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/followdiscovery.service', () => ({
  getSuggestedUsers: jest.fn(),
  getSuggestedArtists: jest.fn(),
}));

const mkReq = ({ userId = 'user-1', query = {}, user } = {}) => ({
  user: user !== undefined ? user : userId ? { sub: userId } : undefined,
  query,
});

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('FollowDiscovery - Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSuggestedUsers', () => {
    it('returns 200 with data and default pagination when query is empty', async () => {
      const req = mkReq({ query: {} });
      const res = mkRes();

      const servicePayload = {
        data: [{ id: 'u2' }],
        pagination: { limit: 20, offset: 0, total: 1 },
      };
      service.getSuggestedUsers.mockResolvedValue(servicePayload);

      await controller.getSuggestedUsers(req, res);

      expect(service.getSuggestedUsers).toHaveBeenCalledWith('user-1', {
        limit: 20,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(servicePayload);
    });

    it('clamps limit and offset boundary values', async () => {
      const req = mkReq({
        query: { limit: '999999', offset: '-42' },
      });
      const res = mkRes();
      service.getSuggestedUsers.mockResolvedValue({
        data: [],
        pagination: { limit: 100, offset: 0, total: 0 },
      });

      await controller.getSuggestedUsers(req, res);

      expect(service.getSuggestedUsers).toHaveBeenCalledWith('user-1', {
        limit: 100,
        offset: 0,
      });
    });

    it('normalizes invalid numeric input to defaults', async () => {
      const req = mkReq({
        query: { limit: 'NaN', offset: 'oops' },
      });
      const res = mkRes();
      service.getSuggestedUsers.mockResolvedValue({
        data: [],
        pagination: { limit: 20, offset: 0, total: 0 },
      });

      await controller.getSuggestedUsers(req, res);

      expect(service.getSuggestedUsers).toHaveBeenCalledWith('user-1', {
        limit: 20,
        offset: 0,
      });
    });

    it('uses minimum limit=1 when provided limit is 0', async () => {
      const req = mkReq({ query: { limit: '0', offset: '3' } });
      const res = mkRes();
      service.getSuggestedUsers.mockResolvedValue({
        data: [],
        pagination: { limit: 1, offset: 3, total: 0 },
      });

      await controller.getSuggestedUsers(req, res);

      expect(service.getSuggestedUsers).toHaveBeenCalledWith('user-1', {
        limit: 1,
        offset: 3,
      });
    });

    it('throws AUTH_TOKEN_MISSING when user is not authenticated', async () => {
      const req = mkReq({ userId: null });
      const res = mkRes();

      await expect(controller.getSuggestedUsers(req, res)).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTH_TOKEN_MISSING',
      });
      expect(service.getSuggestedUsers).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('bubbles up service exceptions', async () => {
      const req = mkReq();
      const res = mkRes();
      service.getSuggestedUsers.mockRejectedValue(new AppError('DB failed', 500, 'DB_ERROR'));

      await expect(controller.getSuggestedUsers(req, res)).rejects.toMatchObject({
        code: 'DB_ERROR',
        statusCode: 500,
      });
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getSuggestedArtists', () => {
    it('returns 200 with service data', async () => {
      const req = mkReq({ query: { limit: '15', offset: '5' } });
      const res = mkRes();
      const servicePayload = {
        data: [{ id: 'a-1', display_name: 'Artist 1' }],
        pagination: { limit: 15, offset: 5, total: 1 },
      };
      service.getSuggestedArtists.mockResolvedValue(servicePayload);

      await controller.getSuggestedArtists(req, res);

      expect(service.getSuggestedArtists).toHaveBeenCalledWith('user-1', {
        limit: 15,
        offset: 5,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(servicePayload);
    });

    it('applies default pagination when query values are null/undefined', async () => {
      const req = mkReq({ query: { limit: undefined, offset: null } });
      const res = mkRes();
      service.getSuggestedArtists.mockResolvedValue({
        data: [],
        pagination: { limit: 20, offset: 0, total: 0 },
      });

      await controller.getSuggestedArtists(req, res);

      expect(service.getSuggestedArtists).toHaveBeenCalledWith('user-1', {
        limit: 20,
        offset: 0,
      });
    });

    it('throws AUTH_TOKEN_MISSING when req.user is undefined', async () => {
      const req = mkReq({ user: undefined, userId: null });
      const res = mkRes();

      await expect(controller.getSuggestedArtists(req, res)).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTH_TOKEN_MISSING',
      });
      expect(service.getSuggestedArtists).not.toHaveBeenCalled();
    });

    it('bubbles generic rejected promises from service', async () => {
      const req = mkReq();
      const res = mkRes();
      const error = new Error('unexpected failure');
      service.getSuggestedArtists.mockRejectedValue(error);

      await expect(controller.getSuggestedArtists(req, res)).rejects.toThrow('unexpected failure');
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
