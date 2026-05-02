const service = require('../../../src/services/messages.service');
const model = require('../../../src/models/message.model');
const tracksService = require('../../../src/services/tracks.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/message.model');
jest.mock('../../../src/services/tracks.service', () => ({
  getTrackById: jest.fn(),
}));
jest.mock('../../../src/services/email-notifications.service', () => ({
  sendDirectMessageEmailIfEligible: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../src/services/push-notifications.service', () => ({
  sendDirectMessagePushIfEligible: jest.fn().mockResolvedValue(),
}));

beforeEach(() => jest.clearAllMocks());

const validTrackId = '11111111-1111-4111-8111-111111111111';

const baseConversation = {
  id: 'c1',
  user_a_id: 'u1',
  user_b_id: 'u2',
  deleted_by_a: false,
  deleted_by_b: false,
  created_at: '2026-01-01',
  last_message_at: '2026-01-01',
};

describe('messages.service', () => {
  describe('assertConversationAccess', () => {
    it('throws 404 when conversation does not exist', async () => {
      model.findConversationById.mockResolvedValue(null);

      await expect(
        service.assertConversationAccess({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND', statusCode: 404 });
    });

    it('throws 403 when user is not a participant', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'x',
        user_b_id: 'y',
      });

      await expect(
        service.assertConversationAccess({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    });

    it('throws 404 when conversation is soft-deleted for user and allowSoftDeleted is false', async () => {
      model.findConversationById.mockResolvedValue({ ...baseConversation, deleted_by_a: true });

      await expect(
        service.assertConversationAccess({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND', statusCode: 404 });
    });

    it('returns conversation when soft-deleted but allowSoftDeleted is true', async () => {
      const conversation = { ...baseConversation, deleted_by_a: true };
      model.findConversationById.mockResolvedValue(conversation);

      await expect(
        service.assertConversationAccess({
          conversationId: 'c1',
          userId: 'u1',
          allowSoftDeleted: true,
        })
      ).resolves.toEqual(conversation);
    });

    it('returns conversation for active participant', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);

      await expect(
        service.assertConversationAccess({ conversationId: 'c1', userId: 'u1' })
      ).resolves.toEqual(baseConversation);
    });
  });

  describe('startConversation', () => {
    it('rejects when senderId is undefined', async () => {
      await expect(
        service.startConversation({ senderId: undefined, recipientId: 'u2', body: 'x' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

      expect(model.findActiveUserById).not.toHaveBeenCalled();
    });

    it('rejects when senderId is null', async () => {
      await expect(
        service.startConversation({ senderId: null, recipientId: 'u2', body: 'x' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

      expect(model.findActiveUserById).not.toHaveBeenCalled();
    });

    it('rejects self message', async () => {
      await expect(
        service.startConversation({ senderId: 'u1', recipientId: 'u1', body: 'x' })
      ).rejects.toBeInstanceOf(AppError);
    });

    it('rejects when recipient missing', async () => {
      model.findActiveUserById.mockResolvedValue(null);
      await expect(
        service.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'x' })
      ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
    });

    it('rejects blocked', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(true);

      await expect(
        service.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'x' })
      ).rejects.toMatchObject({ code: 'MESSAGES_BLOCKED' });
    });

    it('rejects followers_only when recipient not following sender', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('followers_only');
      model.isFollowing.mockResolvedValue(false);

      await expect(
        service.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'x' })
      ).rejects.toMatchObject({ code: 'MESSAGES_FOLLOWERS_ONLY' });
    });

    it('rejects empty payload', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          body: '   ',
          resource: null,
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_EMPTY' });
    });

    it('rejects body too long', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'x'.repeat(2001) })
      ).rejects.toMatchObject({ code: 'MESSAGES_BODY_TOO_LONG' });
    });

    it('rejects invalid embed type', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          body: '',
          resource: { type: 'album', id: 'a1' },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_TYPE' });
    });

    it('rejects non-object embedded resource', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          resource: 'invalid',
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_RESOURCE', statusCode: 400 });
    });

    it('rejects embedded resource missing fields', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          resource: { type: 'track' },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_RESOURCE', statusCode: 400 });
    });

    it('creates conversation when new', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.findConversationByPair.mockResolvedValue(null);
      model.createConversation.mockResolvedValue({ id: 'c1' });
      model.createMessage.mockResolvedValue({ id: 'm1' });

      const out = await service.startConversation({
        senderId: 'u1',
        recipientId: 'u2',
        body: ' hi ',
      });

      expect(out.isNew).toBe(true);
      expect(model.createConversation).toHaveBeenCalled();
      expect(model.createMessage).toHaveBeenCalledWith(expect.objectContaining({ body: 'hi' }));
    });

    it('uses existing conversation', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      tracksService.getTrackById.mockResolvedValue({ id: validTrackId });
      model.findConversationByPair.mockResolvedValue({ id: 'cExisting' });
      model.createMessage.mockResolvedValue({ id: 'm1' });

      const out = await service.startConversation({
        senderId: 'u1',
        recipientId: 'u2',
        resource: { type: 'track', id: validTrackId },
      });

      expect(out.isNew).toBe(false);
      expect(model.createConversation).not.toHaveBeenCalled();
    });

    it('rejects invalid track resource id', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          resource: { type: 'track', id: 'not-a-uuid' },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_ID', statusCode: 400 });
    });

    it('rejects when embedded track does not exist', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      tracksService.getTrackById.mockRejectedValue({ code: 'TRACK_NOT_FOUND' });

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          resource: { type: 'track', id: validTrackId },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_EMBED_TRACK_NOT_FOUND', statusCode: 404 });
    });

    it('rethrows unexpected track lookup errors', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      tracksService.getTrackById.mockRejectedValue(new Error('track backend down'));

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          resource: { type: 'track', id: validTrackId },
        })
      ).rejects.toThrow('track backend down');
    });

    it('accepts playlist resource without existence validation', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.findConversationByPair.mockResolvedValue(null);
      model.createConversation.mockResolvedValue({ id: 'c1' });
      model.createMessage.mockResolvedValue({ id: 'm1' });

      await expect(
        service.startConversation({
          senderId: 'u1',
          recipientId: 'u2',
          resource: { type: 'playlist', id: validTrackId },
        })
      ).resolves.toEqual(expect.objectContaining({ isNew: true }));
    });
  });

  describe('ensureConversation', () => {
    it('rejects when sender tries to ensure with self', async () => {
      await expect(
        service.ensureConversation({ senderId: 'u1', recipientId: 'u1' })
      ).rejects.toMatchObject({ code: 'MESSAGES_SELF_MESSAGE', statusCode: 400 });
    });

    it('rejects when recipient not found', async () => {
      model.findActiveUserById.mockResolvedValue(null);

      await expect(
        service.ensureConversation({ senderId: 'u1', recipientId: 'u2' })
      ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
    });

    it('creates conversation when new', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.findConversationByPair.mockResolvedValue(null);
      model.createConversation.mockResolvedValue({ id: 'c1', user_a_id: 'u1', user_b_id: 'u2' });

      const out = await service.ensureConversation({ senderId: 'u1', recipientId: 'u2' });

      expect(out).toEqual({
        conversation: expect.objectContaining({ id: 'c1' }),
        isNew: true,
      });
      expect(model.createConversation).toHaveBeenCalledWith('u1', 'u2');
    });

    it('returns existing conversation and restores for sender if soft-deleted', async () => {
      model.findActiveUserById.mockResolvedValue({ id: 'u2' });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.findConversationByPair.mockResolvedValue({
        id: 'c1',
        user_a_id: 'u1',
        user_b_id: 'u2',
        deleted_by_a: true,
        deleted_by_b: false,
      });

      const out = await service.ensureConversation({ senderId: 'u1', recipientId: 'u2' });

      expect(out.isNew).toBe(false);
      expect(model.restoreConversationForUser).toHaveBeenCalledWith('c1', true);
    });
  });

  describe('listConversations', () => {
    it('applies pagination bounds and maps shape', async () => {
      model.findConversationsByUserId.mockResolvedValue([
        {
          id: 'c1',
          participant_id: 'u2',
          participant_display_name: 'B',
          participant_avatar: null,
          participant_username: 'b',
          last_message_id: 'm1',
          last_message_sender_id: 'u1',
          last_message_body: 'hello',
          last_message_embed_type: null,
          last_message_embed_id: null,
          last_message_is_read: false,
          last_message_created_at: '2026-01-01',
          unread_count: 3,
          created_at: '2026-01-01',
          updated_at: '2026-01-02',
        },
      ]);
      model.countConversationsByUserId.mockResolvedValue(1);

      const out = await service.listConversations({ userId: 'u1', page: '0', limit: '999' });

      // Service caps limit at 50
      expect(model.findConversationsByUserId).toHaveBeenCalledWith('u1', 50, 0);
      expect(out.items[0].last_message.id).toBe('m1');
      expect(out.pagination.total_pages).toBe(1);
    });

    it('maps null last_message', async () => {
      model.findConversationsByUserId.mockResolvedValue([
        {
          id: 'c1',
          participant_id: 'u2',
          participant_display_name: 'B',
          participant_avatar: null,
          participant_username: 'b',
          last_message_id: null,
          unread_count: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-02',
        },
      ]);
      model.countConversationsByUserId.mockResolvedValue(1);

      const out = await service.listConversations({ userId: 'u1' });
      expect(out.items[0].last_message).toBeNull();
    });

    it('defaults pagination for invalid values', async () => {
      model.findConversationsByUserId.mockResolvedValue([]);
      model.countConversationsByUserId.mockResolvedValue(0);

      const out = await service.listConversations({ userId: 'u1', page: 'abc', limit: 'xyz' });

      // Service defaults: page=1, limit=20 (not 8)
      expect(model.findConversationsByUserId).toHaveBeenCalledWith('u1', 20, 0);
      expect(out.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
      });
    });
  });

  describe('getConversation', () => {
    it('404 when conversation not found', async () => {
      model.findConversationById.mockResolvedValue(null);
      await expect(
        service.getConversation({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('403 when not participant', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'x',
        user_b_id: 'y',
      });
      await expect(
        service.getConversation({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('404 when soft deleted by user', async () => {
      model.findConversationById.mockResolvedValue({ ...baseConversation, deleted_by_a: true });
      await expect(
        service.getConversation({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('returns conversation payload', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessagesByConversationId.mockResolvedValue([{ id: 'm1' }]);
      model.countMessagesByConversationId.mockResolvedValue(1);
      model.findConversationPartner.mockResolvedValue({ id: 'u2' });
      model.countUnreadMessages.mockResolvedValue(0);

      const out = await service.getConversation({
        conversationId: 'c1',
        userId: 'u1',
        page: '-1',
        limit: '999',
      });

      expect(model.findMessagesByConversationId).toHaveBeenCalledWith('c1', 100, 0);
      expect(out.pagination.total_pages).toBe(1);
    });

    it('uses default pagination when page/limit are invalid', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessagesByConversationId.mockResolvedValue([]);
      model.countMessagesByConversationId.mockResolvedValue(0);
      model.findConversationPartner.mockResolvedValue({ id: 'u2' });
      model.countUnreadMessages.mockResolvedValue(0);

      const out = await service.getConversation({
        conversationId: 'c1',
        userId: 'u1',
        page: 'abc',
        limit: null,
      });

      expect(model.findMessagesByConversationId).toHaveBeenCalledWith('c1', 50, 0);
      expect(out.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 0,
        total_pages: 0,
      });
    });
  });

  describe('sendMessage', () => {
    it('rejects when senderId is undefined', async () => {
      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: undefined, body: 'x' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

      expect(model.findConversationById).not.toHaveBeenCalled();
    });

    it('rejects when senderId is null', async () => {
      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: null, body: 'x' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

      expect(model.findConversationById).not.toHaveBeenCalled();
    });

    it('404 when conversation missing', async () => {
      model.findConversationById.mockResolvedValue(null);
      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('403 when sender not participant', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'x',
        user_b_id: 'y',
      });
      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('restores recipient conversation when recipient had deleted', async () => {
      model.findConversationById.mockResolvedValue({ ...baseConversation, deleted_by_b: true });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.createMessage.mockResolvedValue({ id: 'm1' });

      await service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' });

      expect(model.restoreConversationForUser).toHaveBeenCalledWith('c1', false);
    });

    it('restores sender conversation when sender had deleted', async () => {
      model.findConversationById.mockResolvedValue({ ...baseConversation, deleted_by_a: true });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.createMessage.mockResolvedValue({ id: 'm1' });

      await service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' });

      expect(model.restoreConversationForUser).toHaveBeenCalledWith('c1', true);
    });

    it('restores both sides when both had deleted and a new message is sent', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        deleted_by_a: true,
        deleted_by_b: true,
      });
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.createMessage.mockResolvedValue({ id: 'm1' });

      await service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' });

      expect(model.restoreConversationForUser).toHaveBeenCalledTimes(2);
      expect(model.restoreConversationForUser).toHaveBeenNthCalledWith(1, 'c1', true);
      expect(model.restoreConversationForUser).toHaveBeenNthCalledWith(2, 'c1', false);
    });

    it('blocks on blocked recipient', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(true);

      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' })
      ).rejects.toMatchObject({ code: 'MESSAGES_BLOCKED' });
    });

    it('followers_only rejection', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('followers_only');
      model.isFollowing.mockResolvedValue(false);

      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: 'x' })
      ).rejects.toMatchObject({ code: 'MESSAGES_FOLLOWERS_ONLY' });
    });

    it('empty payload rejection', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.sendMessage({ conversationId: 'c1', senderId: 'u1', body: ' ' })
      ).rejects.toMatchObject({ code: 'MESSAGES_EMPTY' });
    });

    it('body too long rejection', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          body: 'x'.repeat(2001),
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_BODY_TOO_LONG' });
    });

    it('invalid embed rejection', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          body: '',
          resource: { type: 'album', id: 'a1' },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_TYPE' });
    });

    it('inserts valid message', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.createMessage.mockResolvedValue({ id: 'm1' });

      const out = await service.sendMessage({
        conversationId: 'c1',
        senderId: 'u1',
        body: ' hi ',
      });

      expect(out.id).toBe('m1');
      expect(model.createMessage).toHaveBeenCalledWith(expect.objectContaining({ body: 'hi' }));
    });

    it('rejects invalid track resource id', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          resource: { type: 'track', id: 'bad-id' },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_ID', statusCode: 400 });
    });

    it('rejects non-object embedded resource', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          resource: 123,
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_RESOURCE', statusCode: 400 });
    });

    it('rejects embedded resource missing fields', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          resource: { id: validTrackId },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_RESOURCE', statusCode: 400 });
    });

    it('rejects when embedded track does not exist', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      tracksService.getTrackById.mockRejectedValue({ code: 'TRACK_NOT_FOUND' });

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          resource: { type: 'track', id: validTrackId },
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_EMBED_TRACK_NOT_FOUND', statusCode: 404 });
    });

    it('rethrows unexpected track lookup errors', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      tracksService.getTrackById.mockRejectedValue(new Error('track backend down'));

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          resource: { type: 'track', id: validTrackId },
        })
      ).rejects.toThrow('track backend down');
    });

    it('accepts playlist resource without existence validation', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.isBlocked.mockResolvedValue(false);
      model.getMessagesFromPreference.mockResolvedValue('everyone');
      model.createMessage.mockResolvedValue({ id: 'm2' });

      await expect(
        service.sendMessage({
          conversationId: 'c1',
          senderId: 'u1',
          resource: { type: 'playlist', id: validTrackId },
        })
      ).resolves.toEqual(expect.objectContaining({ id: 'm2' }));
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread_count', async () => {
      model.countTotalUnreadMessages.mockResolvedValue(9);
      await expect(service.getUnreadCount({ userId: 'u1' })).resolves.toEqual({ unread_count: 9 });
    });
  });

  describe('markMessageReadState', () => {
    it('404 conversation missing', async () => {
      model.findConversationById.mockResolvedValue(null);
      await expect(
        service.markMessageReadState({
          conversationId: 'c1',
          messageId: 'm1',
          userId: 'u1',
          isRead: true,
        })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('403 non-participant', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'x',
        user_b_id: 'y',
      });
      await expect(
        service.markMessageReadState({
          conversationId: 'c1',
          messageId: 'm1',
          userId: 'u1',
          isRead: true,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('404 message missing', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue(null);
      await expect(
        service.markMessageReadState({
          conversationId: 'c1',
          messageId: 'm1',
          userId: 'u1',
          isRead: true,
        })
      ).rejects.toMatchObject({ code: 'MESSAGE_NOT_FOUND' });
    });

    it('403 sender cannot mark own message', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u1', is_read: false });
      await expect(
        service.markMessageReadState({
          conversationId: 'c1',
          messageId: 'm1',
          userId: 'u1',
          isRead: true,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('409 on same read state', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u2', is_read: true });
      await expect(
        service.markMessageReadState({
          conversationId: 'c1',
          messageId: 'm1',
          userId: 'u1',
          isRead: true,
        })
      ).rejects.toMatchObject({ code: 'MESSAGES_READ_STATE_CONFLICT' });
    });

    it('updates read state', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u2', is_read: false });
      model.updateMessageReadState.mockResolvedValue({ id: 'm1' });
      model.countUnreadMessages.mockResolvedValue(0);

      await expect(
        service.markMessageReadState({
          conversationId: 'c1',
          messageId: 'm1',
          userId: 'u1',
          isRead: true,
        })
      ).resolves.toEqual({
        message_id: 'm1',
        is_read: true,
        conversation_unread_count: 0,
      });
    });
  });

  describe('deleteMessage', () => {
    it('404 conversation missing', async () => {
      model.findConversationById.mockResolvedValue(null);
      await expect(
        service.deleteMessage({ conversationId: 'c1', messageId: 'm1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('403 non-participant', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'x',
        user_b_id: 'y',
      });
      await expect(
        service.deleteMessage({ conversationId: 'c1', messageId: 'm1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('404 message missing', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue(null);
      await expect(
        service.deleteMessage({ conversationId: 'c1', messageId: 'm1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'MESSAGE_NOT_FOUND' });
    });

    it('403 cannot delete others message', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u2' });
      await expect(
        service.deleteMessage({ conversationId: 'c1', messageId: 'm1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('deletes own message', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u1' });
      model.deleteMessageById.mockResolvedValue();

      await service.deleteMessage({ conversationId: 'c1', messageId: 'm1', userId: 'u1' });
      expect(model.deleteMessageById).toHaveBeenCalledWith('m1');
    });
  });

  describe('deleteConversation', () => {
    it('404 conversation missing', async () => {
      model.findConversationById.mockResolvedValue(null);
      await expect(
        service.deleteConversation({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('403 non-participant', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'x',
        user_b_id: 'y',
      });
      await expect(
        service.deleteConversation({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('404 already deleted by user A', async () => {
      model.findConversationById.mockResolvedValue({ ...baseConversation, deleted_by_a: true });
      await expect(
        service.deleteConversation({ conversationId: 'c1', userId: 'u1' })
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });

    it('soft deletes for user A', async () => {
      model.findConversationById.mockResolvedValue(baseConversation);
      model.softDeleteConversation.mockResolvedValue();

      await service.deleteConversation({ conversationId: 'c1', userId: 'u1' });
      expect(model.softDeleteConversation).toHaveBeenCalledWith('c1', true);
    });

    it('soft deletes for user B', async () => {
      model.findConversationById.mockResolvedValue({
        ...baseConversation,
        user_a_id: 'u2',
        user_b_id: 'u1',
      });
      model.softDeleteConversation.mockResolvedValue();

      await service.deleteConversation({ conversationId: 'c1', userId: 'u1' });
      expect(model.softDeleteConversation).toHaveBeenCalledWith('c1', false);
    });
  });
});
