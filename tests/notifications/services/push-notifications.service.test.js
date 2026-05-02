/**
 * @fileoverview Unit tests for Push Notifications Service layer
 */

const service = require('../../../src/services/push-notifications.service');
const pushTokenModel = require('../../../src/models/push-token.model');

jest.mock('../../../src/models/push-token.model');
jest.mock('../../../src/utils/fcm', () => ({
  sendPushNotification: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe('push-notifications.service', () => {
  describe('registerToken', () => {
    it('rejects missing token', async () => {
      await expect(
        service.registerToken({ userId: 'u1', token: '', platform: 'android' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });

      expect(pushTokenModel.registerToken).not.toHaveBeenCalled();
    });

    it('rejects invalid platform', async () => {
      await expect(
        service.registerToken({ userId: 'u1', token: 't', platform: 'windows' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });
    });

    it('maps platform and trims token', async () => {
      pushTokenModel.registerToken.mockResolvedValue(undefined);

      await expect(
        service.registerToken({ userId: 'u1', token: '  tok  ', platform: 'ios' })
      ).resolves.toBeUndefined();

      expect(pushTokenModel.registerToken).toHaveBeenCalledWith('u1', 'tok', 'apns');
    });
  });

  describe('unregisterToken', () => {
    it('rejects missing token', async () => {
      await expect(service.unregisterToken({ userId: 'u1', token: '   ' })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });
    });

    it('throws 404 when token not found', async () => {
      pushTokenModel.unregisterToken.mockResolvedValue(false);

      await expect(service.unregisterToken({ userId: 'u1', token: 'tok' })).rejects.toMatchObject({
        code: 'TOKEN_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('resolves when token deleted', async () => {
      pushTokenModel.unregisterToken.mockResolvedValue(true);

      await expect(
        service.unregisterToken({ userId: 'u1', token: ' tok ' })
      ).resolves.toBeUndefined();
      expect(pushTokenModel.unregisterToken).toHaveBeenCalledWith('u1', 'tok');
    });
  });

  describe('sendPushToUser', () => {
    const { sendPushNotification } = require('../../../src/utils/fcm');

    it('does nothing when preference disables for notification type', async () => {
      pushTokenModel.getPushPreferencesByUserId.mockResolvedValue({ likes_and_plays_push: false });

      await expect(
        service.sendPushToUser({ userId: 'u1', title: 't', body: 'b', data: { type: 'like' } })
      ).resolves.toBeUndefined();

      expect(pushTokenModel.getTokensByUserId).not.toHaveBeenCalled();
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('does nothing when no tokens exist', async () => {
      pushTokenModel.getPushPreferencesByUserId.mockResolvedValue(null);
      pushTokenModel.getTokensByUserId.mockResolvedValue([]);

      await service.sendPushToUser({ userId: 'u1', title: 't', body: 'b', data: { type: 'like' } });

      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('sends push to all tokens when allowed', async () => {
      pushTokenModel.getPushPreferencesByUserId.mockResolvedValue({ likes_and_plays_push: true });
      pushTokenModel.getTokensByUserId.mockResolvedValue([{ token: 'a' }, { token: 'b' }]);
      sendPushNotification.mockResolvedValue(undefined);

      await service.sendPushToUser({
        userId: 'u1',
        title: 'Hi',
        body: 'There',
        data: { type: 'like' },
      });

      expect(sendPushNotification).toHaveBeenCalledTimes(2);
      expect(sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'a', title: 'Hi', body: 'There', data: { type: 'like' } })
      );
    });

    it('sends when preferences row is missing (legacy default allow)', async () => {
      pushTokenModel.getPushPreferencesByUserId.mockResolvedValue(null);
      pushTokenModel.getTokensByUserId.mockResolvedValue([{ token: 'a' }]);
      sendPushNotification.mockResolvedValue(undefined);

      await service.sendPushToUser({ userId: 'u1', title: 'Hi', body: 'There', data: { type: 'like' } });

      expect(sendPushNotification).toHaveBeenCalledTimes(1);
      expect(sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'a', title: 'Hi', body: 'There', data: { type: 'like' } })
      );
    });

    it('sends when notification type is missing, unknown, or non-string', async () => {
      pushTokenModel.getPushPreferencesByUserId.mockResolvedValue({ likes_and_plays_push: false });
      pushTokenModel.getTokensByUserId.mockResolvedValue([{ token: 'a' }]);
      sendPushNotification.mockResolvedValue(undefined);

      await service.sendPushToUser({ userId: 'u1', title: 'Hi', body: 'There' });
      await service.sendPushToUser({
        userId: 'u1',
        title: 'Hi',
        body: 'There',
        data: { type: 'unknown_type' },
      });
      await service.sendPushToUser({
        userId: 'u1',
        title: 'Hi',
        body: 'There',
        data: { type: 123 },
      });

      expect(sendPushNotification).toHaveBeenCalledTimes(3);
    });

    it('never throws when model layer throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      pushTokenModel.getPushPreferencesByUserId.mockRejectedValue(new Error('db down'));

      await expect(
        service.sendPushToUser({ userId: 'u1', title: 'Hi', body: 'There', data: { type: 'like' } })
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('logs non-Error failures from sendPushToUser', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      pushTokenModel.getPushPreferencesByUserId.mockRejectedValue('db down');

      await service.sendPushToUser({ userId: 'u1', title: 'Hi', body: 'There' });

      expect(consoleSpy).toHaveBeenCalledWith('[Push] sendPushToUser failed:', undefined);
      consoleSpy.mockRestore();
    });
  });

  describe('sendDirectMessagePushIfEligible', () => {
    beforeEach(() => {
      jest.resetModules();

      // Default: recipient is NOT actively viewing the conversation.
      // Individual tests can override this with their own jest.doMock.
      jest.doMock('../../../src/utils/conversation-activity', () => ({
        isRecentlyActive: jest.fn().mockReturnValue(false),
      }));

      // Default: do not throttle DM pushes.
      jest.doMock('../../../src/utils/dm-push-throttle', () => ({
        isThrottled: jest.fn().mockReturnValue(false),
        markSent: jest.fn(),
      }));
    });

    it('does nothing when recipient is active in the same conversation', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../../../src/utils/conversation-activity', () => ({
        isRecentlyActive: jest.fn().mockReturnValue(true),
      }));

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue({ display_name: 'Alice' }),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: 'hi',
        embedType: null,
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('does nothing when DM push is throttled', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../../../src/utils/dm-push-throttle', () => ({
        isThrottled: jest.fn().mockReturnValue(true),
        markSent: jest.fn(),
      }));

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue({ display_name: 'Alice' }),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: 'hi',
        embedType: null,
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('does nothing when recipient has new_message_push disabled', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: false });

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn(),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: 'hi',
        embedType: null,
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('does nothing when sender identity missing', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue(null),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: 'hi',
        embedType: null,
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('truncates long message previews and sends push', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue({ display_name: 'Alice' }),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      const longBody = 'x'.repeat(150);
      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: longBody,
        embedType: null,
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u2',
          title: 'Message from Alice',
          body: 'x'.repeat(97) + '...',
          data: { type: 'new_message', conversationId: 'c1' },
        })
      );
    });

    it('uses embed preview when body missing and embed present', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue({ username: 'alice' }),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: '',
        embedType: 'track',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Message from alice',
          body: '📎 embed attached',
        })
      );
    });

    it('uses generic preview when body and embed are missing', async () => {
      const tokenModel = require('../../../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../../../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue({ display_name: 'Alice' }),
      }));

      const svc = require('../../../src/services/push-notifications.service');
      const spy = jest.spyOn(svc, 'sendPushToUser').mockResolvedValue(undefined);

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: '',
        embedType: null,
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Message from Alice',
          body: 'New message',
          data: { type: 'new_message', conversationId: 'c1' },
        })
      );
    });

    it('uses fallback sender name and swallows sendPushToUser rejection', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const tokenModel = require('../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockResolvedValue({ new_message_push: true });

      jest.doMock('../src/models/notification.model', () => ({
        getUserEmailIdentity: jest.fn().mockResolvedValue({ display_name: '', username: '' }),
      }));

      const throttle = { isThrottled: jest.fn().mockReturnValue(false), markSent: jest.fn() };
      jest.doMock('../src/utils/dm-push-throttle', () => throttle);

      const svc = require('../src/services/push-notifications.service');
      jest.spyOn(svc, 'sendPushToUser').mockRejectedValue('push failed');

      await svc.sendDirectMessagePushIfEligible({
        conversationId: 'c1',
        senderId: 'u1',
        recipientId: 'u2',
        messageBody: 'hi',
        embedType: null,
      });

      expect(svc.sendPushToUser).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Message from Someone' })
      );
      expect(throttle.markSent).toHaveBeenCalledWith({ recipientId: 'u2', conversationId: 'c1' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Push] Direct message push failed:',
        undefined
      );
      consoleSpy.mockRestore();
    });

    it('swallows unexpected direct-message push errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const tokenModel = require('../src/models/push-token.model');
      tokenModel.getPushPreferencesByUserId.mockRejectedValue('prefs down');

      const svc = require('../src/services/push-notifications.service');

      await expect(
        svc.sendDirectMessagePushIfEligible({
          conversationId: 'c1',
          senderId: 'u1',
          recipientId: 'u2',
          messageBody: 'hi',
          embedType: null,
        })
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Direct message push notification skipped:',
        'prefs down'
      );
      consoleSpy.mockRestore();
    });
  });
});
