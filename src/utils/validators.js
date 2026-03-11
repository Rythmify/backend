// ============================================================
// utils/validators.js — Shared input validation helpers
// ============================================================
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidUrl = (url) => {
  try { new URL(url); return true; } catch { return false; }
};

module.exports = { isValidEmail, isValidUrl };
