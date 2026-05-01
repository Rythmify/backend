/**
 * @fileoverview Unit tests for Notifications Service layer
 */

const service = require('../src/services/notifications.service');
const model = require('../src/models/notification.model');
const emailNotificationsService = require('../src/services/email-notifications.service');

jest.mock('../src/models/notification.model');
jest.mock('../src/services/email-notifications.service', () => ({
  sendGeneralNotificationEmailIfEligible: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe('notifications.service', () => {
  describe('createNotification', () => {
    it('returns null and does nothing when userId equals actionUserId', async () => {
      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u1',
          type: 'follow',
          referenceId: null,
          referenceType: null,
        })
      ).resolves.toBeNull();

      expect(model.findRecentDuplicate).not.toHaveBeenCalled();
      expect(model.createNotification).not.toHaveBeenCalled();
    });

    it('returns null when a recent duplicate exists', async () => {
      model.findRecentDuplicate.mockResolvedValue({ id: 'n1' });

      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u2',
          type: 'like',
          referenceId: 't1',
          referenceType: 'track',
        })
      ).resolves.toBeNull();

      expect(model.findRecentDuplicate).toHaveBeenCalled();
      expect(model.findOrCreatePreferences).not.toHaveBeenCalled();
      expect(model.createNotification).not.toHaveBeenCalled();
    });

    it('creates in-app notification when preference allows', async () => {
      model.findRecentDuplicate.mockResolvedValue(null);
      model.findOrCreatePreferences.mockResolvedValue({ likes_and_plays_in_app: true });
      model.createNotification.mockResolvedValue({ id: 'n1', type: 'like' });

      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u2',
          type: 'like',
          referenceId: 't1',
          referenceType: 'track',
        })
      ).resolves.toEqual({ id: 'n1', type: 'like' });

      expect(model.createNotification).toHaveBeenCalledWith({
        userId: 'u1',
        actionUserId: 'u2',
        type: 'like',
        referenceId: 't1',
        referenceType: 'track',
      });
    });

    it('does not create in-app notification when disabled, but still may send email', async () => {
      model.findRecentDuplicate.mockResolvedValue(null);
      model.findOrCreatePreferences.mockResolvedValue({
        new_follower_in_app: false,
        new_follower_email: true,
      });

      emailNotificationsService.sendGeneralNotificationEmailIfEligible.mockResolvedValue(undefined);

      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u2',
          type: 'follow',
          referenceId: null,
          referenceType: null,
        })
      ).resolves.toBeNull();

      expect(model.createNotification).not.toHaveBeenCalled();
      expect(emailNotificationsService.sendGeneralNotificationEmailIfEligible).toHaveBeenCalledWith({
        recipientUserId: 'u1',
        actionUserId: 'u2',
        type: 'follow',
      });
    });

    it('swallows email failures (does not throw)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      model.findRecentDuplicate.mockResolvedValue(null);
      model.findOrCreatePreferences.mockResolvedValue({
        new_follower_in_app: true,
        new_follower_email: true,
      });
      model.createNotification.mockResolvedValue({ id: 'n1' });

      emailNotificationsService.sendGeneralNotificationEmailIfEligible.mockRejectedValue(
        new Error('smtp down')
      );

      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u2',
          type: 'follow',
          referenceId: null,
          referenceType: null,
        })
      ).resolves.toEqual({ id: 'n1' });

      consoleSpy.mockRestore();
    });

    it('logs when push preference is enabled because model handles push delivery', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      model.findRecentDuplicate.mockResolvedValue(null);
      model.findOrCreatePreferences.mockResolvedValue({
        comment_on_post_in_app: true,
        comment_on_post_push: true,
      });
      model.createNotification.mockResolvedValue({ id: 'n1', type: 'comment' });

      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u2',
          type: 'comment',
          referenceId: 'c1',
          referenceType: 'comment',
        })
      ).resolves.toEqual({ id: 'n1', type: 'comment' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Notifications] Push handled in model layer. userId=u1 type=comment'
      );
    });

    it('defaults unknown notification types to in-app only', async () => {
      model.findRecentDuplicate.mockResolvedValue(null);
      model.findOrCreatePreferences.mockResolvedValue({});
      model.createNotification.mockResolvedValue({ id: 'n-report', type: 'report_received' });

      await expect(
        service.createNotification({
          userId: 'u1',
          actionUserId: 'u2',
          type: 'report_received',
        })
      ).resolves.toEqual({ id: 'n-report', type: 'report_received' });

      expect(model.createNotification).toHaveBeenCalledWith({
        userId: 'u1',
        actionUserId: 'u2',
        type: 'report_received',
        referenceId: null,
        referenceType: null,
      });
      expect(emailNotificationsService.sendGeneralNotificationEmailIfEligible).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('throws validation error for invalid type', async () => {
      await expect(
        service.getNotifications({ userId: 'u1', unreadOnly: null, type: 'nope', page: 1, limit: 10 })
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    });

    it('returns formatted notifications and pagination', async () => {
      model.findNotifications.mockResolvedValue([
        {
          id: 'n1',
          type: 'like',
          actor_id: 'u2',
          actor_username: 'bob',
          actor_display_name: 'Bob',
          actor_avatar: null,
          resource_type: 'track',
          resource_id: 't1',
          track_title: 'Song',
          playlist_title: null,
          comment_content: null,
          is_read: false,
          created_at: '2026-04-30',
        },
      ]);
      model.countNotifications.mockResolvedValue(1);
      model.countUnread.mockResolvedValue(7);

      const result = await service.getNotifications({
        userId: 'u1',
        unreadOnly: 'true',
        type: 'like',
        page: '1',
        limit: '20',
      });

      expect(model.findNotifications).toHaveBeenCalledWith('u1', {
        unreadOnly: true,
        type: 'like',
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual(
        expect.objectContaining({
          items: [
            {
              id: 'n1',
              type: 'like',
              actor: {
                id: 'u2',
                username: 'bob',
                display_name: 'Bob',
                avatar: null,
              },
              resource_type: 'track',
              resource_id: 't1',
              resource_details: { title: 'Song' },
              is_read: false,
              created_at: '2026-04-30',
            },
          ],
          unread_count: 7,
          pagination: expect.objectContaining({
            page: 1,
            per_page: 20,
            total_items: 1,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          }),
        })
      );
    });

    it('sanitizes limit and page', async () => {
      model.findNotifications.mockResolvedValue([]);
      model.countNotifications.mockResolvedValue(0);
      model.countUnread.mockResolvedValue(0);

      await service.getNotifications({ userId: 'u1', unreadOnly: null, type: null, page: '-10', limit: '999' });

      expect(model.findNotifications).toHaveBeenCalledWith('u1', expect.objectContaining({ limit: 50, offset: 0 }));
    });

    it.each([
      [1, true],
      [0, false],
      ['YES', true],
      ['off', false],
      ['maybe', null],
      [{}, null],
    ])('coerces unreadOnly %p to %p', async (unreadOnly, expected) => {
      model.findNotifications.mockResolvedValue([]);
      model.countNotifications.mockResolvedValue(0);
      model.countUnread.mockResolvedValue(0);

      await service.getNotifications({
        userId: 'u1',
        unreadOnly,
        type: null,
        page: 1,
        limit: 10,
      });

      expect(model.findNotifications).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ unreadOnly: expected })
      );
      expect(model.countNotifications).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ unreadOnly: expected })
      );
    });

    it('formats playlist, comment, and empty resource details', async () => {
      model.findNotifications.mockResolvedValue([
        {
          id: 'n-playlist',
          type: 'repost',
          actor_id: 'u2',
          actor_username: 'bob',
          actor_display_name: 'Bob',
          actor_avatar: 'avatar.png',
          resource_type: 'playlist',
          resource_id: 'p1',
          playlist_title: 'Road Mix',
          is_read: false,
          created_at: '2026-04-30',
        },
        {
          id: 'n-comment',
          type: 'comment',
          actor_id: 'u3',
          actor_username: 'sam',
          actor_display_name: 'Sam',
          actor_avatar: null,
          resource_type: 'comment',
          resource_id: 'c1',
          comment_content: 'Nice track',
          is_read: true,
          created_at: '2026-04-29',
        },
        {
          id: 'n-follow',
          type: 'follow',
          actor_id: 'u4',
          actor_username: 'lee',
          actor_display_name: 'Lee',
          actor_avatar: null,
          resource_type: null,
          resource_id: null,
          is_read: false,
          created_at: '2026-04-28',
        },
      ]);
      model.countNotifications.mockResolvedValue(3);
      model.countUnread.mockResolvedValue(1);

      const result = await service.getNotifications({
        userId: 'u1',
        unreadOnly: null,
        type: null,
        page: 2,
        limit: 2,
      });

      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'n-playlist',
          actor: expect.objectContaining({ avatar: 'avatar.png' }),
          resource_details: { title: 'Road Mix' },
        }),
        expect.objectContaining({
          id: 'n-comment',
          resource_details: { content: 'Nice track' },
        }),
        expect.objectContaining({
          id: 'n-follow',
          resource_type: null,
          resource_id: null,
          resource_details: null,
        }),
      ]);
      expect(result.pagination).toEqual(
        expect.objectContaining({
          page: 2,
          per_page: 2,
          total_items: 3,
          total_pages: 2,
          has_next: false,
          has_prev: true,
        })
      );
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count payload', async () => {
      model.countUnread.mockResolvedValue(4);

      await expect(service.getUnreadCount({ userId: 'u1' })).resolves.toEqual({
        unread_count: 4,
      });

      expect(model.countUnread).toHaveBeenCalledWith('u1');
    });
  });

  describe('markNotificationRead', () => {
    it('throws 404 when notification not found', async () => {
      model.findNotificationById.mockResolvedValue(null);

      await expect(service.markNotificationRead({ notificationId: 'n1', userId: 'u1' })).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws 403 when notification does not belong to user', async () => {
      model.findNotificationById.mockResolvedValue({ id: 'n1', user_id: 'someone-else', is_read: false });

      await expect(service.markNotificationRead({ notificationId: 'n1', userId: 'u1' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });

    it('is idempotent when already read', async () => {
      model.findNotificationById.mockResolvedValue({ id: 'n1', user_id: 'u1', is_read: true });

      await expect(service.markNotificationRead({ notificationId: 'n1', userId: 'u1' })).resolves.toEqual({
        success: true,
      });

      expect(model.markAsRead).not.toHaveBeenCalled();
    });

    it('marks as read when unread', async () => {
      model.findNotificationById.mockResolvedValue({ id: 'n1', user_id: 'u1', is_read: false });
      model.markAsRead.mockResolvedValue({ id: 'n1', is_read: true });

      await expect(service.markNotificationRead({ notificationId: 'n1', userId: 'u1' })).resolves.toEqual({
        success: true,
      });

      expect(model.markAsRead).toHaveBeenCalledWith('n1');
    });
  });

  describe('getPreferences', () => {
    it('returns normalized preference payload', async () => {
      model.findOrCreatePreferences.mockResolvedValue({
        user_id: 'u1',
        messages_from: 'everyone',
        new_follower_push: true,
        repost_of_your_post_push: false,
        new_post_by_followed_push: true,
        likes_and_plays_push: false,
        comment_on_post_push: true,
        recommended_content_push: false,
        new_message_push: true,
        feature_updates_push: false,
        surveys_and_feedback_push: false,
        promotional_content_push: false,
        new_follower_email: false,
        repost_of_your_post_email: false,
        new_post_by_followed_email: false,
        likes_and_plays_email: false,
        comment_on_post_email: false,
        recommended_content_email: false,
        new_message_email: false,
        feature_updates_email: false,
        surveys_and_feedback_email: false,
        promotional_content_email: false,
        newsletter_email: false,
      });

      const result = await service.getPreferences({ userId: 'u1' });

      expect(result).toEqual(expect.objectContaining({ user_id: 'u1', messages_from: 'everyone', new_follower_push: true }));
    });
  });

  describe('updatePreferences', () => {
    const PREFERENCE_BOOLEAN_FIELDS = [
      'new_follower_push',
      'new_follower_email',
      'likes_and_plays_push',
      'likes_and_plays_email',
    ];

    beforeEach(() => {
      model.PREFERENCE_BOOLEAN_FIELDS = PREFERENCE_BOOLEAN_FIELDS;
      model.MESSAGES_FROM_VALUES = ['everyone', 'followers_only', 'nobody'];
    });

    it('rejects unknown fields', async () => {
      await expect(
        service.updatePreferences({ userId: 'u1', updates: { nope: true } })
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    });

    it('rejects empty updates after stripping in-app fields', async () => {
      await expect(
        service.updatePreferences({ userId: 'u1', updates: { new_follower_in_app: true } })
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    });

    it('rejects non-boolean values for boolean fields', async () => {
      await expect(
        service.updatePreferences({ userId: 'u1', updates: { new_follower_push: 'true' } })
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    });

    it('rejects invalid messages_from', async () => {
      await expect(
        service.updatePreferences({ userId: 'u1', updates: { messages_from: 'cats' } })
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    });

    it('updates preferences and returns getPreferences result', async () => {
      model.findOrCreatePreferences.mockResolvedValue({ user_id: 'u1' });
      model.updatePreferences.mockResolvedValue({ user_id: 'u1' });

      model.findOrCreatePreferences.mockResolvedValueOnce({ user_id: 'u1' });
      model.findOrCreatePreferences.mockResolvedValueOnce({
        user_id: 'u1',
        messages_from: 'everyone',
        new_follower_push: true,
        likes_and_plays_push: false,
        new_follower_email: false,
        likes_and_plays_email: false,
      });

      const result = await service.updatePreferences({
        userId: 'u1',
        updates: { new_follower_push: true, new_follower_in_app: true },
      });

      expect(model.updatePreferences).toHaveBeenCalledWith('u1', { new_follower_push: true });
      expect(result).toEqual(expect.objectContaining({ user_id: 'u1', new_follower_push: true }));
    });

    it('accepts valid messages_from updates', async () => {
      model.findOrCreatePreferences.mockResolvedValueOnce({ user_id: 'u1' });
      model.updatePreferences.mockResolvedValue({ user_id: 'u1', messages_from: 'nobody' });
      model.findOrCreatePreferences.mockResolvedValueOnce({
        user_id: 'u1',
        messages_from: 'nobody',
        new_follower_push: false,
        new_follower_email: false,
      });

      const result = await service.updatePreferences({
        userId: 'u1',
        updates: { messages_from: 'nobody' },
      });

      expect(model.updatePreferences).toHaveBeenCalledWith('u1', { messages_from: 'nobody' });
      expect(result).toEqual(expect.objectContaining({ user_id: 'u1', messages_from: 'nobody' }));
    });
  });
});
