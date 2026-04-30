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

// ✅ FIX: sameSite must be 'none' in production (cross-origin) and 'lax' in
// development (HTTP). SameSite=strict was blocking cross-origin fetch() with
// withCredentials: true on the frontend — the cookie was silently rejected.
// secure must be true only in production — in development (HTTP localhost)
// secure: true causes the browser to silently drop the cookie entirely.

const refreshCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, refreshCookieOptions);
  // Backward compatibility while frontend migrates from snake_case key.
  res.cookie('refresh_token', token, refreshCookieOptions);
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', refreshCookieOptions);
  res.clearCookie('refresh_token', refreshCookieOptions);
};

exports.register = async (req, res) => {
  const { email, password, display_name, gender, date_of_birth, captcha_token, platform } =
    req.body;

  const data = await authService.register({
    email,
    password,
    display_name,
    gender,
    date_of_birth,
    captcha_token,
    platform,
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

  setRefreshTokenCookie(res, data.refreshToken);

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

  const result = await authService.login({
    identifier: identifier.trim(),
    password,
  });

  setRefreshTokenCookie(res, result.refresh_token);

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
  // ✅ FIX: Removed console.log('Cookies:', req.cookies) — was leaking
  // refresh tokens to server logs in plain text.
  const refresh_token =
    req.cookies?.refreshToken || req.cookies?.refresh_token || req.body?.refresh_token;

  const data = await authService.refresh({ refresh_token });
  const { refresh_token: newRefreshToken, ...responseData } = data;

  setRefreshTokenCookie(res, newRefreshToken);

  return success(res, responseData, 'Token refreshed successfully.');
};

exports.logout = async (req, res) => {
  const refresh_token = req.cookies?.refreshToken || req.cookies?.refresh_token;

  await authService.logout({ refresh_token });

  clearRefreshTokenCookie(res);

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
  const { email, captcha_token, platform } = req.body;

  if (!email || typeof email !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'email', issue: 'Email is required' },
    ]);
  }

  await authService.resendVerification({
    email: email.trim().toLowerCase(),
    captcha_token,
    platform,
  });

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

  setRefreshTokenCookie(res, result.refreshToken);

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

exports.githubOAuth = async (req, res) => {
  const { authUrl } = authService.githubGetAuthUrl();
  return res.redirect(authUrl);
};

exports.githubOAuthCallback = async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError || !code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=github_denied`);
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_params`);
  }

  const result = await authService.githubCallback({ code, state });

  setRefreshTokenCookie(res, result.refreshToken);

  // ⚠️ NOTE: access_token in URL is a known security risk (visible in browser
  // history and server logs). This is acceptable for the current project scope
  // but should be replaced with a short-lived one-time code exchange in production.
  const params = new URLSearchParams({
    access_token: result.accessToken,
    expires_in: parseDurationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN),
    is_new_user: result.is_new_user,
    user_id: result.user.id,
    email: result.user.email ?? '',
    display_name: result.user.display_name,
    role: result.user.role,
    is_verified: result.user.is_verified,
  });

  return res.redirect(`${process.env.CLIENT_URL}/auth/callback?${params.toString()}`);
};

exports.deleteAccount = async (req, res) => {
  const { password } = req.body;

  // Require password confirmation before deleting — safety net
  if (!password || typeof password !== 'string') {
    return error(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'password', issue: 'Password confirmation is required' },
    ]);
  }

  await authService.deleteAccount({
    userId: req.user.sub,
    password,
  });

  // Clear both cookie names used in the app.
  clearRefreshTokenCookie(res);

  return success(res, { success: true }, 'Account deleted successfully.');
};
