// ============================================================
// sockets/notifications.socket.js
// Owner : Alyaa Mohamed (BE-4) — Module 10
// Real-time notification events via Socket.IO
// Triggers: follow, like, repost, comment
// ============================================================

let ioRef = null;

const getUserRoom = (userId) => `notifications:user:${userId}`;

const emitNotificationCreated = ({ userId, notification }) => {
  if (!ioRef || !userId || !notification) return;
  ioRef.to(getUserRoom(userId)).emit('notification:created', { notification });
};

const emitNotificationRead = ({ userId, notificationId }) => {
  if (!ioRef || !userId || !notificationId) return;
  ioRef.to(getUserRoom(userId)).emit('notification:read', { notification_id: notificationId });
};

const registerNotificationHandlers = (io, socket) => {
  ioRef = io;

  const userId = socket.user?.sub;
  if (!userId) return;

  const room = getUserRoom(userId);
  socket.join(room);

  socket.on('notification:subscribe', () => {
    socket.join(room);
  });

  socket.on('notification:unsubscribe', () => {
    socket.leave(room);
  });
};

module.exports = {
  registerNotificationHandlers,
  emitNotificationCreated,
  emitNotificationRead,
};
