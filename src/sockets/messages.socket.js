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
//
// Room naming convention: conversation:<conversationId>
// ============================================================

const messagesService = require('../services/messages.service');

// ------------------------------------------------------------
// Helper — validate UUID format
// Only used where a DB call is made to prevent unhandled errors
// ------------------------------------------------------------
const isValidUUID = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// ------------------------------------------------------------
const registerMessageHandlers = (io, socket) => {
  // userId extracted from JWT-verified payload set by server.js middleware
  const userId = socket.user?.sub;
  const ensureAuthenticated = () => {
    if (!isValidUUID(userId)) {
      socket.emit('error', { message: 'Authentication required.' });
      return false;
    }
    return true;
  };

  const ensureParticipantInConversation = async (conversationId) => {
    if (!isValidUUID(conversationId)) {
      socket.emit('error', { message: 'Invalid conversationId.' });
      return false;
    }

    try {
      await messagesService.assertConversationAccess({ conversationId, userId });
      return true;
    } catch (err) {
      const isAccessError = err?.code === 'FORBIDDEN' || err?.code === 'CONVERSATION_NOT_FOUND';
      if (isAccessError) {
        socket.emit('error', { message: 'You are not a participant in this conversation.' });
        return false;
      }

      console.error(`[Socket.IO] conversation access check failed:`, err.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
      return false;
    }
  };

  // ----------------------------------------------------------
  // Join a conversation room
  // Client emits when user opens a conversation
  // Security: UUID validated and participant check done here
  // because this is a socket-only event with no HTTP equivalent
  // ----------------------------------------------------------
  socket.on('message:join', async ({ conversationId } = {}) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const canAccess = await ensureParticipantInConversation(conversationId);
    if (!canAccess) {
      return;
    }

    const room = `conversation:${conversationId}`;
    socket.join(room);
    console.log(`[Socket.IO] ${socket.id} (user: ${userId}) joined ${room}`);
  });

  // ----------------------------------------------------------
  // Leave a conversation room
  // Client emits when user closes a conversation
  // ----------------------------------------------------------
  socket.on('message:leave', async ({ conversationId } = {}) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const canAccess = await ensureParticipantInConversation(conversationId);
    if (!canAccess) {
      return;
    }

    const room = `conversation:${conversationId}`;
    socket.leave(room);
    console.log(`[Socket.IO] ${socket.id} (user: ${userId}) left ${room}`);
  });

  // ----------------------------------------------------------
  // New message delivered in real time
  // Client emits AFTER POST /messages/new or
  // POST /messages/conversations/:conversationId/messages succeeds
  // Passes the full message object from the HTTP response
  // ----------------------------------------------------------
  socket.on('message:send', async ({ conversationId, message } = {}) => {
    if (!ensureAuthenticated()) {
      return;
    }

    if (!message || typeof message !== 'object') {
      return socket.emit('error', { message: 'Invalid payload.' });
    }

    const canAccess = await ensureParticipantInConversation(conversationId);
    if (!canAccess) {
      return;
    }

    const room = `conversation:${conversationId}`;
    socket.to(room).emit('message:received', { conversationId, message });
    console.log(`[Socket.IO] message:send in ${room} by user: ${userId}`);
  });

  // ----------------------------------------------------------
  // Message deleted in real time
  // Client emits AFTER
  // DELETE /messages/conversations/:conversationId/messages/:messageId succeeds
  // ----------------------------------------------------------
  socket.on('message:deleted', async ({ conversationId, messageId } = {}) => {
    if (!ensureAuthenticated()) {
      return;
    }

    if (!isValidUUID(messageId)) {
      return socket.emit('error', { message: 'Invalid payload.' });
    }

    const canAccess = await ensureParticipantInConversation(conversationId);
    if (!canAccess) {
      return;
    }

    const room = `conversation:${conversationId}`;
    socket.to(room).emit('message:removed', { conversationId, messageId });
    console.log(`[Socket.IO] message:deleted in ${room} by user: ${userId}`);
  });

  // ----------------------------------------------------------
  // Message read state updated in real time
  // Client emits AFTER
  // PATCH /messages/conversations/:conversationId/messages/:messageId/read succeeds
  // ----------------------------------------------------------
  socket.on(
    'message:read',
    async ({ conversationId, messageId, isRead, conversationUnreadCount } = {}) => {
      if (!ensureAuthenticated()) {
        return;
      }

      if (!isValidUUID(messageId) || typeof isRead !== 'boolean') {
        return socket.emit('error', { message: 'Invalid payload.' });
      }

      const canAccess = await ensureParticipantInConversation(conversationId);
      if (!canAccess) {
        return;
      }

      const room = `conversation:${conversationId}`;
      socket.to(room).emit('message:read_updated', {
        conversationId,
        messageId,
        isRead,
        conversationUnreadCount,
      });
      console.log(`[Socket.IO] message:read in ${room} by user: ${userId}`);
    }
  );

  // ----------------------------------------------------------
  // Typing indicator
  // Client emits while user is typing
  // NOTE: Frontend should throttle this to once per ~1000ms
  // ----------------------------------------------------------
  socket.on('message:typing', async ({ conversationId } = {}) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const canAccess = await ensureParticipantInConversation(conversationId);
    if (!canAccess) {
      return;
    }

    const room = `conversation:${conversationId}`;
    socket.to(room).emit('message:typing', { conversationId, userId });
  });

  // ----------------------------------------------------------
  // Stop typing indicator
  // Client emits when user stops typing or sends the message
  // ----------------------------------------------------------
  socket.on('message:stop_typing', async ({ conversationId } = {}) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const canAccess = await ensureParticipantInConversation(conversationId);
    if (!canAccess) {
      return;
    }

    const room = `conversation:${conversationId}`;
    socket.to(room).emit('message:stop_typing', { conversationId, userId });
  });
};

module.exports = { registerMessageHandlers };
