const controller = require('../../../src/controllers/messages.controller');
const messagesService = require('../../../src/services/messages.service');
const api = require('../../../src/utils/api-response');

jest.mock('../../../src/services/messages.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkReq = ({ userId = 'u1', body = {}, params = {}, query = {}, user } = {}) => ({
  user: user || (userId ? { sub: userId } : undefined),
  body,
  params,
  query,
});

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('messages.controller', () => {
  describe('startConversation', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null, body: { recipient_id: 'u2', body: 'hi' } });
      const res = mkRes();

      await controller.startConversation(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(messagesService.startConversation).not.toHaveBeenCalled();
    });

    it('returns validation error when recipient_id missing', async () => {
      const req = mkReq({ body: { body: 'hi' } });
      const res = mkRes();

      await controller.startConversation(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'recipient_id is required.',
        400
      );
      expect(messagesService.startConversation).not.toHaveBeenCalled();
    });

    it('returns 201 for new conversation', async () => {
      const req = mkReq({ body: { recipient_id: 'u2', body: '  hi  ' } });
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
        body: '  hi  ',
        resource: undefined,
      });

      expect(api.success).toHaveBeenCalledWith(
        res,
        { conversation: { id: 'c1' }, message: { id: 'm1' } },
        'Conversation created and first message sent.',
        201
      );
    });

    it('returns 200 for existing conversation', async () => {
      const req = mkReq({ body: { recipient_id: 'u2', body: 'hi' } });
      const res = mkRes();
      messagesService.startConversation.mockResolvedValue({
        conversation: { id: 'c1' },
        message: { id: 'm1' },
        isNew: false,
      });

      await controller.startConversation(req, res);

      expect(api.success).toHaveBeenCalledWith(
        res,
        { message: { id: 'm1' } },
        'Message sent.',
        200
      );
    });

    it('bubbles service failure', async () => {
      const req = mkReq({ body: { recipient_id: 'u2', body: 'hi' } });
      const res = mkRes();
      messagesService.startConversation.mockRejectedValue(new Error('db down'));

      await expect(controller.startConversation(req, res)).rejects.toThrow('db down');
      expect(api.success).not.toHaveBeenCalled();
    });
  });

  describe('ensureConversation', () => {
    it('returns unauthorized when req.user is missing', async () => {
      const req = mkReq({ userId: null, body: { recipient_id: 'u2' } });
      const res = mkRes();

      await controller.ensureConversation(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
      expect(messagesService.ensureConversation).not.toHaveBeenCalled();
    });

    it('returns validation error when recipient_id missing', async () => {
      const req = mkReq({ body: {} });
      const res = mkRes();

      await controller.ensureConversation(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'recipient_id is required.',
        400
      );
      expect(messagesService.ensureConversation).not.toHaveBeenCalled();
    });

    it('returns 201 for newly created conversation', async () => {
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

      expect(api.success).toHaveBeenCalledWith(
        res,
        { conversation: { id: 'c1' } },
        'Conversation created.',
        201
      );
    });

    it('returns 200 for existing conversation', async () => {
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

  describe('markMessageReadState', () => {
    it('requires is_read', async () => {
      const req = mkReq({ params: { conversationId: 'c1', messageId: 'm1' }, body: {} });
      const res = mkRes();

      await controller.markMessageReadState(req, res);

      expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'is_read is required.', 400);
    });

    it('requires boolean is_read', async () => {
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

    it('calls service and returns success', async () => {
      const req = mkReq({
        params: { conversationId: 'c1', messageId: 'm1' },
        body: { is_read: true },
      });
      const res = mkRes();

      messagesService.markMessageReadState.mockResolvedValue({
        message_id: 'm1',
        is_read: true,
        conversation_unread_count: 0,
      });

      await controller.markMessageReadState(req, res);

      expect(messagesService.markMessageReadState).toHaveBeenCalledWith({
        conversationId: 'c1',
        messageId: 'm1',
        userId: 'u1',
        isRead: true,
      });

      expect(api.success).toHaveBeenCalledWith(
        res,
        {
          message_id: 'm1',
          is_read: true,
          conversation_unread_count: 0,
        },
        'Message read state updated successfully.'
      );
    });
  });

  it('listConversations passes query args and returns payload', async () => {
    const req = mkReq({ query: { page: '2', limit: '8' } });
    const res = mkRes();
    const data = {
      items: [{ id: 'c1' }],
      pagination: { page: 2, limit: 8, total: 1, total_pages: 1 },
    };
    messagesService.listConversations.mockResolvedValue(data);

    await controller.listConversations(req, res);

    expect(messagesService.listConversations).toHaveBeenCalledWith({
      userId: 'u1',
      page: '2',
      limit: '8',
    });
    expect(api.success).toHaveBeenCalledWith(res, data, 'Conversations fetched successfully.');
  });

  it('getConversation passes pagination query and returns payload', async () => {
    const req = mkReq({ params: { conversationId: 'c1' }, query: { page: '1', limit: '20' } });
    const res = mkRes();
    const data = { conversation: { id: 'c1' }, messages: [], pagination: { page: 1, limit: 20 } };
    messagesService.getConversation.mockResolvedValue(data);

    await controller.getConversation(req, res);

    expect(messagesService.getConversation).toHaveBeenCalledWith({
      conversationId: 'c1',
      userId: 'u1',
      page: '1',
      limit: '20',
    });
    expect(api.success).toHaveBeenCalledWith(res, data, 'Conversation fetched successfully.');
  });

  it('sendMessage validates input forwarding and returns success', async () => {
    const req = mkReq({
      params: { conversationId: 'c1' },
      body: { body: '  hello  ', resource: { type: 'track', id: 't1' } },
    });
    const res = mkRes();
    messagesService.sendMessage.mockResolvedValue({ id: 'm1', body: 'hello' });

    await controller.sendMessage(req, res);

    expect(messagesService.sendMessage).toHaveBeenCalledWith({
      conversationId: 'c1',
      senderId: 'u1',
      body: '  hello  ',
      resource: { type: 'track', id: 't1' },
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { id: 'm1', body: 'hello' },
      'Message sent.',
      201
    );
  });

  it('getUnreadCount returns payload and message', async () => {
    const req = mkReq();
    const res = mkRes();
    const data = { unread_count: 4 };
    messagesService.getUnreadCount.mockResolvedValue(data);

    await controller.getUnreadCount(req, res);

    expect(messagesService.getUnreadCount).toHaveBeenCalledWith({ userId: 'u1' });
    expect(api.success).toHaveBeenCalledWith(
      res,
      data,
      'Unread message count fetched successfully.'
    );
  });

  it('deleteMessage returns success', async () => {
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

  it('deleteConversation returns success', async () => {
    const req = mkReq({ params: { conversationId: 'c1' } });
    const res = mkRes();

    await controller.deleteConversation(req, res);

    expect(messagesService.deleteConversation).toHaveBeenCalledWith({
      conversationId: 'c1',
      userId: 'u1',
    });
    expect(api.success).toHaveBeenCalledWith(res, null, 'Conversation deleted.');
  });

  describe('auth edge cases', () => {
    const cases = [
      ['ensureConversation', () => mkReq({ userId: null, body: { recipient_id: 'u2' } })],
      ['listConversations', () => mkReq({ userId: null })],
      ['getConversation', () => mkReq({ userId: null, params: { conversationId: 'c1' } })],
      [
        'sendMessage',
        () => mkReq({ userId: null, params: { conversationId: 'c1' }, body: { body: 'x' } }),
      ],
      ['getUnreadCount', () => mkReq({ userId: null })],
      [
        'markMessageReadState',
        () =>
          mkReq({
            userId: null,
            params: { conversationId: 'c1', messageId: 'm1' },
            body: { is_read: true },
          }),
      ],
      [
        'deleteMessage',
        () => mkReq({ userId: null, params: { conversationId: 'c1', messageId: 'm1' } }),
      ],
      ['deleteConversation', () => mkReq({ userId: null, params: { conversationId: 'c1' } })],
    ];

    it.each(cases)(
      '%s returns unauthorized when req.user is absent',
      async (methodName, makeReq) => {
        const req = makeReq();
        const res = mkRes();

        await controller[methodName](req, res);

        expect(api.error).toHaveBeenCalledWith(
          res,
          'UNAUTHORIZED',
          'Authentication required.',
          401
        );
      }
    );
  });
});
