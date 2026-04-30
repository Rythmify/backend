// ============================================================
// sockets/notifications.socket.js
// Owner : Alyaa Mohamed (BE-4) — Module 10
// Real-time notification events via Socket.IO
// Triggers: follow, like, repost, comment
// ============================================================

let ioRef = null;

const getUserRoom = (userId) => `notifications:user:${userId}`;

const initNotificationSocket = (io) => {
  ioRef = io;
};

const emitNotificationCreated = ({ userId, notification }) => {
  if (!ioRef || !userId || !notification) return;
  ioRef.to(getUserRoom(userId)).emit('notification:created', { notification });
};

const emitNotificationRead = ({ userId, notificationId }) => {
  if (!ioRef || !userId || !notificationId) return;
  ioRef.to(getUserRoom(userId)).emit('notification:read', { notification_id: notificationId });
};

const registerNotificationHandlers = (io, socket) => {
  // ioRef kept in sync each connection as fallback
  // but initNotificationSocket should be called at startup
  if (!ioRef) ioRef = io;

  const userId = socket.user?.sub;

  // Join notification room if userId present
  // If missing, socket stays connected but receives no notifications
  if (userId) {
    const room = getUserRoom(userId);
    socket.join(room);
  }

  socket.on('notification:subscribe', () => {
    if (userId) socket.join(getUserRoom(userId));
  });

  socket.on('notification:unsubscribe', () => {
    if (userId) socket.leave(getUserRoom(userId));
  });

  socket.on('disconnect', (reason) => {
    console.log(
      `[Socket.IO] notifications — socket ${socket.id} (user: ${userId}) disconnected — reason: ${reason}`
    );
  });
};

module.exports = {
  initNotificationSocket,
  registerNotificationHandlers,
  emitNotificationCreated,
  emitNotificationRead,
};
