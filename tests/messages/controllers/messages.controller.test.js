const controller = require('../../../src/controllers/messages.controller');
const messagesService = require('../../../src/services/messages.service');
const api = require('../../../src/utils/api-response');

jest.mock('../../../src/services/messages.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkReq = ({ body = {}, query = {}, params = {}, user = { sub: 'u1' } } = {}) => ({
  body,
  query,
  params,
  user,
});

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('messages controller', () => {
  describe('startConversation', () => {
    it('rejects missing recipient_id', async () => {
      const req = mkReq({ body: {} });
      const res = mkRes();

      await controller.startConversation(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'recipient_id is required.',
        400
      );
    });

    it('returns 201 when a conversation is created', async () => {
      const req = mkReq({ body: { recipient_id: 'u2', body: 'hello' } });
      const res = mkRes();
      messagesService.startConversation.mockResolvedValue({
        conversation: { id: 'c1' },
        message: { id: 'm1' },
        isNew: true,
      });

      await controller.startConversation(req, res);

      expect(messagesService.startConversation).toHaveBeenCalledWith({
        senderId: 'u1',
        recipientId: 'u2',
        body: 'hello',
        resource: undefined,
      });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { conversation: { id: 'c1' }, message: { id: 'm1' } },
        'Conversation created and first message sent.',
        201
      );
    });

    it('returns 200 when the conversation already exists', async () => {
      const req = mkReq({ body: { recipient_id: 'u2', body: 'hello' } });
      const res = mkRes();
      messagesService.startConversation.mockResolvedValue({
        conversation: { id: 'c1' },
        message: { id: 'm1' },
        isNew: false,
      });

      await controller.startConversation(req, res);

      expect(api.success).toHaveBeenCalledWith(res, { message: { id: 'm1' } }, 'Message sent.', 200);
    });
  });

  describe('ensureConversation', () => {
    it('rejects missing recipient_id', async () => {
      const req = mkReq({ body: {} });
      const res = mkRes();

      await controller.ensureConversation(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'recipient_id is required.',
        400
      );
    });

    it('returns 201 for a new conversation', async () => {
      const req = mkReq({ body: { recipient_id: 'u2' } });
      const res = mkRes();
      messagesService.ensureConversation.mockResolvedValue({
        conversation: { id: 'c1' },
        isNew: true,
      });

      await controller.ensureConversation(req, res);

      expect(messagesService.ensureConversation).toHaveBeenCalledWith({
        senderId: 'u1',
        recipientId: 'u2',
      });
      expect(api.success).toHaveBeenCalledWith(res, { conversation: { id: 'c1' } }, 'Conversation created.', 201);
    });

    it('returns 200 for an existing conversation', async () => {
      const req = mkReq({ body: { recipient_id: 'u2' } });
      const res = mkRes();
      messagesService.ensureConversation.mockResolvedValue({
        conversation: { id: 'c1' },
        isNew: false,
      });

      await controller.ensureConversation(req, res);

      expect(api.success).toHaveBeenCalledWith(
        res,
        { conversation: { id: 'c1' } },
        'Conversation fetched successfully.',
        200
      );
    });
  });

  describe('listConversations', () => {
    it('returns the service payload', async () => {
      const req = mkReq({ query: { page: '2', limit: '8' } });
      const res = mkRes();
      const data = { items: [{ id: 'c1' }], pagination: { page: 2, limit: 8 } };
      messagesService.listConversations.mockResolvedValue(data);

      await controller.listConversations(req, res);

      expect(messagesService.listConversations).toHaveBeenCalledWith({
        userId: 'u1',
        page: '2',
        limit: '8',
      });
      expect(api.success).toHaveBeenCalledWith(res, data, 'Conversations fetched successfully.');
    });
  });

  describe('getConversation', () => {
    it('passes page, limit, and offset through to the service', async () => {
      const req = mkReq({
        params: { conversationId: 'c1' },
        query: { page: '1', limit: '20', offset: '10' },
      });
      const res = mkRes();
      const data = { conversation: { id: 'c1' }, messages: [] };
      messagesService.getConversation.mockResolvedValue(data);

      await controller.getConversation(req, res);

      expect(messagesService.getConversation).toHaveBeenCalledWith({
        conversationId: 'c1',
        userId: 'u1',
        page: '1',
        limit: '20',
        offset: '10',
      });
      expect(api.success).toHaveBeenCalledWith(res, data, 'Conversation fetched successfully.');
    });
  });

  describe('sendMessage', () => {
    it('returns the created message', async () => {
      const req = mkReq({
        params: { conversationId: 'c1' },
        body: { body: 'hello', resource: { type: 'track', id: 't1' } },
      });
      const res = mkRes();
      messagesService.sendMessage.mockResolvedValue({ id: 'm1' });

      await controller.sendMessage(req, res);

      expect(messagesService.sendMessage).toHaveBeenCalledWith({
        conversationId: 'c1',
        senderId: 'u1',
        body: 'hello',
        resource: { type: 'track', id: 't1' },
      });
      expect(api.success).toHaveBeenCalledWith(res, { id: 'm1' }, 'Message sent.', 201);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      const req = mkReq();
      const res = mkRes();
      messagesService.getUnreadCount.mockResolvedValue({ unread_count: 4 });

      await controller.getUnreadCount(req, res);

      expect(messagesService.getUnreadCount).toHaveBeenCalledWith({ userId: 'u1' });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { unread_count: 4 },
        'Unread message count fetched successfully.'
      );
    });
  });

  describe('markMessageReadState', () => {
    it('returns validation errors for missing is_read', async () => {
      const req = mkReq({ params: { conversationId: 'c1', messageId: 'm1' }, body: {} });
      const res = mkRes();

      await controller.markMessageReadState(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'is_read is required.', 400);
    });

    it('returns validation errors for non-boolean is_read', async () => {
      const req = mkReq({
        params: { conversationId: 'c1', messageId: 'm1' },
        body: { is_read: 'true' },
      });
      const res = mkRes();

      await controller.markMessageReadState(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'is_read must be a boolean.',
        400
      );
    });

    it('returns success for a valid boolean state', async () => {
      const req = mkReq({
        params: { conversationId: 'c1', messageId: 'm1' },
        body: { is_read: true },
      });
      const res = mkRes();
      messagesService.markMessageReadState.mockResolvedValue({ message_id: 'm1' });

      await controller.markMessageReadState(req, res);

      expect(messagesService.markMessageReadState).toHaveBeenCalledWith({
        conversationId: 'c1',
        messageId: 'm1',
        userId: 'u1',
        isRead: true,
      });
      expect(api.success).toHaveBeenCalledWith(
        res,
        { message_id: 'm1' },
        'Message read state updated successfully.'
      );
    });
  });

  describe('deleteMessage', () => {
    it('returns success', async () => {
      const req = mkReq({ params: { conversationId: 'c1', messageId: 'm1' } });
      const res = mkRes();

      await controller.deleteMessage(req, res);

      expect(messagesService.deleteMessage).toHaveBeenCalledWith({
        conversationId: 'c1',
        messageId: 'm1',
        userId: 'u1',
      });
      expect(api.success).toHaveBeenCalledWith(res, null, 'Message deleted.');
    });
  });

  describe('deleteConversation', () => {
    it('returns success', async () => {
      const req = mkReq({ params: { conversationId: 'c1' } });
      const res = mkRes();

      await controller.deleteConversation(req, res);

      expect(messagesService.deleteConversation).toHaveBeenCalledWith({
        conversationId: 'c1',
        userId: 'u1',
      });
      expect(api.success).toHaveBeenCalledWith(res, null, 'Conversation deleted.');
    });
  });

  describe('auth edge cases', () => {
    const cases = [
      ['startConversation', () => mkReq({ user: null, body: { recipient_id: 'u2' } })],
      ['ensureConversation', () => mkReq({ user: null, body: { recipient_id: 'u2' } })],
      ['listConversations', () => mkReq({ user: null })],
      ['getConversation', () => mkReq({ user: null, params: { conversationId: 'c1' } })],
      ['sendMessage', () => mkReq({ user: null, params: { conversationId: 'c1' }, body: { body: 'x' } })],
      ['getUnreadCount', () => mkReq({ user: null })],
      [
        'markMessageReadState',
        () => mkReq({ user: null, params: { conversationId: 'c1', messageId: 'm1' }, body: { is_read: true } }),
      ],
      ['deleteMessage', () => mkReq({ user: null, params: { conversationId: 'c1', messageId: 'm1' } })],
      ['deleteConversation', () => mkReq({ user: null, params: { conversationId: 'c1' } })],
    ];

    it.each(cases)('%s returns unauthorized when req.user is absent', async (methodName, makeReq) => {
      const req = makeReq();
      const res = mkRes();

      await controller[methodName](req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    });
  });
});