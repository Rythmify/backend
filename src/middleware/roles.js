// ============================================================
// middleware/roles.js — Role guards: Artist / Listener / Admin
// Usage: router.post('/upload', authenticate, requireRole('artist'), ...)
// ============================================================
const { error } = require('../utils/api-response');

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, 'Forbidden: insufficient permissions', 403);
    }
    next();
  };

module.exports = { requireRole };
