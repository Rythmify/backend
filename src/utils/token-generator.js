// ============================================================
// utils/token-generator.js
// Signed token generation for email verify / password reset flows
// ============================================================
const crypto = require('crypto');

const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

module.exports = { generateSecureToken };
