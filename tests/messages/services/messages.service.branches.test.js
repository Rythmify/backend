// ============================================================
// tests/messages/services/messages.service.branches.test.js
// Coverage Target: 100%
// ============================================================

const messagesService = require('../../../src/services/messages.service');
const messageModel = require('../../../src/models/message.model');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/message.model');
jest.mock('../../../src/services/email-notifications.service');
jest.mock('../../../src/services/push-notifications.service');

describe('Messages Service - Branch Coverage Expansion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateMessagePayload Branches', () => {
    beforeEach(() => {
        messageModel.findActiveUserById.mockResolvedValue({ id: 'u2' });
        messageModel.isBlocked.mockResolvedValue(false);
        messageModel.getMessagesFromPreference.mockResolvedValue('everyone');
    });

    it('throws if body exceeds 2000 chars', async () => {
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'a'.repeat(2001) }))
            .rejects.toMatchObject({ code: 'MESSAGES_BODY_TOO_LONG' });
    });

    it('throws if resource is not an object', async () => {
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', resource: [] }))
            .rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_RESOURCE' });
    });

    it('throws if resource missing type or id', async () => {
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', resource: { type: 'track' } }))
            .rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_RESOURCE' });
    });

    it('throws if resource type invalid', async () => {
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', resource: { type: 'invalid', id: 'uuid' } }))
            .rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_TYPE' });
    });

    it('throws if resource id not uuid', async () => {
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', resource: { type: 'track', id: 'not-uuid' } }))
            .rejects.toMatchObject({ code: 'MESSAGES_INVALID_EMBED_ID' });
    });
  });

  describe('assertRecipientCanReceiveMessagesFromSender Branches', () => {
    it('throws if recipient disables messages (nobody)', async () => {
        messageModel.findActiveUserById.mockResolvedValue({ id: 'u2' });
        messageModel.isBlocked.mockResolvedValue(false);
        messageModel.getMessagesFromPreference.mockResolvedValue('nobody');
        
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'hi' }))
            .rejects.toMatchObject({ code: 'MESSAGES_DISABLED' });
    });

    it('throws if followers_only and recipient not following sender', async () => {
        messageModel.findActiveUserById.mockResolvedValue({ id: 'u2' });
        messageModel.isBlocked.mockResolvedValue(false);
        messageModel.getMessagesFromPreference.mockResolvedValue('followers_only');
        messageModel.isFollowing.mockResolvedValue(false);
        
        await expect(messagesService.startConversation({ senderId: 'u1', recipientId: 'u2', body: 'hi' }))
            .rejects.toMatchObject({ code: 'MESSAGES_FOLLOWERS_ONLY' });
    });
  });

  describe('getConversation Pagination Branches', () => {
    it('uses rawOffset if provided', async () => {
        messageModel.findConversationById.mockResolvedValue({ id: 'c1', user_a_id: 'u1', user_b_id: 'u2' });
        messageModel.findMessagesByConversationId.mockResolvedValue([]);
        
        await messagesService.getConversation({ conversationId: 'c1', userId: 'u1', offset: 10 });
        expect(messageModel.findMessagesByConversationId).toHaveBeenCalledWith('c1', 50, 10);
    });
  });

  describe('markMessageReadState Branches', () => {
    it('throws if user is the sender', async () => {
        messageModel.findConversationById.mockResolvedValue({ id: 'c1', user_a_id: 'u1', user_b_id: 'u2' });
        messageModel.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u1' });
        
        await expect(messagesService.markMessageReadState({ conversationId: 'c1', messageId: 'm1', userId: 'u1', isRead: true }))
            .rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws if read state already matches', async () => {
        messageModel.findConversationById.mockResolvedValue({ id: 'c1', user_a_id: 'u1', user_b_id: 'u2' });
        messageModel.findMessageById.mockResolvedValue({ id: 'm1', sender_id: 'u2', is_read: true });
        
        await expect(messagesService.markMessageReadState({ conversationId: 'c1', messageId: 'm1', userId: 'u1', isRead: true }))
            .rejects.toMatchObject({ code: 'MESSAGES_READ_STATE_CONFLICT' });
    });
  });
});
