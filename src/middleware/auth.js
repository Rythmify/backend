// ============================================================
// middleware/auth.js — JWT verification & token extraction
// Attaches decoded user payload to req.user
// ============================================================
const { verifyToken } = require('../config/jwt');
const { error } = require('../utils/api-response');
const userModel = require('../models/user.model');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'AUTH_TOKEN_MISSING', 'Authorization header missing', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;

    // Immediate session invalidation check:
    // Verify user still exists and is not suspended in the database
    const user = await userModel.findById(decoded.sub);
    if (!user) {
      return error(res, 'AUTH_USER_NOT_FOUND', 'User account no longer exists', 401);
    }

    if (user.is_suspended) {
      return error(
        res,
        'AUTH_ACCOUNT_SUSPENDED',
        'Your account is suspended. Please contact support.',
        403
      );
    }

    next();
  } catch (err) {
    return error(res, 'AUTH_TOKEN_INVALID', 'Invalid or expired access token', 401);
  }
};

// Optional authentication middleware for routes that can be accessed with or without a token
const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    const user = await userModel.findById(decoded.sub);

    if (!user || user.is_suspended) {
      req.user = null;
    } else {
      req.user = decoded;
    }
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate };
