// ============================================================
// sockets/messages.socket.js
// Owner : Alyaa Mohamed (BE-4) — Module 9
// Real-time 1-to-1 messaging via Socket.IO
// Handles: message delivery, read-status, typing indicators
//
// ARCHITECTURE:
// - HTTP endpoints handle DB persistence (source of truth)
// - Socket events handle real-time UI updates only
// - Client must call HTTP endpoint first, then emit socket event
// - No socket-level validation — HTTP layer already validates
//   all data before the client emits any socket event
//
// Room naming convention: conversation:<conversationId>
// ============================================================

const registerMessageHandlers = (io, socket) => {
  const userId = socket.user?.sub;

  // ----------------------------------------------------------
  // Join a conversation room
  // Client emits when user opens a conversation
  // ----------------------------------------------------------
  socket.on('message:join', ({ conversationId } = {}) => {
    try {
      const room = `conversation:${conversationId}`;
      socket.join(room);
      console.log(`[Socket.IO] ${socket.id} (user: ${userId}) joined ${room}`);
    } catch (err) {
      console.error(`[Socket.IO] message:join error:`, err.message);
    }
  });

  // ----------------------------------------------------------
  // Leave a conversation room
  // Client emits when user closes a conversation
  // ----------------------------------------------------------
  socket.on('message:leave', ({ conversationId } = {}) => {
    try {
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      console.log(`[Socket.IO] ${socket.id} (user: ${userId}) left ${room}`);
    } catch (err) {
      console.error(`[Socket.IO] message:leave error:`, err.message);
    }
  });

  // ----------------------------------------------------------
  // New message delivered in real time
  // Client emits AFTER HTTP POST succeeds
  // Passes the full message object from the HTTP response
  // ----------------------------------------------------------
  socket.on('message:send', ({ conversationId, message } = {}) => {
    try {
      const room = `conversation:${conversationId}`;
      socket.to(room).emit('message:received', { conversationId, message });
      console.log(`[Socket.IO] message:send in ${room} by user: ${userId}`);
    } catch (err) {
      console.error(`[Socket.IO] message:send error:`, err.message);
    }
  });

  // ----------------------------------------------------------
  // Message deleted in real time
  // Client emits AFTER HTTP DELETE succeeds
  // ----------------------------------------------------------
  socket.on('message:deleted', ({ conversationId, messageId } = {}) => {
    try {
      const room = `conversation:${conversationId}`;
      socket.to(room).emit('message:removed', { conversationId, messageId });
      console.log(`[Socket.IO] message:deleted in ${room} by user: ${userId}`);
    } catch (err) {
      console.error(`[Socket.IO] message:deleted error:`, err.message);
    }
  });

  // ----------------------------------------------------------
  // Message read state updated in real time
  // Client emits AFTER HTTP PATCH succeeds
  // ----------------------------------------------------------
  socket.on(
    'message:read',
    ({ conversationId, messageId, isRead, conversationUnreadCount } = {}) => {
      try {
        const room = `conversation:${conversationId}`;
        socket.to(room).emit('message:read_updated', {
          conversationId,
          messageId,
          isRead,
          conversationUnreadCount,
        });
        console.log(`[Socket.IO] message:read in ${room} by user: ${userId}`);
      } catch (err) {
        console.error(`[Socket.IO] message:read error:`, err.message);
      }
    }
  );

  // ----------------------------------------------------------
  // Typing indicator
  // Client emits while user is typing
  // NOTE: Frontend should throttle this to once per ~1000ms
  // ----------------------------------------------------------
  socket.on('message:typing', ({ conversationId } = {}) => {
    try {
      const room = `conversation:${conversationId}`;
      socket.to(room).emit('message:typing', { conversationId, userId });
    } catch (err) {
      console.error(`[Socket.IO] message:typing error:`, err.message);
    }
  });

  // ----------------------------------------------------------
  // Stop typing indicator
  // Client emits when user stops typing or sends the message
  // ----------------------------------------------------------
  socket.on('message:stop_typing', ({ conversationId } = {}) => {
    try {
      const room = `conversation:${conversationId}`;
      socket.to(room).emit('message:stop_typing', { conversationId, userId });
    } catch (err) {
      console.error(`[Socket.IO] message:stop_typing error:`, err.message);
    }
  });

  // ----------------------------------------------------------
  // Disconnect logging
  // ----------------------------------------------------------
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] ${socket.id} (user: ${userId}) disconnected — reason: ${reason}`);
  });
};

module.exports = { registerMessageHandlers };
