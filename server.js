// ============================================================
// server.js — HTTP server + Socket.IO bootstrap
// ============================================================
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./src/config/env');
const { verifyToken } = require('./src/config/jwt');
const userModel = require('./src/models/user.model');
const { registerMessageHandlers } = require('./src/sockets/messages.socket');
const {
  registerNotificationHandlers,
  initNotificationSocket,
} = require('./src/sockets/notifications.socket');
const { registerAdminNotificationHandlers } = require('./src/sockets/admin-notifications.socket');

const server = http.createServer(app);

const allowedOrigins = Array.from(
  new Set(
    [
      ...env.CLIENT_URL.split(',').map((o) => o.trim()),
      env.APP_URL,
      'https://gray-grass-0ab138600.7.azurestaticapps.net',
      'http://20.196.3.253',
      'https://rythmify.duckdns.org',
      'http://localhost:5173',
      'https://rythmify-backend-dev.livelypebble-6b7965ef.uaenorth.azurecontainerapps.io',
    ].filter(Boolean)
  )
);

const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

//because notifications are emitted from services, we need to initialize the socket reference at startup
initNotificationSocket(io);

// FIX 3 — single middleware block, duplicate removed
io.use(async (socket, next) => {
  const authHeader = socket.handshake.auth?.token;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new Error('Access token required'));
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    socket.user = decoded;

    // Check if user is suspended in the database
    const user = await userModel.findById(decoded.sub);
    if (!user || user.is_suspended) {
      return next(new Error('Your account is suspended or no longer exists.'));
    }

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
