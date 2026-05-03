// ============================================================
// app.js — Express app setup & middleware registration
// ============================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./src/config/env');
const { generalLimiter } = require('./src/middleware/rate-limiter');
const errorHandler = require('./src/middleware/error-handler');
const cookieParser = require('cookie-parser');

// ── Route imports ──────────────────────────────────────────
const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const followersRoutes = require('./src/routes/followers.routes');
const followDiscoveryRoutes = require('./src/routes/followdiscovery.routes');
const tracksRoutes = require('./src/routes/tracks.routes');
const playbackRoutes = require('./src/routes/playback.routes');
const engagementRoutes = require('./src/routes/engagement.routes');
const playlistsRoutes = require('./src/routes/playlists.routes');
const homeRoutes = require('./src/routes/home.routes');
const feedRoutes = require('./src/routes/feed.routes');
const messagesRoutes = require('./src/routes/messages.routes');
const notificationsRoutes = require('./src/routes/notifications.routes');
const adminRoutes = require('./src/routes/admin.routes');
const subscriptionsRoutes = require('./src/routes/subscriptions.routes');
const tagsRoutes = require('./src/routes/tags.routes');
const genresRoutes = require('./src/routes/genres.routes');
const searchRoutes = require('./src/routes/search.routes');
const stationRoutes = require('./src/routes/station.routes');
const insightsRoutes = require('./src/routes/insights.routes');
const { initBlobContainers } = require('./src/services/storage.service');
const metricsMiddleware = require('./src/middleware/metricsMiddleware');
const { register } = require('./src/utils/metrics');

const app = express();
app.set('trust proxy', 1);

// ── Global middleware ──────────────────────────────────────
app.use(helmet());

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

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(generalLimiter);

// ── Metrics middleware — must be before all routes ─────────
app.use(metricsMiddleware);


// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// ── Prometheus metrics (unauthenticated) ───────────────────
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── API Routes — /api/v1 ───────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes); // Module 1  — BE-1 Omar Hamdy
app.use(`${API}/users`, followersRoutes); // Module 3  — BE-3 Beshoy Maher
app.use(`${API}/users`, followDiscoveryRoutes); // Module 3  — BE-3 Beshoy Maher
app.use(`${API}/users`, usersRoutes); // Module 2  — BE-1 Omar Hamdy
app.use(`${API}/tags`, tagsRoutes); // Module 4
app.use(`${API}/genres`, genresRoutes); // Module 4
app.use(`${API}/tracks`, tracksRoutes); // Module 4  — BE-2 Saja
app.use(`${API}`, playbackRoutes); // Module 5  — BE-2 Saja
app.use(`${API}`, engagementRoutes); // Module 6  — BE-3 Beshoy Maher
app.use(`${API}/playlists`, playlistsRoutes); // Module 7  — BE-4 Alyaa
app.use(`${API}/home`, homeRoutes); // Module 8  — BE-5 Omar Hamza
app.use(`${API}/messages`, messagesRoutes); // Module 9  — BE-4 Alyaa
app.use(`${API}/notifications`, notificationsRoutes); // Module 10 — BE-4 Alyaa
app.use(`${API}`, adminRoutes); // Module 11 — BE-5 Omar Hamza
app.use(`${API}/subscriptions`, subscriptionsRoutes); // Module 12 — BE-1 Omar Hamdy
app.use(`${API}/feed`, feedRoutes);
app.use(`${API}`, insightsRoutes);
app.use(`${API}`, searchRoutes);
app.use(`${API}`, stationRoutes); // Station save/unsave — BE-5 Omar Hamza
// ── Centralised error handler (must be last) ───────────────
app.use(errorHandler);

module.exports = app;
