const adminNotificationsSocket = require('../../src/sockets/admin-notifications.socket');

describe('Admin Notifications Socket', () => {
  let ioMock;
  let socketMock;
  let emitMock;

  beforeEach(() => {
    emitMock = jest.fn();
    
    const toMock = jest.fn().mockReturnValue({
      emit: emitMock,
      disconnectSockets: jest.fn()
    });

    ioMock = {
      to: toMock,
      in: toMock,
    };

    socketMock = {
      user: { role: 'admin' },
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
    };
  });

  describe('registerAdminNotificationHandlers', () => {
    it('does nothing if user is not admin', () => {
      socketMock.user = { role: 'listener' };
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
      expect(socketMock.join).not.toHaveBeenCalled();
    });

    it('joins ADMIN_ROOM if user is admin', () => {
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
      expect(socketMock.join).toHaveBeenCalledWith('admin:moderation');
    });

    it('handles subscribe event for admin', () => {
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
      const subscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'admin:moderation:subscribe')[1];
      
      socketMock.join.mockClear();
      subscribeHandler();
      expect(socketMock.join).toHaveBeenCalledWith('admin:moderation');
    });
    
    it('handles subscribe event for non-admin (ignores)', () => {
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
      const subscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'admin:moderation:subscribe')[1];
      
      socketMock.user = { role: 'listener' };
      socketMock.join.mockClear();
      subscribeHandler();
      expect(socketMock.join).not.toHaveBeenCalled();
    });

    it('handles unsubscribe event for admin', () => {
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
      const unsubscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'admin:moderation:unsubscribe')[1];
      
      unsubscribeHandler();
      expect(socketMock.leave).toHaveBeenCalledWith('admin:moderation');
    });
    
    it('handles unsubscribe event for non-admin (ignores)', () => {
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
      const unsubscribeHandler = socketMock.on.mock.calls.find(call => call[0] === 'admin:moderation:unsubscribe')[1];
      
      socketMock.user = { role: 'listener' };
      unsubscribeHandler();
      expect(socketMock.leave).not.toHaveBeenCalled();
    });
  });

  describe('emit functions', () => {
    beforeEach(() => {
      adminNotificationsSocket.registerAdminNotificationHandlers(ioMock, socketMock);
    });

    it('emitReportReceived', () => {
      adminNotificationsSocket.emitReportReceived({ report: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('admin:moderation');
      expect(emitMock).toHaveBeenCalledWith('admin:report_received', { type: 'report_received', report: { id: 1 } });
    });
    
    it('emitReportReceived - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitReportReceived({});
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('emitReportResolved', () => {
      adminNotificationsSocket.emitReportResolved({ userId: 'u1', report: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
      expect(emitMock).toHaveBeenCalledWith('admin:report_resolved', { type: 'report_resolved', report: { id: 1 } });
    });
    
    it('emitReportResolved - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitReportResolved({});
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('emitAppealSubmitted', () => {
      adminNotificationsSocket.emitAppealSubmitted({ appeal: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('admin:moderation');
      expect(emitMock).toHaveBeenCalledWith('admin:appeal_submitted', { type: 'appeal_submitted', appeal: { id: 1 } });
    });
    
    it('emitAppealSubmitted - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitAppealSubmitted({});
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('emitAppealReviewed', () => {
      adminNotificationsSocket.emitAppealReviewed({ userId: 'u1', appeal: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
      expect(emitMock).toHaveBeenCalledWith('admin:appeal_reviewed', { type: 'appeal_reviewed', appeal: { id: 1 } });
    });
    
    it('emitAppealReviewed - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitAppealReviewed({});
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('emitUserWarned', () => {
      adminNotificationsSocket.emitUserWarned({ userId: 'u1', warning: { id: 1 } });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
      expect(emitMock).toHaveBeenCalledWith('admin:user_warned', { type: 'user_warned', warning: { id: 1 } });
    });
    
    it('emitUserWarned - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitUserWarned({});
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('emitUserSuspended', () => {
      const disconnectSocketsMock = jest.fn();
      ioMock.in = jest.fn().mockReturnValue({ disconnectSockets: disconnectSocketsMock });
      
      adminNotificationsSocket.emitUserSuspended({ userId: 'u1', user: { id: 'u1' } });
      expect(ioMock.to).toHaveBeenCalledWith('notifications:user:u1');
      expect(emitMock).toHaveBeenCalledWith('admin:user_suspended', { type: 'user_suspended', user: { id: 'u1' } });
      
      expect(ioMock.in).toHaveBeenCalledWith('notifications:user:u1');
      expect(disconnectSocketsMock).toHaveBeenCalledWith(true);
    });
    
    it('emitUserSuspended - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitUserSuspended({});
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('emitAdminAuditLog', () => {
      adminNotificationsSocket.emitAdminAuditLog({
        action: 'suspend',
        adminUserId: 'admin1',
        targetType: 'user',
        targetId: 'u1',
        metadata: { reason: 'spam' }
      });
      expect(ioMock.to).toHaveBeenCalledWith('admin:moderation');
      expect(emitMock).toHaveBeenCalledWith('admin:audit_log', expect.objectContaining({
        action: 'suspend',
        admin_user_id: 'admin1',
        target_type: 'user',
        target_id: 'u1',
        metadata: { reason: 'spam' }
      }));
    });
    
    it('emitAdminAuditLog - default metadata', () => {
      adminNotificationsSocket.emitAdminAuditLog({
        action: 'suspend',
        adminUserId: 'admin1',
        targetType: 'user',
        targetId: 'u1'
      });
      expect(emitMock).toHaveBeenCalledWith('admin:audit_log', expect.objectContaining({
        metadata: {}
      }));
    });
    
    it('emitAdminAuditLog - null checks', () => {
      emitMock.mockClear();
      adminNotificationsSocket.emitAdminAuditLog({});
      expect(emitMock).not.toHaveBeenCalled();
    });
  });
});
