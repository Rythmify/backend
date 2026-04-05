// ============================================================
// controllers/auth.controller.js
// Owner : Omar Hamdy (BE-1)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const authService = require('../services/auth.service');
const { success } = require('../utils/api-response');
const { error } = require('../utils/api-response');
const { parseDurationToSeconds } = require('../utils/token-generator');
const { isValidEmail, isValidPassword } = require('../utils/validators');

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

exports.verifyEmail = async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'token', issue: 'Verification token is required' },
    ]);
  }

  const data = await authService.verifyEmail({ token });

  // Set refresh token as HttpOnly cookie
  res.cookie('refresh_token', data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return success(
    res,
    {
      access_token: data.accessToken,
      token_type: 'Bearer',
      expires_in: data.expires_in,
    },
    'Email verified successfully.'
  );
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
    identifier: identifier.trim(),
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

exports.logout = async (req, res) => {
  const refresh_token = req.cookies?.refresh_token;

  await authService.logout({ refresh_token });

  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return success(res, { success: true }, 'Logged out successfully.');
};

exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'email', issue: 'Must be a valid email address' },
    ]);
  }

  await authService.requestPasswordReset({ email });
  return success(
    res,
    { success: true },
    'If an account with that email exists, a password reset link has been sent.'
  );
};

exports.resetPassword = async (req, res) => {
  const { token, new_password, confirm_password, logout_all = true } = req.body;
  const details = [];

  if (!token || typeof token !== 'string' || !token.trim()) {
    details.push({ field: 'token', issue: 'Reset token is required' });
  }

  if (!new_password || typeof new_password !== 'string' || !isValidPassword(new_password)) {
    details.push({
      field: 'new_password',
      issue: 'Min 8 characters, must include uppercase, lowercase, and a number',
    });
  }

  if (confirm_password !== new_password) {
    details.push({ field: 'confirm_password', issue: 'Must exactly match new_password' });
  }

  if (typeof logout_all !== 'boolean') {
    details.push({ field: 'logout_all', issue: 'Must be a boolean' });
  }

  if (details.length > 0) {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, details);
  }

  await authService.resetPassword({ token: token.trim(), new_password, logout_all });
  return success(res, { success: true }, 'Password has been reset successfully.');
};

exports.resendVerification = async (req, res) => {
  const { email, captcha_token } = req.body;

  if (!email || typeof email !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'email', issue: 'Email is required' },
    ]);
  }

  await authService.resendVerification({ email: email.trim().toLowerCase(), captcha_token });

  return success(
    res,
    { success: true },
    "If this email is registered, you'll receive a new verification link shortly."
  );
};

exports.changeEmail = async (req, res) => {
  const { new_email } = req.body;

  if (!new_email || typeof new_email !== 'string' || !isValidEmail(new_email)) {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'new_email', issue: 'Must be a valid email address' },
    ]);
  }

  await authService.changeEmail({
    userId: req.user.sub,
    new_email: new_email.trim().toLowerCase(),
  });

  return success(res, { success: true }, 'Verification email sent to the new address.');
};

exports.verifyEmailChange = async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'token', issue: 'Token is required' },
    ]);
  }

  const data = await authService.verifyEmailChange({ token });

  return success(res, data, 'Email updated successfully.');
};

exports.googleLogin = async (req, res) => {
  const { id_token } = req.body;

  if (!id_token || typeof id_token !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'id_token', issue: 'Google id_token is required' },
    ]);
  }

  const result = await authService.googleLogin({ id_token });

  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return success(
    res,
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: parseDurationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN),
      is_new_user: result.is_new_user,
      user: {
        user_id: result.user.id,
        email: result.user.email,
        display_name: result.user.display_name,
        gender: result.user.gender,
        role: result.user.role,
        is_verified: result.user.is_verified,
      },
    },
    'Logged in successfully with Google.'
  );
};

// GET /auth/oauth/github
// Generates the GitHub consent URL and redirects the user there.
// Stores CSRF `state` in a short-lived httpOnly cookie.
exports.githubOAuth = async (req, res) => {
  const { authUrl, state } = authService.githubGetAuthUrl();

  // Store state for CSRF validation when GitHub redirects back.
  // sameSite:'lax' is required — 'strict' would drop the cookie
  // on the cross-site redirect back from GitHub.
  res.cookie('gh_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  return res.redirect(authUrl);
};

// ── GET /auth/oauth/github/callback ─────────────────────────
// GitHub redirects here after the user approves or denies access.
exports.githubOAuthCallback = async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  // denied access
  if (oauthError || !code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=github_denied`);
  }

  // Validate presence and type of required query params
  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Missing or invalid OAuth callback parameters',
      },
    });
  }

  // CSRF protection: compare state param with stored cookie value
  const storedState = req.cookies?.gh_oauth_state;

  res.clearCookie('gh_oauth_state', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  const result = await authService.githubCallback({ code, state, storedState });

  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return success(
    res,
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: parseDurationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN),
      is_new_user: result.is_new_user,
      user: {
        user_id: result.user.id,
        email: result.user.email,
        display_name: result.user.display_name,
        gender: result.user.gender,
        role: result.user.role,
        is_verified: result.user.is_verified,
      },
    },
    'Logged in successfully with GitHub.'
  );
};
