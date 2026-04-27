// ============================================================
// sockets/admin-notifications.socket.js
// Real-time admin moderation events via Socket.IO
// ============================================================

let ioRef = null;

const ADMIN_ROOM = 'admin:moderation';
const getUserRoom = (userId) => `notifications:user:${userId}`;

const registerAdminNotificationHandlers = (io, socket) => {
  ioRef = io;

  if (socket.user?.role !== 'admin') {
    return;
  }

  socket.join(ADMIN_ROOM);

  socket.on('admin:moderation:subscribe', () => {
    if (socket.user?.role === 'admin') {
      socket.join(ADMIN_ROOM);
    }
  });

  socket.on('admin:moderation:unsubscribe', () => {
    if (socket.user?.role === 'admin') {
      socket.leave(ADMIN_ROOM);
    }
  });
};

const emitReportReceived = ({ report }) => {
  if (!ioRef || !report) return;

  ioRef.to(ADMIN_ROOM).emit('admin:report_received', {
    type: 'report_received',
    report,
  });
};

const emitReportResolved = ({ userId, report }) => {
  if (!ioRef || !userId || !report) return;

  ioRef.to(getUserRoom(userId)).emit('admin:report_resolved', {
    type: 'report_resolved',
    report,
  });
};

const emitAppealSubmitted = ({ appeal }) => {
  if (!ioRef || !appeal) return;

  ioRef.to(ADMIN_ROOM).emit('admin:appeal_submitted', {
    type: 'appeal_submitted',
    appeal,
  });
};

const emitAppealReviewed = ({ userId, appeal }) => {
  if (!ioRef || !userId || !appeal) return;

  ioRef.to(getUserRoom(userId)).emit('admin:appeal_reviewed', {
    type: 'appeal_reviewed',
    appeal,
  });
};

const emitUserWarned = ({ userId, warning }) => {
  if (!ioRef || !userId || !warning) return;

  ioRef.to(getUserRoom(userId)).emit('admin:user_warned', {
    type: 'user_warned',
    warning,
  });
};

const emitUserSuspended = ({ userId, user }) => {
  if (!ioRef || !userId || !user) return;

  ioRef.to(getUserRoom(userId)).emit('admin:user_suspended', {
    type: 'user_suspended',
    user,
  });
};

const emitAdminAuditLog = ({ action, adminUserId, targetType, targetId, metadata = {} }) => {
  if (!ioRef || !action || !adminUserId || !targetType || !targetId) return;

  ioRef.to(ADMIN_ROOM).emit('admin:audit_log', {
    action,
    admin_user_id: adminUserId,
    target_type: targetType,
    target_id: targetId,
    metadata,
    occurred_at: new Date().toISOString(),
  });
};

module.exports = {
  registerAdminNotificationHandlers,
  emitReportReceived,
  emitReportResolved,
  emitAppealSubmitted,
  emitAppealReviewed,
  emitUserWarned,
  emitUserSuspended,
  emitAdminAuditLog,
};
