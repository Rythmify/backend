// ============================================================
// server.js — HTTP server + Socket.IO bootstrap
// ============================================================
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./src/config/env');
const { registerNotificationHandlers } = require('./src/sockets/notifications.socket');
const { registerMessageHandlers } = require('./src/sockets/messages.socket');

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  registerNotificationHandlers(io, socket);
  registerMessageHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

server.listen(env.PORT, () => {
  console.log(`Rythmify backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  console.log(`API Base URL: http://localhost:${env.PORT}/api/v1`);
});
