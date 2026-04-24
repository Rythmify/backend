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
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const { deriveUsernameCandidate, appendSuffix } = require('../utils/username-generator');
const { saveState, validateAndDeleteState } = require('../utils/oauth-state-store');

//=====================================
// Registration and Email verification
//=====================================

// CAPTCHA verification
const verifyCaptcha = async (captchaToken, platform = 'web') => {
  if (!env.RECAPTCHA_SECRET) {
    console.warn('[CAPTCHA] Skipping — RECAPTCHA_SECRET not set');
    return;
  }
  if (platform === 'mobile') {
    console.warn('handling recaptcha verification on mobile');
    return;
  }
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${env.RECAPTCHA_SECRET}&response=${captchaToken}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.success || data.score < 0.5) {
    throw new AppError(JSON.stringify(data), 400, 'CAPTCHA_FAILED');
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
  platform = 'web',
}) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new AppError('Email is required', 400, 'VALIDATION_FAILED');
  }
  const displayNameTrimmed = display_name?.trim();
  // Verify CAPTCHA i can't get a token to test with it now so imma comment it out for now :)
  await verifyCaptcha(captcha_token, platform);

  // Check duplicate email
  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError('Email already registered', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
  }

  // Hash password
  const password_hashed = await bcrypt.hash(password, 12);

  const candidate = deriveUsernameCandidate(normalizedEmail);
  let username = candidate;
  let suffix = 1;

  while (await userModel.isUsernameTaken(username)) {
    username = appendSuffix(candidate, suffix);
    suffix += 1;
    if (suffix > 9999) {
      // Extremely unlikely, but bail out safely rather than looping forever
      username = appendSuffix(candidate, Date.now().toString().slice(-6));
      break;
    }
  }

  // Create user
  const user = await userModel.create({
    email: normalizedEmail,
    password_hashed,
    display_name: displayNameTrimmed,
    gender,
    date_of_birth,
    username,
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
    username: user.username,
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
  const refreshToken = signRefreshToken({
    sub: userId,
    jti: randomUUID(),
  });

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

  // Generate new token before transaction
  const newRefreshToken = signRefreshToken({ sub: user.id, jti: randomUUID() });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Atomic revoke old + insert new — prevents concurrent request collision
  const result = await refreshTokenModel.rotateToken({
    oldToken: refresh_token,
    userId: user.id,
    newToken: newRefreshToken,
    expiresAt,
  });

  if (!result) {
    throw new AppError('Refresh token already used', 401, 'AUTH_REFRESH_TOKEN_INVALID');
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });

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
exports.resendVerification = async ({ email, captcha_token, platform = 'web' }) => {
  await verifyCaptcha(captcha_token, platform); //uncomment upon integration with frontend

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
    const candidate = deriveUsernameCandidate(email);
    let username = candidate;
    let suffix = 1;

    while (await userModel.isUsernameTaken(username)) {
      username = appendSuffix(candidate, suffix);
      suffix += 1;
      if (suffix > 9999) {
        // Extremely unlikely, but bail out safely rather than looping forever
        username = appendSuffix(candidate, Date.now().toString().slice(-6));
        break;
      }
    }
    user = await userModel.createOAuthUser({
      email,
      display_name: given_name || name || email.split('@')[0],
      username,
    });
    is_new_user = true;
    console.log('[Google OAuth] User stored to DB:', user);
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

/**
 * Generates the GitHub authorization URL + a CSRF state token.
 *
 * Called by: GET /auth/oauth/github
 * The controller stores `state` in a short-lived httpOnly cookie,
 * then redirects the user to the returned `authUrl`.
 */
exports.githubGetAuthUrl = () => {
  const state = crypto.randomBytes(16).toString('hex');

  saveState(state);

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state,
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return { authUrl, state };
};

// ============================================================
// GitHub OAuth — Step 2: Handle the callback
// ============================================================

exports.githubCallback = async ({ code, state }) => {
  const isValid = validateAndDeleteState(state);
  if (!isValid) {
    throw new AppError('Missing or invalid OAuth callback parameters', 400, 'VALIDATION_FAILED');
  }

  let ghAccessToken;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('[GitHub] Token exchange failed:', tokenData);
      throw new Error('Token exchange failed');
    }

    ghAccessToken = tokenData.access_token;
  } catch {
    throw new AppError(
      'OAuth authorization was denied or token exchange failed',
      422,
      'BUSINESS_OPERATION_NOT_ALLOWED'
    );
  }

  let ghProfile;
  try {
    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${ghAccessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!profileRes.ok) throw new Error('Profile fetch failed');
    ghProfile = await profileRes.json();
  } catch {
    throw new AppError(
      'OAuth authorization was denied or token exchange failed',
      422,
      'BUSINESS_OPERATION_NOT_ALLOWED'
    );
  }

  let primaryEmail = ghProfile.email;

  if (!primaryEmail) {
    try {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${ghAccessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const emails = await emailsRes.json();
      // Find the primary verified email
      const primary = emails.find((e) => e.primary && e.verified);
      primaryEmail = primary?.email ?? null;
    } catch {
      // Non-fatal — we'll proceed with null email
      primaryEmail = null;
    }
  }

  const providerUserId = String(ghProfile.id); // GitHub user ID as string
  const displayName = ghProfile.name || ghProfile.login || `gh_user_${providerUserId}`;

  const existingConnection = await oauthConnectionModel.findByProvider('github', providerUserId);

  if (existingConnection) {
    const user = await userModel.findById(existingConnection.user_id);

    if (user.is_suspended) {
      throw new AppError('Account suspended by admin', 403, 'AUTH_ACCOUNT_SUSPENDED');
    }

    await oauthConnectionModel.updateTokens({
      user_id: user.id,
      provider: 'github',
      access_token: ghAccessToken,
      refresh_token: null,
      expires_at: null, // GitHub tokens don't expire unless revoked
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = await createAndStoreRefreshToken(user.id);

    return { accessToken, refreshToken, is_new_user: false, user };
  }

  let user = primaryEmail ? await userModel.findByEmail(primaryEmail) : null;
  let is_new_user = false;
  const candidate = deriveUsernameCandidate(primaryEmail);
  let username = candidate;
  let suffix = 1;

  while (await userModel.isUsernameTaken(username)) {
    username = appendSuffix(candidate, suffix);
    suffix += 1;
    if (suffix > 9999) {
      // Extremely unlikely, but bail out safely rather than looping forever
      username = appendSuffix(candidate, Date.now().toString().slice(-6));
      break;
    }
  }
  if (!user) {
    user = await userModel.createOAuthUser({
      email: primaryEmail ?? null,
      display_name: displayName,
      username,
    });
    is_new_user = true;
  }

  if (user.is_suspended) {
    throw new AppError('Account suspended by admin', 403, 'AUTH_ACCOUNT_SUSPENDED');
  }

  await oauthConnectionModel.create({
    user_id: user.id,
    provider: 'github',
    provider_user_id: providerUserId,
    access_token: ghAccessToken,
    refresh_token: null,
    expires_at: null,
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await createAndStoreRefreshToken(user.id);

  return { accessToken, refreshToken, is_new_user, user };
};

// ============================================================
// Delete Account (soft delete)
// ============================================================
exports.deleteAccount = async ({ userId, password }) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'AUTH_USER_NOT_FOUND');
  }

  // OAuth-only users have no password — skip check
  if (user.password_hashed) {
    const valid = await bcrypt.compare(password, user.password_hashed);
    if (!valid) {
      throw new AppError('Invalid password', 401, 'AUTH_INVALID_CREDENTIALS');
    }
  }

  // Soft delete content + user + revoke all sessions — all in one transaction
  await userModel.softDeleteWithContent(userId);

  // Revoke all refresh tokens — kills all active sessions immediately
  await refreshTokenModel.revokeAllForUser(userId);
};