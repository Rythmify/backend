const bcrypt                 = require('bcryptjs');
const userModel              = require('../models/user.model');
const verificationTokenModel = require('../models/verification-token.model');
const { generateSecureToken }= require('../utils/token-generator');
const { sendVerificationEmail } = require('../utils/mailer');
const AppError               = require('../utils/app-error');
const env                    = require('../config/env');

// CAPTCHA verification 
const verifyCaptcha = async (captchaToken) => {
  if (!env.RECAPTCHA_SECRET) {
    console.warn('[CAPTCHA] Skipping — RECAPTCHA_SECRET not set');
    return;
  }
  const res  = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${env.RECAPTCHA_SECRET}&response=${captchaToken}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.success || data.score < 0.5) {
    throw new AppError('CAPTCHA verification failed', 400, 'CAPTCHA_FAILED');
  }
};

// Register
exports.register = async ({ email, password, display_name, gender, date_of_birth, captcha_token }) => {
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
  const token     = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await verificationTokenModel.create({
    user_id:    user.id,
    token,
    type:       'verify_email',
    expires_at: expiresAt,
  });

  // Send verification email
  await sendVerificationEmail(email, {
    displayName: display_name,
    token,
  });

  // Return 
  return {
    user_id:      user.id,
    email:        user.email,
    display_name: user.display_name,
    gender:       user.gender,
    role:         user.role,
    is_verified:  user.is_verified,
    date_of_birth: user.date_of_birth,
    created_at:   user.created_at,
  };
};