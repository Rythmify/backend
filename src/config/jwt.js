// ============================================================
// config/jwt.js — JWT sign / verify helpers
// Access tokens: 15 min | Refresh tokens: 7 days (httpOnly cookie)
// ============================================================
const jwt = require('jsonwebtoken');
const env = require('./env');

const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

module.exports = { signAccessToken, signRefreshToken, verifyToken, REFRESH_COOKIE_OPTIONS };
