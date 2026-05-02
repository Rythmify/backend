const { registerMessageHandlers } = require('../src/sockets/messages.socket');

const mkSocket = (userId = 'user-1') => {
  const handlers = {};
  const emit = jest.fn();
  const broadcaster = { emit };

  return {
    id: 'sock-1',
    user: userId === undefined ? undefined : { sub: userId },
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
    }),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => broadcaster),
    _handlers: handlers,
    _broadcastEmit: emit,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('messages.socket', () => {
  it('registers all handlers', () => {
    const socket = mkSocket();

    registerMessageHandlers({}, socket);

    expect(socket.on).toHaveBeenCalledWith('message:join', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:leave', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:send', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:deleted', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:read', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:typing', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:stop_typing', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('joins and leaves conversation rooms, including default payloads', () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    socket._handlers['message:join']({ conversationId: 'c1' });
    socket._handlers['message:leave']({ conversationId: 'c1' });
    socket._handlers['message:join']();
    socket._handlers['message:leave']();

    expect(socket.join).toHaveBeenCalledWith('conversation:c1');
    expect(socket.leave).toHaveBeenCalledWith('conversation:c1');
    expect(socket.join).toHaveBeenCalledWith('conversation:undefined');
    expect(socket.leave).toHaveBeenCalledWith('conversation:undefined');
  });

  it('broadcasts message lifecycle events', () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    socket._handlers['message:send']({ conversationId: 'c1', message: { id: 'm1' } });
    socket._handlers['message:deleted']({ conversationId: 'c1', messageId: 'm1' });
    socket._handlers['message:read']({
      conversationId: 'c1',
      messageId: 'm1',
      isRead: true,
      conversationUnreadCount: 0,
    });

    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:received', {
      conversationId: 'c1',
      message: { id: 'm1' },
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:removed', {
      conversationId: 'c1',
      messageId: 'm1',
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:read_updated', {
      conversationId: 'c1',
      messageId: 'm1',
      isRead: true,
      conversationUnreadCount: 0,
    });
  });

  it('message lifecycle and typing handlers accept omitted payloads', () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    socket._handlers['message:send']();
    socket._handlers['message:deleted']();
    socket._handlers['message:read']();
    socket._handlers['message:typing']();
    socket._handlers['message:stop_typing']();

    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:received', {
      conversationId: undefined,
      message: undefined,
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:removed', {
      conversationId: undefined,
      messageId: undefined,
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:read_updated', {
      conversationId: undefined,
      messageId: undefined,
      isRead: undefined,
      conversationUnreadCount: undefined,
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:typing', {
      conversationId: undefined,
      userId: 'user-1',
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:stop_typing', {
      conversationId: undefined,
      userId: 'user-1',
    });
  });

  it('broadcasts typing indicators with the authenticated user id', () => {
    const socket = mkSocket('user-typing');
    registerMessageHandlers({}, socket);

    socket._handlers['message:typing']({ conversationId: 'c1' });
    socket._handlers['message:stop_typing']({ conversationId: 'c1' });

    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:typing', {
      conversationId: 'c1',
      userId: 'user-typing',
    });
    expect(socket._broadcastEmit).toHaveBeenCalledWith('message:stop_typing', {
      conversationId: 'c1',
      userId: 'user-typing',
    });
  });

  it('logs disconnect with optional missing user safely', () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    socket._handlers.disconnect('client disconnect');

    expect(console.log).toHaveBeenCalledWith(
      '[Socket.IO] sock-1 (user: null) disconnected — reason: client disconnect'
    );
  });

  it.each([
    ['message:join', 'join exploded', (socket) => socket.join.mockImplementation(() => { throw new Error('join exploded'); })],
    ['message:leave', 'leave exploded', (socket) => socket.leave.mockImplementation(() => { throw new Error('leave exploded'); })],
    ['message:send', 'send exploded', (socket) => socket.to.mockImplementation(() => { throw new Error('send exploded'); })],
    ['message:deleted', 'deleted exploded', (socket) => socket.to.mockImplementation(() => { throw new Error('deleted exploded'); })],
    ['message:read', 'read exploded', (socket) => socket.to.mockImplementation(() => { throw new Error('read exploded'); })],
    ['message:typing', 'typing exploded', (socket) => socket.to.mockImplementation(() => { throw new Error('typing exploded'); })],
    [
      'message:stop_typing',
      'stop exploded',
      (socket) => socket.to.mockImplementation(() => { throw new Error('stop exploded'); }),
    ],
  ])('logs %s handler errors', (event, message, arrange) => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    arrange(socket);

    socket._handlers[event]({ conversationId: 'c1', message: {}, messageId: 'm1', isRead: false });

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`${event} error:`), message);
  });
});
