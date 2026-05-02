const loadSocketModule = () => {
  jest.resetModules();
  return require('../src/sockets/admin-notifications.socket');
};

const mkIo = () => {
  const emit = jest.fn();
  const disconnectSockets = jest.fn();
  return {
    to: jest.fn(() => ({ emit })),
    in: jest.fn(() => ({ disconnectSockets })),
    _emit: emit,
    _disconnectSockets: disconnectSockets,
  };
};

const mkSocket = (role = 'admin') => {
  const handlers = {};
  return {
    user: role === undefined ? undefined : { role },
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
});

describe('admin-notifications.socket', () => {
  it('only registers moderation handlers for admin sockets', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();
    const adminSocket = mkSocket('admin');
    const userSocket = mkSocket('user');

    socketModule.registerAdminNotificationHandlers(io, adminSocket);
    socketModule.registerAdminNotificationHandlers(io, userSocket);

    expect(adminSocket.join).toHaveBeenCalledWith('admin:moderation');
    expect(adminSocket.on).toHaveBeenCalledWith('admin:moderation:subscribe', expect.any(Function));
    expect(adminSocket.on).toHaveBeenCalledWith(
      'admin:moderation:unsubscribe',
      expect.any(Function)
    );
    expect(userSocket.join).not.toHaveBeenCalled();
    expect(userSocket.on).not.toHaveBeenCalled();
  });

  it('subscribe and unsubscribe handlers respect current admin role', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();
    const socket = mkSocket('admin');

    socketModule.registerAdminNotificationHandlers(io, socket);
    socket._handlers['admin:moderation:subscribe']();
    socket._handlers['admin:moderation:unsubscribe']();

    socket.user.role = 'user';
    socket._handlers['admin:moderation:subscribe']();
    socket._handlers['admin:moderation:unsubscribe']();

    expect(socket.join).toHaveBeenCalledTimes(2);
    expect(socket.leave).toHaveBeenCalledTimes(1);
    expect(socket.leave).toHaveBeenCalledWith('admin:moderation');
  });

  it('does not emit events before initialization or with missing required payloads', () => {
    const socketModule = loadSocketModule();

    expect(() => socketModule.emitReportReceived({ report: { id: 'r1' } })).not.toThrow();
    expect(() => socketModule.emitReportResolved({ userId: 'u1', report: { id: 'r1' } })).not.toThrow();
    expect(() => socketModule.emitAppealSubmitted({ appeal: { id: 'a1' } })).not.toThrow();
    expect(() => socketModule.emitAppealReviewed({ userId: 'u1', appeal: { id: 'a1' } })).not.toThrow();
    expect(() => socketModule.emitUserWarned({ userId: 'u1', warning: { id: 'w1' } })).not.toThrow();
    expect(() => socketModule.emitUserSuspended({ userId: 'u1', user: { id: 'u1' } })).not.toThrow();
    expect(() =>
      socketModule.emitAdminAuditLog({
        action: 'act',
        adminUserId: 'admin',
        targetType: 'user',
        targetId: 'u1',
      })
    ).not.toThrow();

    const io = mkIo();
    socketModule.registerAdminNotificationHandlers(io, mkSocket('admin'));
    socketModule.emitReportReceived({ report: null });
    socketModule.emitReportResolved({ userId: null, report: { id: 'r1' } });
    socketModule.emitAppealSubmitted({ appeal: null });
    socketModule.emitAppealReviewed({ userId: 'u1', appeal: null });
    socketModule.emitUserWarned({ userId: 'u1', warning: null });
    socketModule.emitUserSuspended({ userId: 'u1', user: null });
    socketModule.emitAdminAuditLog({ action: '', adminUserId: 'admin', targetType: 'user', targetId: 'u1' });

    expect(io.to).not.toHaveBeenCalled();
  });

  it('emits admin room and user room moderation events', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();

    socketModule.registerAdminNotificationHandlers(io, mkSocket('admin'));
    socketModule.emitReportReceived({ report: { id: 'r1' } });
    socketModule.emitReportResolved({ userId: 'u1', report: { id: 'r1' } });
    socketModule.emitAppealSubmitted({ appeal: { id: 'a1' } });
    socketModule.emitAppealReviewed({ userId: 'u1', appeal: { id: 'a1' } });
    socketModule.emitUserWarned({ userId: 'u1', warning: { id: 'w1' } });

    expect(io._emit).toHaveBeenCalledWith('admin:report_received', {
      type: 'report_received',
      report: { id: 'r1' },
    });
    expect(io._emit).toHaveBeenCalledWith('admin:report_resolved', {
      type: 'report_resolved',
      report: { id: 'r1' },
    });
    expect(io._emit).toHaveBeenCalledWith('admin:appeal_submitted', {
      type: 'appeal_submitted',
      appeal: { id: 'a1' },
    });
    expect(io._emit).toHaveBeenCalledWith('admin:appeal_reviewed', {
      type: 'appeal_reviewed',
      appeal: { id: 'a1' },
    });
    expect(io._emit).toHaveBeenCalledWith('admin:user_warned', {
      type: 'user_warned',
      warning: { id: 'w1' },
    });
  });

  it('emits user suspension and disconnects active user sockets', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();

    socketModule.registerAdminNotificationHandlers(io, mkSocket('admin'));
    socketModule.emitUserSuspended({ userId: 'u1', user: { id: 'u1' } });

    expect(io.to).toHaveBeenCalledWith('notifications:user:u1');
    expect(io._emit).toHaveBeenCalledWith('admin:user_suspended', {
      type: 'user_suspended',
      user: { id: 'u1' },
    });
    expect(io.in).toHaveBeenCalledWith('notifications:user:u1');
    expect(io._disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('emits audit log with default metadata and timestamp', () => {
    const socketModule = loadSocketModule();
    const io = mkIo();

    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-03T00:00:00.000Z');
    socketModule.registerAdminNotificationHandlers(io, mkSocket('admin'));
    socketModule.emitAdminAuditLog({
      action: 'ban',
      adminUserId: 'admin-1',
      targetType: 'user',
      targetId: 'u1',
    });

    expect(io._emit).toHaveBeenCalledWith('admin:audit_log', {
      action: 'ban',
      admin_user_id: 'admin-1',
      target_type: 'user',
      target_id: 'u1',
      metadata: {},
      occurred_at: '2026-05-03T00:00:00.000Z',
    });
  });
});
