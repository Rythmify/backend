// ============================================================
// utils/app-error.js — Custom error class with HTTP status code
// Usage: throw new AppError('message', statusCode)
// Caught by middleware/error-handler.js
// ============================================================
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode    = statusCode;
    this.code          = code;       
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;