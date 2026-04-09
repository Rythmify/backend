const AppError = require('../utils/app-error');
const { validate: isUuid } = require('uuid');

const validateUuidParam = (paramName) => (req, _res, next) => {
  const value = req.params[paramName];
  if (!isUuid(value)) {
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
