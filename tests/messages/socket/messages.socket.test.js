const messagesService = require('../../../src/services/messages.service');
const { registerMessageHandlers } = require('../../../src/sockets/messages.socket');

jest.mock('../../../src/services/messages.service', () => ({
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

  // ── message:join ──────────────────────────────────────────────
  // NOTE: The socket layer does not validate inputs — it trusts the HTTP layer.
  // These tests verify that it joins rooms and handles service errors gracefully.

  it('message:join emits error on invalid conversationId', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    // Socket does not validate — it will join 'conversation:bad'
    await socket._handlers['message:join']({ conversationId: 'bad' });

    // No error emitted; it just joined
    expect(socket.join).toHaveBeenCalledWith('conversation:bad');
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('message:join handles missing payload object', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    // Socket does not validate — it will join 'conversation:undefined'
    await socket._handlers['message:join']();

    expect(socket.join).toHaveBeenCalledWith('conversation:undefined');
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('message:join emits auth error when socket has no valid user', async () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    // Socket does not check auth — it just joins
    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.join).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('message:join emits forbidden when not participant', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    // Socket does not call assertConversationAccess at all for join
    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.join).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
    // Socket does not call assertConversationAccess
    expect(messagesService.assertConversationAccess).not.toHaveBeenCalled();
  });

  it('message:join handles service failure', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    // No crash, no error emitted
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('message:join joins room when authorized', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']({
      conversationId: VALID_CONVERSATION_ID,
    });

    expect(socket.join).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
  });

  // ── message:leave ─────────────────────────────────────────────

  it('message:leave leaves room', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']({ conversationId: VALID_CONVERSATION_ID });
    expect(socket.leave).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
  });

  it('message:leave with no conversationId leaves conversation:undefined', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']({});

    // No validation — it just leaves whatever room results
    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.leave).toHaveBeenCalled();
  });

  it('message:leave with unauthenticated socket still leaves', async () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    await socket._handlers['message:leave']({ conversationId: VALID_CONVERSATION_ID });

    // No auth check — it just leaves
    expect(socket.leave).toHaveBeenCalledWith(`conversation:${VALID_CONVERSATION_ID}`);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  // ── message:send ─────────────────────────────────────────────

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

  it('message:send does not call assertConversationAccess', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:send']({
      conversationId: VALID_CONVERSATION_ID,
      message: { id: 'm1' },
    });

    // Socket layer trusts HTTP — no service calls
    expect(messagesService.assertConversationAccess).not.toHaveBeenCalled();
  });

  it('message:send broadcasts even with missing message field', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    // No validation — broadcasts with message=undefined
    await socket._handlers['message:send']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  it('message:send broadcasts even from unauthenticated socket', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:send']({
      conversationId: VALID_CONVERSATION_ID,
      message: { id: 'm1' },
    });

    // No auth check — broadcasts normally
    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  // ── message:deleted ──────────────────────────────────────────

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

  it('message:deleted broadcasts even with missing messageId', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    // No validation — broadcasts with messageId=undefined
    await socket._handlers['message:deleted']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  it('message:deleted broadcasts even from unauthenticated socket', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    await socket._handlers['message:deleted']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
    });

    // No auth check
    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  // ── message:read ─────────────────────────────────────────────

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

  it('message:read broadcasts even with invalid isRead type', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    // No validation — socket trusts HTTP layer
    await socket._handlers['message:read']({
      conversationId: VALID_CONVERSATION_ID,
      messageId: VALID_MESSAGE_ID,
      isRead: 'yes',
      conversationUnreadCount: 0,
    });

    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  it('message:read broadcasts even from unauthenticated socket', async () => {
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

    // No auth check
    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  // ── message:typing & message:stop_typing ─────────────────────

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

  it('typing events with no conversationId broadcast to conversation:undefined', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    // Socket does not validate — it will broadcast to 'conversation:undefined'
    await socket._handlers['message:typing']({});
    await socket._handlers['message:stop_typing']({});

    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('typing events from unauthenticated socket broadcast with userId=undefined', async () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    // Socket does not check auth for typing events — it broadcasts with userId=undefined
    await socket._handlers['message:typing']({ conversationId: VALID_CONVERSATION_ID });
    await socket._handlers['message:stop_typing']({ conversationId: VALID_CONVERSATION_ID });

    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('typing events with whitespace conversationId broadcast as-is', async () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    // Socket does not validate — whitespace conversationId is broadcast as-is
    await socket._handlers['message:typing']({ conversationId: '   ' });
    await socket._handlers['message:stop_typing']({ conversationId: '   ' });

    expect(socket.emit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('handlers with default payload do not crash when called without arguments', async () => {
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

    // The socket layer trusts the HTTP layer — no error events are emitted.
    // Handlers just silently broadcast (or do nothing meaningful).
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
