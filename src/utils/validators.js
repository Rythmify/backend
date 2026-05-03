// ============================================================
// utils/validators.js — Shared input validation helpers
// ============================================================

const GENDER_TYPES = require('../constants/gender-types');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
const isValidPassword = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);

// display_name: 1–50 chars, not empty
const isValidDisplayName = (name) =>
  typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 50;

// date_of_birth: valid date, user must be at least 13 years old
const isValidDateOfBirth = (dob) => {
  const date = new Date(dob);
  if (isNaN(date.getTime())) return false;
  const ageDiff = Date.now() - date.getTime();
  const age = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
  return age >= 13;
};

// gender: must match your DB enum
const isValidGender = (gender) => Object.values(GENDER_TYPES).includes(gender);

module.exports = {
  isValidEmail,
  isValidUrl,
  isValidPassword,
  isValidDisplayName,
  isValidDateOfBirth,
  isValidGender,
};
