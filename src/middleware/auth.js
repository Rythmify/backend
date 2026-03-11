// ============================================================
// middleware/auth.js — JWT verification & token extraction
// Attaches decoded user payload to req.user
// ============================================================
const { verifyToken } = require('../config/jwt');
const { error } = require('../utils/api-response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Access token required', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return error(res, 'Invalid or expired token', 401);
  }
};

module.exports = { authenticate };
