// ============================================================
// middleware/validate-register.js
// Validates POST /auth/register request body
// Returns 400 with field-level errors if invalid
// ============================================================
const { error } = require('../utils/api-response');
const {
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
  isValidDateOfBirth,
  isValidGender,
} = require('../utils/validators');

const validateRegister = (req, res, next) => {
  const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim() : req.body.email;
  const email = rawEmail?.toLowerCase();
  const password = req.body.password;
  const display_name =
    typeof req.body.display_name === 'string'
      ? req.body.display_name.trim()
      : req.body.display_name;
  const gender = req.body.gender;
  const date_of_birth = req.body.date_of_birth;
  const details = [];

  if (!email || !isValidEmail(email))
    details.push({ field: 'email', issue: 'Must be a valid email address' });

  if (!password || !isValidPassword(password))
    details.push({
      field: 'password',
      issue: 'Min 8 characters, must include uppercase, lowercase, and a number',
    });

  if (!display_name || !isValidDisplayName(display_name))
    details.push({ field: 'display_name', issue: 'Must be between 1 and 50 characters' });

  if (!gender || !isValidGender(gender))
    details.push({ field: 'gender', issue: 'Must be male or female' });

  if (!date_of_birth || !isValidDateOfBirth(date_of_birth))
    details.push({
      field: 'date_of_birth',
      issue: 'Must be a valid date and user must be at least 13 years old',
    });

  if (details.length > 0) {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, details);
  }

  next();
};

module.exports = { validateRegister };
