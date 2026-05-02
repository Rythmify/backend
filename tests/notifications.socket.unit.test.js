const loadSocketModule = () => {
  jest.resetModules();
  return require('../src/sockets/notifications.socket');
};

const mkIo = () => {
  const emit = jest.fn();
  return {
    to: jest.fn(() => ({ emit })),
    _emit: emit,
  };
};

const mkSocket = (userId = 'user-1') => {
  const handlers = {};
  return {
    id: 'sock-1',
    user: userId === undefined ? undefined : { sub: userId },
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
    }),
    join: jest.fn(),
    leave: jest.fn(),
    _handlers: handlers,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('notifications.socket', () => {
  it('does not emit created/read events before initialization or with missing payloads', () => {
    const socketModule = loadSocketModule();

    expect(() =>
      socketModule.emitNotificationCreated({ userId: 'u1', notification: { id: 'n1' } })
    ).not.toThrow();
    expect(() =>
      socketModule.emitNotificationRead({ userId: 'u1', notificationId: 'n1' })
    ).not.toThrow();

    const io = mkIo();
    socketModule.initNotificationSocket(io);
    socketModule.emitNotificationCreated({ userId: null, notification: { id: 'n1' } });
    socketModule.emitNotificationCreated({ userId: 'u1', notification: null });
    socketModule.emitNotificationRead({ userId: null, notificationId: 'n1' });
    socketModule.emitNotificationRead({ userId: 'u1', notificationId: null });

    expect(io.to).not.toHaveBeenCalled();
  });

  it('emits notification created and read events to user rooms', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();

    socketModule.initNotificationSocket(io);
    socketModule.emitNotificationCreated({ userId: 'u1', notification: { id: 'n1' } });
    socketModule.emitNotificationRead({ userId: 'u1', notificationId: 'n1' });

    expect(io.to).toHaveBeenCalledWith('notifications:user:u1');
    expect(io._emit).toHaveBeenCalledWith('notification:created', {
      notification: { id: 'n1' },
    });
    expect(io._emit).toHaveBeenCalledWith('notification:read', { notification_id: 'n1' });
  });

  it('registers handlers and joins/leaves notification room for authenticated users', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();
    const socket = mkSocket('u1');

    socketModule.registerNotificationHandlers(io, socket);
    socket._handlers['notification:subscribe']();
    socket._handlers['notification:unsubscribe']();
    socket._handlers.disconnect('transport close');

    expect(socket.join).toHaveBeenCalledWith('notifications:user:u1');
    expect(socket.join).toHaveBeenCalledTimes(2);
    expect(socket.leave).toHaveBeenCalledWith('notifications:user:u1');
    expect(console.log).toHaveBeenCalledWith(
      '[Socket.IO] notifications — socket sock-1 (user: u1) disconnected — reason: transport close'
    );
  });

  it('registers handlers without joining rooms when user is missing', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();
    const socket = mkSocket(null);

    socketModule.registerNotificationHandlers(io, socket);
    socket._handlers['notification:subscribe']();
    socket._handlers['notification:unsubscribe']();

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('uses registerNotificationHandlers as io fallback for later emits', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();
    const socket = mkSocket('u1');

    socketModule.registerNotificationHandlers(io, socket);
    socketModule.emitNotificationCreated({ userId: 'u1', notification: { id: 'n1' } });

    expect(io._emit).toHaveBeenCalledWith('notification:created', {
      notification: { id: 'n1' },
    });
  });

  it('keeps initialized ioRef when registering handlers later', () => {
    const socketModule = loadSocketModule();
    const initialIo = mkIo();
    const laterIo = mkIo();
    const socket = mkSocket('u1');

    socketModule.initNotificationSocket(initialIo);
    socketModule.registerNotificationHandlers(laterIo, socket);
    socketModule.emitNotificationRead({ userId: 'u1', notificationId: 'n1' });

    expect(initialIo._emit).toHaveBeenCalledWith('notification:read', {
      notification_id: 'n1',
    });
    expect(laterIo._emit).not.toHaveBeenCalled();
  });
});
