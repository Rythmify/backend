/**
 * @fileoverview Unit tests for Notifications Controller layer
 */

const controller = require('../../../src/controllers/notifications.controller');
const notificationsService = require('../../../src/services/notifications.service');
const api = require('../../../src/utils/api-response');

jest.mock('../../../src/services/notifications.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkReq = ({ userId = 'u1', params = {}, query = {}, body = {}, user } = {}) => ({
  user: user || (userId ? { sub: userId } : undefined),
  params,
  query,
  body,
});

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('notifications.controller', () => {
  describe('getNotifications', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null });
      const res = mkRes();

      await controller.getNotifications(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(notificationsService.getNotifications).not.toHaveBeenCalled();
    });

    it('passes unread_only from query and returns success', async () => {
      const req = mkReq({ query: { unread_only: 'true', page: '2', limit: '5', type: 'follow' } });
      const res = mkRes();

      notificationsService.getNotifications.mockResolvedValue({ items: [], pagination: {} });

      await controller.getNotifications(req, res);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith({
        userId: 'u1',
        unreadOnly: 'true',
        type: 'follow',
        page: '2',
        limit: '5',
      });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { items: [], pagination: {} },
        'Notifications fetched successfully.'
      );
    });

    it('prefers unread over unreadOnly when unread_only not set', async () => {
      const req = mkReq({ query: { unread: 'false', unreadOnly: 'true' } });
      const res = mkRes();

      notificationsService.getNotifications.mockResolvedValue({ items: [] });

      await controller.getNotifications(req, res);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ unreadOnly: 'false' })
      );
    });

    it('bubbles service error', async () => {
      const req = mkReq({ query: {} });
      const res = mkRes();

      notificationsService.getNotifications.mockRejectedValue(new Error('db down'));

      await expect(controller.getNotifications(req, res)).rejects.toThrow('db down');
      expect(api.success).not.toHaveBeenCalled();
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null });
      const res = mkRes();

      await controller.getUnreadNotificationCount(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(notificationsService.getUnreadCount).not.toHaveBeenCalled();
    });

    it('returns success with unread count', async () => {
      const req = mkReq();
      const res = mkRes();

      notificationsService.getUnreadCount.mockResolvedValue({ unread_count: 3 });

      await controller.getUnreadNotificationCount(req, res);

      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith({ userId: 'u1' });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { unread_count: 3 },
        'Unread notification count fetched successfully.'
      );
    });
  });

  describe('markNotificationRead', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null, params: { notification_id: 'x' } });
      const res = mkRes();

      await controller.markNotificationRead(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(notificationsService.markNotificationRead).not.toHaveBeenCalled();
    });

    it('returns validation error for invalid UUID', async () => {
      const req = mkReq({ params: { notification_id: 'not-a-uuid' } });
      const res = mkRes();

      await controller.markNotificationRead(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'notification_id must be a valid UUID.',
        400
      );
      expect(notificationsService.markNotificationRead).not.toHaveBeenCalled();
    });

    it('calls service for valid UUID and returns success', async () => {
      const req = mkReq({
        params: { notification_id: '11111111-1111-4111-8111-111111111111' },
      });
      const res = mkRes();

      notificationsService.markNotificationRead.mockResolvedValue({ success: true });

      await controller.markNotificationRead(req, res);

      expect(notificationsService.markNotificationRead).toHaveBeenCalledWith({
        notificationId: '11111111-1111-4111-8111-111111111111',
        userId: 'u1',
      });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { success: true },
        'Notification marked as read.'
      );
    });
  });

  describe('getPreferences', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null });
      const res = mkRes();

      await controller.getPreferences(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(notificationsService.getPreferences).not.toHaveBeenCalled();
    });

    it('returns preferences', async () => {
      const req = mkReq();
      const res = mkRes();

      notificationsService.getPreferences.mockResolvedValue({
        user_id: 'u1',
        new_follower_push: true,
      });

      await controller.getPreferences(req, res);

      expect(notificationsService.getPreferences).toHaveBeenCalledWith({ userId: 'u1' });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { user_id: 'u1', new_follower_push: true },
        'Notification preferences fetched successfully.'
      );
    });
  });

  describe('updatePreferences', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null, body: { new_follower_push: true } });
      const res = mkRes();

      await controller.updatePreferences(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
    });

    it('returns forbidden when user_id in body does not match token user', async () => {
      const req = mkReq({ body: { user_id: 'someone-else', new_follower_push: true } });
      const res = mkRes();

      await controller.updatePreferences(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'FORBIDDEN',
        'You can only update your own notification preferences.',
        403
      );
      expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
    });

    it('strips user_id/userId and forwards remaining updates', async () => {
      const req = mkReq({ body: { userId: 'u1', new_follower_push: true } });
      const res = mkRes();

      notificationsService.updatePreferences.mockResolvedValue({
        user_id: 'u1',
        new_follower_push: true,
      });

      await controller.updatePreferences(req, res);

      expect(notificationsService.updatePreferences).toHaveBeenCalledWith({
        userId: 'u1',
        updates: { new_follower_push: true },
      });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { user_id: 'u1', new_follower_push: true },
        'Notification preferences updated successfully.'
      );
    });

    it('bubbles service error', async () => {
      const req = mkReq({ body: { new_follower_push: true } });
      const res = mkRes();

      notificationsService.updatePreferences.mockRejectedValue(new Error('boom'));

      await expect(controller.updatePreferences(req, res)).rejects.toThrow('boom');
    });
  });
});
