// ============================================================
// utils/token-generator.js
// Signed token generation for email verify / password reset flows
// ============================================================
const crypto = require('crypto');

const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

const parseDurationToSeconds = (duration) => {
  if (!duration) return 900;
  const match = /^([0-9]+)([smhd])$/.exec(duration.trim());
  if (!match) return 900;

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] || 1);
};

module.exports = { generateSecureToken, parseDurationToSeconds };
