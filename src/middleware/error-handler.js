// ============================================================
// middleware/error-handler.js
// ============================================================
const { error } = require('../utils/api-response');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, 'UPLOAD_FILE_TOO_LARGE', 'File size exceeds the allowed limit', 413);
  }

  if (err.message === 'Invalid audio format' || err.message === 'Invalid image format') {
    return error(res, 'UPLOAD_INVALID_FILE_TYPE', 'Unsupported file format', 415);
  }

  if (err.message === 'Unexpected file field') {
    return error(res, 'VALIDATION_FAILED', 'Unexpected file field', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';
  return error(res, code, message, statusCode);
};

module.exports = errorHandler;
