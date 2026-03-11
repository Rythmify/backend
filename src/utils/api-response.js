// ============================================================
// utils/api-response.js
// Unified response envelope: { success, data, message, meta }
// ============================================================
const success = (res, data = null, message = 'OK', statusCode = 200, meta = null) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

const error = (res, message = 'Something went wrong', statusCode = 500, data = null) => {
  return res.status(statusCode).json({ success: false, message, data });
};

module.exports = { success, error };
