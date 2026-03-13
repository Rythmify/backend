const bcrypt = require('bcryptjs');
const userModel = require('../models/user.model');
const verificationTokenModel = require('../models/verification-token.model');
const refreshTokenModel = require('../models/refresh-token.model');
const { generateSecureToken, parseDurationToSeconds } = require('../utils/token-generator');
const { sendVerificationEmail } = require('../utils/mailer');
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
  // Verify CAPTCHA i can't get a token to test with it now so imma comment it out for now :)
  //await verifyCaptcha(captcha_token);

  // Check duplicate email
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new AppError('Email already registered', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
  }

  // Hash password
  const password_hashed = await bcrypt.hash(password, 12);

  // Create user
  const user = await userModel.create({
    email,
    password_hashed,
    display_name,
    gender,
    date_of_birth,
  });

  // Create verification token — 24h expiry
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await verificationTokenModel.create({
    user_id: user.id,
    token,
    type: 'verify_email',
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
  const user = await userModel.findByEmailOrUsername(identifier);

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
  const tokenRow = await verificationTokenModel.findValidToken(token, 'verify_email');
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