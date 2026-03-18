const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/user.model');
const verificationTokenModel = require('../models/verification-token.model');
const refreshTokenModel = require('../models/refresh-token.model');
const oauthConnectionModel = require('../models/oauth-connection.model');
const { generateSecureToken, parseDurationToSeconds } = require('../utils/token-generator');
const TOKEN_TYPES = require('../constants/token-types');
const {
  sendVerificationEmail,
  sendResendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeEmail,
} = require('../utils/mailer');
const AppError = require('../utils/app-error');
const { signAccessToken, signRefreshToken, verifyToken } = require('../config/jwt');
const env = require('../config/env');



//=====================================
// Registration and Email verification
//=====================================

// CAPTCHA verification
const verifyCaptcha = async (captchaToken) => {
  if (!env.RECAPTCHA_SECRET) {
    console.warn('[CAPTCHA] Skipping — RECAPTCHA_SECRET not set');
    return;
  }
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${env.RECAPTCHA_SECRET}&response=${captchaToken}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.success || data.score < 0.5) {
    throw new AppError('CAPTCHA verification failed', 400, 'CAPTCHA_FAILED');
  }
};

// Register
exports.register = async ({
  email,
  password,
  display_name,
  gender,
  date_of_birth,
  captcha_token,
}) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new AppError('Email is required', 400, 'VALIDATION_FAILED');
  }
  const displayNameTrimmed = display_name?.trim();
  // Verify CAPTCHA i can't get a token to test with it now so imma comment it out for now :)
  //await verifyCaptcha(captcha_token);

  // Check duplicate email
  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError('Email already registered', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
  }

  // Hash password
  const password_hashed = await bcrypt.hash(password, 12);

  // Create user
  const user = await userModel.create({
    email: normalizedEmail,
    password_hashed,
    display_name: displayNameTrimmed,
    gender,
    date_of_birth,
  });

  // Create verification token — 24h expiry
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await verificationTokenModel.create({
    user_id: user.id,
    token,
    type: TOKEN_TYPES.VERIFY_EMAIL,
    expires_at: expiresAt,
  });

  // Send verification email
  await sendVerificationEmail(email, {
    displayName: display_name,
    token,
  });

  // Return
  return {
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    gender: user.gender,
    role: user.role,
    is_verified: user.is_verified,
    date_of_birth: user.date_of_birth,
    created_at: user.created_at,
  };
};

//=====================================
// Login and token refresh
//=====================================

const buildAuthResponse = ({ user, accessToken, refreshToken }) => ({
  access_token: accessToken,
  refresh_token: refreshToken,
  token_type: 'Bearer',
  expires_in: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
  user: {
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    gender: user.gender,
    role: user.role,
    is_verified: user.is_verified,
  },
  is_new_user: false,
});

const createAndStoreRefreshToken = async (userId) => {
  const refreshToken = signRefreshToken({ sub: userId });
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await refreshTokenModel.create({
    user_id: userId,
    refresh_token: refreshToken,
    expires_at: refreshExpiresAt,
  });

  return refreshToken;
};

exports.login = async ({ identifier, password }) => {
  const normalizedIdentifier = identifier?.trim();
  const identifierLower = normalizedIdentifier?.toLowerCase();

  const user = await userModel.findByEmailOrUsername(identifierLower);

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const passwordOk = await bcrypt.compare(password, user.password_hashed);

  if (!passwordOk) {
    throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  if (!user.is_verified) {
    throw new AppError('Email must be verified before login', 422, 'AUTH_EMAIL_NOT_VERIFIED');
  }

  if (user.is_suspended) {
    throw new AppError(
      'Your account is suspended. Please contact support.',
      403,
      'AUTH_ACCOUNT_SUSPENDED'
    );
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await createAndStoreRefreshToken(user.id);

  await userModel.updateLastLogin(user.id);

  return buildAuthResponse({ user, accessToken, refreshToken });
};

exports.refresh = async ({ refresh_token }) => {
  if (!refresh_token) {
    throw new AppError(
      'Refresh token is missing, invalid, or expired',
      401,
      'AUTH_REFRESH_TOKEN_INVALID'
    );
  }

  let payload;
  try {
    payload = verifyToken(refresh_token);
  } catch {
    throw new AppError(
      'Refresh token is missing, invalid, or expired',
      401,
      'AUTH_REFRESH_TOKEN_INVALID'
    );
  }

  const storedToken = await refreshTokenModel.findValid(refresh_token);
  if (!storedToken) {
    throw new AppError(
      'Refresh token is missing, invalid, or expired',
      401,
      'AUTH_REFRESH_TOKEN_INVALID'
    );
  }

  const user = await userModel.findById(payload.sub);
  if (!user) {
    throw new AppError('User not found', 404, 'AUTH_USER_NOT_FOUND');
  }

  if (user.is_suspended) {
    throw new AppError('Account suspended by admin', 403, 'AUTH_ACCOUNT_SUSPENDED');
  }

  await refreshTokenModel.revoke(refresh_token);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const newRefreshToken = await createAndStoreRefreshToken(user.id);

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
    refresh_token: newRefreshToken,
  };
};

// ============================================================
// Verify Email
// ============================================================
exports.verifyEmail = async ({ token }) => {
  const tokenRow = await verificationTokenModel.findValidToken(token, TOKEN_TYPES.VERIFY_EMAIL);
  if (!tokenRow) {
    throw new AppError('Invalid or expired verification token', 400, 'AUTH_TOKEN_INVALID');
  }

  await verificationTokenModel.markUsed(tokenRow.id);
  await userModel.markVerified(tokenRow.user_id);

  const user = await userModel.findById(tokenRow.user_id);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await createAndStoreRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    expires_in: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
  };
};

// ============================================================
// Logout
// ============================================================
exports.logout = async ({ refresh_token }) => {
  if (refresh_token) {
    await refreshTokenModel.revoke(refresh_token);
  }
};

// ============================================================
// Forgot Password and Reset Password
// ============================================================
exports.requestPasswordReset = async ({ email }) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return;

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    return;
  }

  // Create password reset token — 1h expiry
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await verificationTokenModel.create({
    user_id: user.id,
    token,
    type: TOKEN_TYPES.RESET_PASSWORD,
    expires_at: expiresAt,
  });

  // Send password reset email
  await sendPasswordResetEmail(email, {
    displayName: user.display_name,
    token,
  });
};

exports.resetPassword = async ({ token, new_password, logout_all = true }) => {
  const tokenRow = await verificationTokenModel.findValidToken(token, TOKEN_TYPES.RESET_PASSWORD);
  if (!tokenRow) {
    throw new AppError('Password reset token expired', 422, 'AUTH_TOKEN_EXPIRED');
  }

  const password_hashed = await bcrypt.hash(new_password, 12);
  await userModel.updatePassword(tokenRow.user_id, password_hashed);
  await verificationTokenModel.markUsed(tokenRow.id);

  if (logout_all) {
    await refreshTokenModel.revokeAllForUser(tokenRow.user_id);
  }
};

// ============================================================
// Resend Verification Email
// ============================================================
exports.resendVerification = async ({ email, captcha_token }) => {
  // await verifyCaptcha(captcha_token);  uncomment upon integration with frontend

  const user = await userModel.findByEmail(email);

  if (!user || user.is_verified) return;

  await verificationTokenModel.revokeAllForUser(user.id, TOKEN_TYPES.VERIFY_EMAIL);

  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await verificationTokenModel.create({
    user_id: user.id,
    token,
    type: TOKEN_TYPES.VERIFY_EMAIL,
    expires_at: expiresAt,
  });

  await sendResendVerificationEmail(email, {
    displayName: user.display_name,
    token,
  });
};

// ============================================================
// Change Email (request)
// ============================================================
exports.changeEmail = async ({ userId, new_email }) => {
  const existing = await userModel.findByEmail(new_email);
  if (existing) {
    throw new AppError('Email already registered', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
  }

  const user = await userModel.findById(userId);

  await verificationTokenModel.revokeAllForUser(userId, TOKEN_TYPES.CHANGE_EMAIL);

  await userModel.setPendingEmail(userId, new_email);

  //  1h expiry token
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await verificationTokenModel.create({
    user_id: userId,
    token,
    type: TOKEN_TYPES.CHANGE_EMAIL,
    expires_at: expiresAt,
  });

  await sendEmailChangeEmail(new_email, {
    displayName: user.display_name,
    token,
  });
};

// ============================================================
// Verify Email Change (confirm)
// ============================================================
exports.verifyEmailChange = async ({ token }) => {
  const tokenRow = await verificationTokenModel.findValidToken(token, TOKEN_TYPES.CHANGE_EMAIL);
  if (!tokenRow) {
    throw new AppError('Email change token expired', 422, 'AUTH_TOKEN_EXPIRED');
  }

  const user = await userModel.findById(tokenRow.user_id);

  const conflict = await userModel.findByEmail(user.pending_email);
  if (conflict) {
    throw new AppError('Email already registered', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
  }

  await verificationTokenModel.markUsed(tokenRow.id);
  const updated = await userModel.applyPendingEmail(tokenRow.user_id);

  return { email: updated.email };
};

// ============================================================
// Google OAuth
// ============================================================
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
exports.googleLogin = async ({ id_token }) => {
  // verify the token from google 
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Google token invalid', 401, 'AUTH_TOKEN_INVALID');
  }

  // after
  const { sub: providerUserId, email, given_name, name } = payload;

  // check if this account is already connected with google
  const existingConnection = await oauthConnectionModel.findByProvider('google', providerUserId);

  if (existingConnection) {
    // we need to only update the token 
    const user = await userModel.findById(existingConnection.user_id);

    if (user.is_suspended) {
      throw new AppError('Account suspended by admin', 403, 'AUTH_ACCOUNT_SUSPENDED');
    }

    await oauthConnectionModel.updateTokens({
      user_id: user.id,
      provider: 'google',
      access_token: null,
      refresh_token: null,
      expires_at: null,
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = await createAndStoreRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      is_new_user: false,
      user,
    };
  }

  // checking if the email exists in the normal users
  let user = await userModel.findByEmail(email);
  let is_new_user = false;

  if (!user) {
    user = await userModel.createOAuthUser({
      email,
      display_name: given_name || name || email.split('@')[0],
    });
    is_new_user = true;
  }

  if (user.is_suspended) {
    throw new AppError('Account suspended by admin', 403, 'AUTH_ACCOUNT_SUSPENDED');
  }

  await oauthConnectionModel.create({
    user_id: user.id,
    provider: 'google',
    provider_user_id: providerUserId,
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await createAndStoreRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    is_new_user,
    user,
  };
};