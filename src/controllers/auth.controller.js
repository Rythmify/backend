// ============================================================
// controllers/auth.controller.js
// Owner : Omar Hamdy (BE-1)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const authService = require('../services/auth.service');
const { success } = require('../utils/api-response');
const { error } = require('../utils/api-response');

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

exports.login = async (req, res) => {
  const { identifier, password } = req.body;

  // ── Validate input (field presence check only) ──────────
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'identifier', issue: 'Email or username is required' },
    ]);
  }

  if (!password || typeof password !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'password', issue: 'Password is required' },
    ]);
  }

  // ── Call service ────────────────────────────────────────
  const result = await authService.login({
    identifier: identifier.trim().toLowerCase(),
    password,
  });

  // ── Set refresh token as httpOnly cookie ────────────────
  res.cookie('refresh_token', result.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });

  // ── Send response ───────────────────────────────────────
  return success(
    res,
    {
      access_token: result.access_token,
      token_type: result.token_type,
      expires_in: result.expires_in,
      user: result.user,
      is_new_user: result.is_new_user,
    },
    'Logged in successfully'
  );
};

exports.refresh = async (req, res) => {
  const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;

  const data = await authService.refresh({ refresh_token });
  const { refresh_token: newRefreshToken, ...responseData } = data;

  res.cookie('refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return success(res, responseData, 'Token refreshed successfully.');
};
