// ============================================================
// server.js — HTTP server + Socket.IO bootstrap
// ============================================================
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./src/config/env');
const { verifyToken } = require('./src/config/jwt');
const { registerNotificationHandlers } = require('./src/sockets/notifications.socket');
const { registerMessageHandlers } = require('./src/sockets/messages.socket');
const { registerAdminNotificationHandlers } = require('./src/sockets/admin-notifications.socket');

const server = http.createServer(app);

const allowedOrigins = Array.from(
  new Set([...env.CLIENT_URL.split(',').map((o) => o.trim()), env.APP_URL].filter(Boolean))
);

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

io.use((socket, next) => {
  const authHeader = socket.handshake.auth?.token;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new Error('Access token required'));
  }
  const token = authHeader.split(' ')[1];
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
});

io.use((socket, next) => {
  const authHeader = socket.handshake.auth?.token;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new Error('Access token required'));
  }
  const token = authHeader.split(' ')[1];
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  registerNotificationHandlers(io, socket);
  registerMessageHandlers(io, socket);
  registerAdminNotificationHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

server.listen(env.PORT, () => {
  console.log(`Rythmify backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  console.log(`API Base URL: http://localhost:${env.PORT}/api/v1`);
  console.log('Note: Create blob containers manually via Azure Storage Explorer');
});
