/**
 * @fileoverview Unit tests for Notification Model layer
 */

const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/sockets/notifications.socket', () => ({
  emitNotificationCreated: jest.fn(),
  emitNotificationRead: jest.fn(),
}));
jest.mock('../src/services/push-notifications.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

const socket = require('../src/sockets/notifications.socket');
const pushService = require('../src/services/push-notifications.service');
const model = require('../src/models/notification.model');

beforeEach(() => jest.clearAllMocks());

describe('notification.model', () => {
  describe('findRecentDuplicate', () => {
    it('returns null without querying when no cooldown interval exists', async () => {
      await expect(model.findRecentDuplicate('u1', 'u2', 'comment', 'r1')).resolves.toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('queries with reference_id IS NULL when referenceId omitted', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await model.findRecentDuplicate('u1', 'u2', 'like', null);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('reference_id IS NULL'),
        ['u1', 'u2', 'like']
      );
    });

    it('queries with reference_id = $4 when referenceId provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });

      const result = await model.findRecentDuplicate('u1', 'u2', 'like', 't1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('reference_id = $4'),
        ['u1', 'u2', 'like', 't1']
      );
      expect(result).toEqual({ id: 'n1' });
    });
  });

  describe('createNotification', () => {
    it('inserts, emits created event, and fires push for action-based types', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            user_id: 'u1',
            action_user_id: 'u2',
            type: 'follow',
            reference_id: null,
            reference_type: null,
            is_read: false,
            created_at: '2026-04-30',
          },
        ],
      });

      jest.spyOn(model, 'getUserEmailIdentity').mockResolvedValue({ display_name: 'Alice' });

      const created = await model.createNotification({
        userId: 'u1',
        actionUserId: 'u2',
        type: 'follow',
        referenceId: null,
        referenceType: null,
      });

      expect(created).toEqual(expect.objectContaining({ id: 'n1', type: 'follow' }));

      expect(socket.emitNotificationCreated).toHaveBeenCalledWith({
        userId: 'u1',
        notification: expect.objectContaining({
          id: 'n1',
          type: 'follow',
          resource_type: null,
          resource_id: null,
          is_read: false,
          action_user_id: 'u2',
        }),
      });

      expect(pushService.sendPushToUser).toHaveBeenCalledWith({
        userId: 'u1',
        title: 'New Follower',
        body: 'Alice started following you.',
        data: { type: 'follow', referenceId: '' },
      });
    });

    it('fires system push for artist_pro_activated', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'n2',
            user_id: 'u1',
            action_user_id: 'u2',
            type: 'artist_pro_activated',
            reference_id: null,
            reference_type: null,
            is_read: false,
            created_at: '2026-04-30',
          },
        ],
      });

      await model.createNotification({
        userId: 'u1',
        actionUserId: 'u2',
        type: 'artist_pro_activated',
      });

      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          title: 'Artist Pro Activated',
          body: 'Congratulations! You are now an Artist Pro member.',
          data: { type: 'artist_pro_activated', referenceId: '' },
        })
      );
    });

    it('does not fire push for types without a mapping', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'n3',
            user_id: 'u1',
            action_user_id: 'u2',
            type: 'report_received',
            reference_id: null,
            reference_type: null,
            is_read: false,
            created_at: '2026-04-30',
          },
        ],
      });

      await model.createNotification({ userId: 'u1', actionUserId: 'u2', type: 'report_received' });

      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });
  });

  describe('countUnread', () => {
    it('returns total unread count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      await expect(model.countUnread('u1')).resolves.toBe(5);
    });
  });

  describe('findNotificationById', () => {
    it('returns row or null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
      await expect(model.findNotificationById('n1')).resolves.toEqual({ id: 'n1' });

      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(model.findNotificationById('n2')).resolves.toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('updates and emits notification:read', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'n1', user_id: 'u1' }] });

      await model.markAsRead('n1');

      expect(socket.emitNotificationRead).toHaveBeenCalledWith({ userId: 'u1', notificationId: 'n1' });
    });

    it('does not emit when update returned no row', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await model.markAsRead('n1');

      expect(socket.emitNotificationRead).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreatePreferences', () => {
    it('returns existing row when found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] });
      await expect(model.findOrCreatePreferences('u1')).resolves.toEqual({ user_id: 'u1' });
    });

    it('creates row when missing', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1', new_follower_push: true }] });

      await expect(model.findOrCreatePreferences('u1')).resolves.toEqual({
        user_id: 'u1',
        new_follower_push: true,
      });
    });

    it('fetches existing row when insert conflicts', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] });

      await expect(model.findOrCreatePreferences('u1')).resolves.toEqual({ user_id: 'u1' });
      expect(db.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('updatePreferences', () => {
    it('builds dynamic update query and returns row', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 'u1', new_follower_push: true }] });

      const updated = await model.updatePreferences('u1', { new_follower_push: true, new_follower_email: false });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_preferences'),
        [true, false, 'u1']
      );
      expect(updated).toEqual({ user_id: 'u1', new_follower_push: true });
    });
  });
});
