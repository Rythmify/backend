const db = require('../src/config/db');
const { registerMessageHandlers } = require('../src/sockets/messages.socket');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const mkSocket = (userId = '11111111-1111-1111-1111-111111111111') => {
  const handlers = {};
  return {
    id: 'sock1',
    user: { sub: userId },
    on: jest.fn((event, cb) => { handlers[event] = cb; }),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    _handlers: handlers,
  };
};

beforeEach(() => jest.clearAllMocks());

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
    expect(db.query).not.toHaveBeenCalled();
  });

  it('message:join emits auth error when socket has no valid user', async () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    await socket._handlers['message:join']({
      conversationId: '22222222-2222-2222-2222-222222222222',
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('message:join emits forbidden when not participant', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    db.query.mockResolvedValue({ rows: [] });

    await socket._handlers['message:join']({
      conversationId: '22222222-2222-2222-2222-222222222222',
    });

    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'You are not a participant in this conversation.',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM conversations'),
      [
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
      ]
    );
  });

  it('message:join handles db failure', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    db.query.mockRejectedValue(new Error('db down'));

    await socket._handlers['message:join']({
      conversationId: '22222222-2222-2222-2222-222222222222',
    });

    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'Something went wrong. Please try again.',
    });
  });

  it('message:join joins room when authorized', async () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);
    db.query.mockResolvedValue({ rows: [{ ok: 1 }] });

    await socket._handlers['message:join']({
      conversationId: '22222222-2222-2222-2222-222222222222',
    });

    expect(socket.join).toHaveBeenCalledWith(
      'conversation:22222222-2222-2222-2222-222222222222'
    );
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('message:leave leaves room', () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    socket._handlers['message:leave']({ conversationId: 'c1' });
    expect(socket.leave).toHaveBeenCalledWith('conversation:c1');
  });

  it('message:leave rejects malformed payload', () => {
    const socket = mkSocket();
    registerMessageHandlers({}, socket);

    socket._handlers['message:leave']({});

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('message:leave rejects unauthenticated socket', () => {
    const socket = mkSocket(null);
    registerMessageHandlers({}, socket);

    socket._handlers['message:leave']({ conversationId: 'c1' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('message:send broadcasts received', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:send']({ conversationId: 'c1', message: { id: 'm1' } });

    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(emit).toHaveBeenCalledWith('message:received', {
      conversationId: 'c1',
      message: { id: 'm1' },
    });
  });

  it('message:send rejects malformed payload', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:send']({ conversationId: 'c1' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:send rejects unauthenticated socket', () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:send']({ conversationId: 'c1', message: { id: 'm1' } });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:deleted broadcasts removed', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:deleted']({ conversationId: 'c1', messageId: 'm1' });

    expect(emit).toHaveBeenCalledWith('message:removed', {
      conversationId: 'c1',
      messageId: 'm1',
    });
  });

  it('message:deleted rejects malformed payload', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:deleted']({ conversationId: 'c1' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:deleted rejects unauthenticated socket', () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:deleted']({ conversationId: 'c1', messageId: 'm1' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:read broadcasts read_updated', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:read']({
      conversationId: 'c1',
      messageId: 'm1',
      isRead: true,
      conversationUnreadCount: 0,
    });

    expect(emit).toHaveBeenCalledWith('message:read_updated', {
      conversationId: 'c1',
      messageId: 'm1',
      isRead: true,
      conversationUnreadCount: 0,
    });
  });

  it('message:read rejects malformed payload', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:read']({
      conversationId: 'c1',
      messageId: 'm1',
      isRead: 'yes',
      conversationUnreadCount: 0,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('message:read rejects unauthenticated socket', () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:read']({
      conversationId: 'c1',
      messageId: 'm1',
      isRead: true,
      conversationUnreadCount: 0,
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('typing events broadcast', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:typing']({ conversationId: 'c1' });
    expect(emit).toHaveBeenCalledWith('message:typing', { conversationId: 'c1', userId: socket.user.sub });

    socket._handlers['message:stop_typing']({ conversationId: 'c1' });
    expect(emit).toHaveBeenCalledWith('message:stop_typing', { conversationId: 'c1', userId: socket.user.sub });
  });

  it('typing events reject malformed payload', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:typing']({});
    socket._handlers['message:stop_typing']({});

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('typing events reject unauthenticated socket', () => {
    const socket = mkSocket(null);
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:typing']({ conversationId: 'c1' });
    socket._handlers['message:stop_typing']({ conversationId: 'c1' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('typing events reject whitespace conversationId', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:typing']({ conversationId: '   ' });
    socket._handlers['message:stop_typing']({ conversationId: '   ' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('handlers with default payload reject when called without arguments', () => {
    const socket = mkSocket();
    const emit = jest.fn();
    socket.to.mockReturnValue({ emit });
    registerMessageHandlers({}, socket);

    socket._handlers['message:leave']();
    socket._handlers['message:send']();
    socket._handlers['message:deleted']();
    socket._handlers['message:read']();
    socket._handlers['message:typing']();
    socket._handlers['message:stop_typing']();

    expect(socket.emit).toHaveBeenCalledTimes(6);
    expect(socket.emit).toHaveBeenNthCalledWith(1, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(2, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(3, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(4, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(5, 'error', { message: 'Invalid payload.' });
    expect(socket.emit).toHaveBeenNthCalledWith(6, 'error', { message: 'Invalid payload.' });
    expect(emit).not.toHaveBeenCalled();
  });
});