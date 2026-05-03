// ============================================================
// tests/sockets/messages.socket.test.js
// Unit tests for messages socket handlers
// ============================================================

const { registerMessageHandlers } = require('../../src/sockets/messages.socket');

describe('Messages Socket Handlers', () => {
  let io;
  let socket;
  let handlers = {};

  beforeEach(() => {
    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    socket = {
      id: 'sock1',
      user: { sub: 'u1' },
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      on: jest.fn((event, cb) => {
        handlers[event] = cb;
      }),
    };
    registerMessageHandlers(io, socket);
  });

  it('handles message:join', () => {
    handlers['message:join']({ conversationId: 'c1' });
    expect(socket.join).toHaveBeenCalledWith('conversation:c1');
  });

  it('handles message:join error', () => {
    socket.join.mockImplementation(() => { throw new Error('join fail'); });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    handlers['message:join']({ conversationId: 'c1' });
    expect(spy).toHaveBeenCalledWith('[Socket.IO] message:join error:', 'join fail');
    spy.mockRestore();
  });

  it('handles message:leave', () => {
    handlers['message:leave']({ conversationId: 'c1' });
    expect(socket.leave).toHaveBeenCalledWith('conversation:c1');
  });

  it('handles message:leave error', () => {
    socket.leave.mockImplementation(() => { throw new Error('leave fail'); });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    handlers['message:leave']({ conversationId: 'c1' });
    expect(spy).toHaveBeenCalledWith('[Socket.IO] message:leave error:', 'leave fail');
    spy.mockRestore();
  });

  it('handles message:send', () => {
    const message = { id: 'm1', text: 'hi' };
    handlers['message:send']({ conversationId: 'c1', message });
    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(socket.emit).toHaveBeenCalledWith('message:received', { conversationId: 'c1', message });
  });

  it('handles message:send error', () => {
    socket.to.mockImplementation(() => { throw new Error('send fail'); });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    handlers['message:send']({ conversationId: 'c1', message: {} });
    expect(spy).toHaveBeenCalledWith('[Socket.IO] message:send error:', 'send fail');
    spy.mockRestore();
  });

  it('handles message:deleted', () => {
    handlers['message:deleted']({ conversationId: 'c1', messageId: 'm1' });
    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(socket.emit).toHaveBeenCalledWith('message:removed', { conversationId: 'c1', messageId: 'm1' });
  });

  it('handles message:deleted error', () => {
      socket.to.mockImplementation(() => { throw new Error('del fail'); });
      const spy = jest.spyOn(console, 'error').mockImplementation();
      handlers['message:deleted']({ conversationId: 'c1' });
      expect(spy).toHaveBeenCalledWith('[Socket.IO] message:deleted error:', 'del fail');
      spy.mockRestore();
  });

  it('handles message:read', () => {
    handlers['message:read']({ conversationId: 'c1', messageId: 'm1', isRead: true, conversationUnreadCount: 0 });
    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(socket.emit).toHaveBeenCalledWith('message:read_updated', {
      conversationId: 'c1',
      messageId: 'm1',
      isRead: true,
      conversationUnreadCount: 0,
    });
  });

  it('handles message:read error', () => {
      socket.to.mockImplementation(() => { throw new Error('read fail'); });
      const spy = jest.spyOn(console, 'error').mockImplementation();
      handlers['message:read']({ conversationId: 'c1' });
      expect(spy).toHaveBeenCalledWith('[Socket.IO] message:read error:', 'read fail');
      spy.mockRestore();
  });

  it('handles message:typing', () => {
    handlers['message:typing']({ conversationId: 'c1' });
    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(socket.emit).toHaveBeenCalledWith('message:typing', { conversationId: 'c1', userId: 'u1' });
  });

  it('handles message:typing error', () => {
      socket.to.mockImplementation(() => { throw new Error('type fail'); });
      const spy = jest.spyOn(console, 'error').mockImplementation();
      handlers['message:typing']({ conversationId: 'c1' });
      expect(spy).toHaveBeenCalledWith('[Socket.IO] message:typing error:', 'type fail');
      spy.mockRestore();
  });

  it('handles message:stop_typing', () => {
    handlers['message:stop_typing']({ conversationId: 'c1' });
    expect(socket.to).toHaveBeenCalledWith('conversation:c1');
    expect(socket.emit).toHaveBeenCalledWith('message:stop_typing', { conversationId: 'c1', userId: 'u1' });
  });

  it('handles message:stop_typing error', () => {
      socket.to.mockImplementation(() => { throw new Error('stop fail'); });
      const spy = jest.spyOn(console, 'error').mockImplementation();
      handlers['message:stop_typing']({ conversationId: 'c1' });
      expect(spy).toHaveBeenCalledWith('[Socket.IO] message:stop_typing error:', 'stop fail');
      spy.mockRestore();
  });

  it('handles disconnect', () => {
    handlers['disconnect']('transport close');
    // Just for coverage
  });
});
