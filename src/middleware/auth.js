// ============================================================
// middleware/auth.js — JWT verification & token extraction
// Attaches decoded user payload to req.user
// ============================================================
const { verifyToken } = require('../config/jwt');
const { error } = require('../utils/api-response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'AUTH_TOKEN_MISSING', 'Authorization header missing', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return error(res, 'AUTH_TOKEN_INVALID', 'Invalid or expired access token', 401);
  }
};

// Optional authentication middleware for routes that can be accessed with or without a token
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyToken(token);
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate };
