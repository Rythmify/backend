// ============================================================
// middleware/error-handler.js — Centralised error handling
// Must be registered LAST in app.js after all routes
// ============================================================
const { error } = require('../utils/api-response');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return error(res, message, statusCode);
};

module.exports = errorHandler;
