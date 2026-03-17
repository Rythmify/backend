const controller = require('../src/controllers/messages.controller');
const messagesService = require('../src/services/messages.service');
const api = require('../src/utils/api-response');

jest.mock('../src/services/messages.service');
jest.mock('../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkReq = ({ userId = 'u1', body = {}, params = {}, query = {} } = {}) => ({
  user: { sub: userId },
  body,
  params,
  query,
});

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('messages.controller', () => {
  describe('startConversation', () => {
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
      const req = mkReq({ body: { recipient_id: 'u2', body: 'hi' } });
      const res = mkRes();
      messagesService.startConversation.mockResolvedValue({
        conversation: { id: 'c1' },
        message: { id: 'm1' },
        isNew: true,
      });

      await controller.startConversation(req, res);

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
  });

  describe('markMessageReadState', () => {
    it('requires is_read', async () => {
      const req = mkReq({ params: { conversationId: 'c1', messageId: 'm1' }, body: {} });
      const res = mkRes();

      await controller.markMessageReadState(req, res);

      expect(api.error).toHaveBeenCalledWith(
        res,
        'VALIDATION_FAILED',
        'is_read is required.',
        400
      );
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

      expect(api.success).toHaveBeenCalled();
    });
  });

  it('listConversations returns success', async () => {
    const req = mkReq({ query: { page: '2', limit: '8' } });
    const res = mkRes();
    messagesService.listConversations.mockResolvedValue({ items: [], pagination: {} });

    await controller.listConversations(req, res);

    expect(api.success).toHaveBeenCalled();
  });

  it('getConversation returns success', async () => {
    const req = mkReq({ params: { conversationId: 'c1' }, query: { page: '1', limit: '20' } });
    const res = mkRes();
    messagesService.getConversation.mockResolvedValue({ conversation: {}, messages: [], pagination: {} });

    await controller.getConversation(req, res);

    expect(api.success).toHaveBeenCalled();
  });

  it('sendMessage returns success', async () => {
    const req = mkReq({ params: { conversationId: 'c1' }, body: { body: 'hi' } });
    const res = mkRes();
    messagesService.sendMessage.mockResolvedValue({ id: 'm1' });

    await controller.sendMessage(req, res);

    expect(api.success).toHaveBeenCalledWith(res, { id: 'm1' }, 'Message sent.', 201);
  });

  it('getUnreadCount returns success', async () => {
    const req = mkReq();
    const res = mkRes();
    messagesService.getUnreadCount.mockResolvedValue({ unread_count: 4 });

    await controller.getUnreadCount(req, res);

    expect(api.success).toHaveBeenCalled();
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
});