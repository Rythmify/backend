const AppError = require('../utils/app-error');

// Accept PostgreSQL UUID-shaped ids used across seeded data.
// We intentionally do not enforce RFC UUID version/variant bits.
const UUID_SHAPED_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateUuidParam = (paramName) => (req, _res, next) => {
  const value = req.params[paramName];
  if (!UUID_SHAPED_REGEX.test(value)) {
    return next(new AppError(`${paramName} must be a valid UUID.`, 400, 'VALIDATION_FAILED'));
  }
  return next();
};

const validatePatternParam = (paramName, regex, message) => (req, _res, next) => {
  const value = req.params[paramName];
  if (!regex.test(value)) {
    return next(new AppError(message, 400, 'VALIDATION_FAILED'));
  }
  return next();
};

module.exports = {
  validateUuidParam,
  validatePatternParam,
};
