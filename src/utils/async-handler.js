// ============================================================
// utils/async-handler.js
// Wraps every route handler — centralised async error catching
// Usage: router.get('/path', asyncHandler(controller.method))
// ============================================================
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
