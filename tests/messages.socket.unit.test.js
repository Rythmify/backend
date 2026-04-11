const messagesService = require('../src/services/messages.service');
const { registerMessageHandlers } = require('../src/sockets/messages.socket');

jest.mock('../src/services/messages.service', () => ({
  assertConversationAccess: jest.fn(),
}));

const VALID_CONVERSATION_ID = '22222222-2222-2222-2222-222222222222';
const VALID_MESSAGE_ID = '33333333-3333-3333-3333-333333333333';

const mkSocket = (userId = '11111111-1111-1111-1111-111111111111') => {
  const handlers = {};
  return {
    id: 'sock1',
    user: { sub: userId },
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
    }),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    _handlers: handlers,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  messagesService.assertConversationAccess.mockResolvedValue({ id: VALID_CONVERSATION_ID });
});

describe('messages.socket', () => {
  it('registers all message handlers', () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    expect(socket.on).toHaveBeenCalledWith('message:join', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:leave', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:send', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:deleted', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:read', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:typing', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:stop_typing', expect.any(Function));
  });

  it('message:join emits error on invalid conversationId', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']({ conversationId: 'bad' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid conversationId.' });
  });

  it('message:join handles missing payload object', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']();

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid conversationId.' });
    expect(messagesService.assertConversationAccess).not.toHaveBeenCalled();
  });

  it('message:join emits auth error when socket has no valid user', async () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(messagesService.assertConversationAccess).not.toHaveBeenCalled();
  });

  it('message:join emits forbidden when not participant', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    messagesService.assertConversationAccess.mockRejectedValue({ code: 'FORBIDDEN' });

    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'You are not a participant in this conversation.',
    });
    expect(messagesService.assertConversationAccess).toHaveBeenCalledWith({
      conversationId: VALID_CONVERSATION_ID,
      userId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('message:join handles service failure', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    messagesService.assertConversationAccess.mockRejectedValue(new Error('service down'));

    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'Something went wrong. Please try again.',
    });
  });

  it('message:join joins room when authorized', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.join).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
    expect(messagesService.assertConversationAccess).toHaveBeenCalledTimes(1);
  });

  it('message:leave leaves room', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']({ conversationId: VALID_CONVERSATION_ID });
    expect(socket.leave).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
  });

  it('message:leave rejects malformed payload', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']({});

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid conversationId.' });
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('message:leave rejects unauthenticated socket', async () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('message:send broadcasts received', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:send']({
      conversationId: VALID_CONVERSATION_ID,
      message: { id: 'm1' },
    });

    expect(socket.to).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
    expect(emit).toHaveBeenCalledWith('message:received', {
      conversationId: VALID_CONVERSATION_ID,
      message: { id: 'm1' },
    });
  });

  it('message:send blocks non-participant users', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);
    messagesService.assertConversationAccess.mockRejectedValue({ code: 'FORBIDDEN' });

    await socket._handlers['message:send']({
      conversationId: VALID_CONVERSATION_ID,
      message: { id: 'm1' },
    });

    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'You are not a participant in this conversation.',
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:send rejects malformed payload', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:send']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:send rejects unauthenticated socket', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:send']({
      conversationId: VALID_CONVERSATION_ID,
      message: { id: 'm1' },
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:deleted broadcasts removed', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:deleted']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
    });

    expect(emit).toHaveBeenCalledWith('message:removed', {
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
    });
  });

  it('message:deleted rejects malformed payload', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:deleted']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:deleted rejects unauthenticated socket', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:deleted']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:read broadcasts read_updated', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:read']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
      isRead: true,
      conversationUnreadCount: 0,
    });

    expect(emit).toHaveBeenCalledWith('message:read_updated', {
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
      isRead: true,
      conversationUnreadCount: 0,
    });
  });

  it('message:read rejects malformed payload', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:read']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
      isRead: 'yes',
      conversationUnreadCount: 0,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:read rejects unauthenticated socket', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:read']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
      isRead: true,
      conversationUnreadCount: 0,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('typing events broadcast', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:typing']({ conversationId: VALID_CONVERSATION_ID });
    expect(emit).toHaveBeenCalledWith('message:typing', {
      conversationId: VALID_CONVERSATION_ID,
      userId: socket.user.sub,
    });

    await socket._handlers['message:stop_typing']({ conversationId: VALID_CONVERSATION_ID });
    expect(emit).toHaveBeenCalledWith('message:stop_typing', {
      conversationId: VALID_CONVERSATION_ID,
      userId: socket.user.sub,
    });
  });

  it('typing events reject malformed payload', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:typing']({});
    await socket._handlers['message:stop_typing']({});

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid conversationId.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('typing events reject unauthenticated socket', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:typing']({ conversationId: VALID_CONVERSATION_ID });
    await socket._handlers['message:stop_typing']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('typing events reject whitespace conversationId', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:typing']({ conversationId: '   ' });
    await socket._handlers['message:stop_typing']({ conversationId: '   ' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid conversationId.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('handlers with default payload reject when called without arguments', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']();
    await socket._handlers['message:send']();
    await socket._handlers['message:deleted']();
    await socket._handlers['message:read']();
    await socket._handlers['message:typing']();
    await socket._handlers['message:stop_typing']();

    expect(socket.emit).toHaveBeenCalledTimes(6);
    expect(socket.emit).toHaveBeenNthCalledWith(1, 'error', { message: 'Invalid conversationId.' });
    expect(socket.emit).toHaveBeenNthCalledWith(2, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(3, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(4, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(5, 'error', { message: 'Invalid conversationId.' });
    expect(socket.emit).toHaveBeenNthCalledWith(6, 'error', { message: 'Invalid conversationId.' });
    expect(emit).not.toHaveBeenCalled();
  });
});
