// ============================================================
// middleware/rate-limiter.js
// General: 100/15min | Auth: 5/15min | File uploads: 20/hr
// ============================================================
const rateLimit = require('express-rate-limit');

const isDisabled = true; // ⚠️ TEMP: disable rate limit for testing

const unlimited = {
  windowMs: 1, // irrelevant
  max: Number.MAX_SAFE_INTEGER,
};

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    ...(isDisabled
      ? unlimited
      : {
          windowMs,
          max,
        }),
    message: { success: false, message },
  });

const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: 'Too many auth attempts, please try again later.',
});

const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Upload limit reached, please try again later.',
});

const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  message: 'Too many refresh attempts.',
});

const trackWriteLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 500,
  message: 'Too many track changes, please try again later.',
});

const playbackWriteLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 3000 : 10000,
  message: 'Too many playback updates, please try again later.',
});

const playbackEventLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 6000 : 20000,
  message: 'Too many playback events, please try again later.',
});

const subscriptionWriteLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: 'Too many subscription requests, please try again later.',
});

const downloadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 300,
  message: 'Too many download requests, please try again later.',
});

const publicReadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000,
  message: 'Too many requests, please try again later.',
});

const reportRateLimiter = rateLimit({
  ...(isDisabled
    ? unlimited
    : {
        windowMs: 60 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 10 : 100,
      }),
  message: { success: false, message: 'Too many reports, please try again later.' },
});

module.exports = {
  generalLimiter,
  authLimiter,
  refreshLimiter,
  uploadLimiter,
  trackWriteLimiter,
  playbackWriteLimiter,
  playbackEventLimiter,
  subscriptionWriteLimiter,
  downloadLimiter,
  publicReadLimiter,
  reportRateLimiter,
};
