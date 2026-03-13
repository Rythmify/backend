// ============================================================
// middleware/error-handler.js
// ============================================================
const { error } = require('../utils/api-response');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Internal Server Error';
  const code       = err.code       || 'INTERNAL_ERROR';
  return error(res, code, message, statusCode);
};

module.exports = errorHandler;