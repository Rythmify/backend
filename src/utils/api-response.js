// ============================================================
// utils/api-response.js
// Success: { data, message }
// Error:   { error: { code, message, details? } }
// ============================================================

const success = (res, data = null, message = 'OK', statusCode = 200) => {
  return res.status(statusCode).json({ data, message });
};

const error = (res, code = 'INTERNAL_ERROR', message = 'Something went wrong', statusCode = 500, details = null) => {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
};

module.exports = { success, error };