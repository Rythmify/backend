/**
 * @fileoverview Unit tests for Push Notifications Controller layer
 */

const controller = require('../src/controllers/push-notifications.controller');
const pushNotificationsService = require('../src/services/push-notifications.service');
const api = require('../src/utils/api-response');

jest.mock('../src/services/push-notifications.service');
jest.mock('../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkReq = ({ userId = 'u1', body = {}, user } = {}) => ({
  user: user || (userId ? { sub: userId } : undefined),
  body,
});

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('push-notifications.controller', () => {
  describe('registerToken', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null, body: { token: 't', platform: 'android' } });
      const res = mkRes();

      await controller.registerToken(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(pushNotificationsService.registerToken).not.toHaveBeenCalled();
    });

    it('calls service and returns success', async () => {
      const req = mkReq({ body: { token: 't', platform: 'android' } });
      const res = mkRes();

      pushNotificationsService.registerToken.mockResolvedValue(undefined);

      await controller.registerToken(req, res);

      expect(pushNotificationsService.registerToken).toHaveBeenCalledWith({
        userId: 'u1',
        token: 't',
        platform: 'android',
      });
      expect(api.success).toHaveBeenCalledWith(res, { success: true }, 'Push token registered.');
    });

    it('bubbles service error', async () => {
      const req = mkReq({ body: { token: 't', platform: 'android' } });
      const res = mkRes();

      pushNotificationsService.registerToken.mockRejectedValue(new Error('nope'));

      await expect(controller.registerToken(req, res)).rejects.toThrow('nope');
    });
  });

  describe('unregisterToken', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null, body: { token: 't' } });
      const res = mkRes();

      await controller.unregisterToken(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(pushNotificationsService.unregisterToken).not.toHaveBeenCalled();
    });

    it('calls service and returns success', async () => {
      const req = mkReq({ body: { token: 't' } });
      const res = mkRes();

      pushNotificationsService.unregisterToken.mockResolvedValue(undefined);

      await controller.unregisterToken(req, res);

      expect(pushNotificationsService.unregisterToken).toHaveBeenCalledWith({ userId: 'u1', token: 't' });
      expect(api.success).toHaveBeenCalledWith(res, { success: true }, 'Push token removed.');
    });

    it('bubbles service error', async () => {
      const req = mkReq({ body: { token: 't' } });
      const res = mkRes();

      pushNotificationsService.unregisterToken.mockRejectedValue(new Error('nope'));

      await expect(controller.unregisterToken(req, res)).rejects.toThrow('nope');
    });
  });
});
