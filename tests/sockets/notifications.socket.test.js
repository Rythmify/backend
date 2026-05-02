const notificationsSocket = require('../../src/sockets/notifications.socket');

describe('Notifications Socket', () => {
  let ioMock;
  let socketMock;
  let emitMock;

  beforeEach(() => {
    emitMock = jest.fn();
    
    ioMock = {
      to: jest.fn().mockReturnValue({ emit: emitMock }),
    };

    socketMock = {
      user: { sub: 'u1' },
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
      id: 'socket_123',
    };
    
    // Re-initialize ioRef before each test
    notificationsSocket.initNotificationSocket(null);
  });

  describe('initNotificationSocket', () => {
    it('sets ioRef', () => {
      notificationsSocket.initNotificationSocket(ioMock);
      notificationsSocket.emitNotificationCreated({ userId: 'u1', notification: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
    });
  });

  describe('registerNotificationHandlers', () => {
    it('joins room if userId is present', () => {
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      expect(socketMock.join).toHaveBeenCalledWith('notifications:user:u1');
    });

    it('does not join room if userId is absent', () => {
      socketMock.user = null;
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      expect(socketMock.join).not.toHaveBeenCalled();
    });

    it('handles subscribe event with userId', () => {
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      const subscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'notification:subscribe')[1];
      
      socketMock.join.mockClear();
      subscribeHandler();
      expect(socketMock.join).toHaveBeenCalledWith('notifications:user:u1');
    });
    
    it('handles subscribe event without userId', () => {
      socketMock.user = null;
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      const subscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'notification:subscribe')[1];
      
      socketMock.join.mockClear();
      subscribeHandler();
      expect(socketMock.join).not.toHaveBeenCalled();
    });

    it('handles unsubscribe event with userId', () => {
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      const unsubscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'notification:unsubscribe')[1];
      
      unsubscribeHandler();
      expect(socketMock.leave).toHaveBeenCalledWith('notifications:user:u1');
    });
    
    it('handles unsubscribe event without userId', () => {
      socketMock.user = null;
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      const unsubscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'notification:unsubscribe')[1];
      
      unsubscribeHandler();
      expect(socketMock.leave).not.toHaveBeenCalled();
    });

    it('handles disconnect event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      notificationsSocket.registerNotificationHandlers(ioMock, socketMock);
      const disconnectHandler = socketMock.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      
      disconnectHandler('client_disconnect');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('client_disconnect'));
      consoleSpy.mockRestore();
    });
  });

  describe('emit functions', () => {
    beforeEach(() => {
      notificationsSocket.initNotificationSocket(ioMock);
    });

    it('emitNotificationCreated', () => {
      notificationsSocket.emitNotificationCreated({ userId: 'u1', notification: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
      expect(emitMock).toHaveBeenCalledWith('notification:created', { notification: { id: 1 } });
    });
    
    it('emitNotificationCreated - null checks', () => {
      notificationsSocket.emitNotificationCreated({});
      expect(ioMock.to).not.toHaveBeenCalled();
    });

    it('emitNotificationRead', () => {
      notificationsSocket.emitNotificationRead({ userId: 'u1', notificationId: 1 });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
      expect(emitMock).toHaveBeenCalledWith('notification:read', { notification_id: 1 });
    });
    
    it('emitNotificationRead - null checks', () => {
      notificationsSocket.emitNotificationRead({});
      expect(ioMock.to).not.toHaveBeenCalled();
    });
  });
});
