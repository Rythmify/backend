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

const generalLimiter = rateLimit({
  ...(isDisabled
    ? unlimited
    : {
        windowMs: 15 * 60 * 1000,
        max: 100,
      }),
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  ...(isDisabled
    ? unlimited
    : {
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 5 : 100,
      }),
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

const uploadLimiter = rateLimit({
  ...(isDisabled
    ? unlimited
    : {
        windowMs: 60 * 60 * 1000,
        max: 20,
      }),
  message: { success: false, message: 'Upload limit reached, please try again later.' },
});

const refreshLimiter = rateLimit({
  ...(isDisabled
    ? unlimited
    : {
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 30 : 200,
      }),
  message: { success: false, message: 'Too many refresh attempts.' },
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
  reportRateLimiter,
};
