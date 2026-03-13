// ============================================================
// controllers/auth.controller.js
// Owner : Omar Hamdy (BE-1)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const authService = require('../services/auth.service');
const { success } = require('../utils/api-response');

exports.register = async (req, res) => {
  const { email, password, display_name, gender, date_of_birth, captcha_token } = req.body;

  const data = await authService.register({
    email,
    password,
    display_name,
    gender,
    date_of_birth,
    captcha_token,
  });

  return success(res, data, 'Account created. Please verify your email.', 201);
};