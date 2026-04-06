// ============================================================
// utils/username-generator.js
// Derives a unique username from an email's local part.
// Pattern: ^[a-z0-9_-]+$  |  minLength: 3  |  maxLength: 30
// ============================================================

const deriveUsernameCandidate = (email) => {
  const localPart = email.split('@')[0];

  let candidate = localPart
    .toLowerCase()
    .replace(/\./g, '_')                // dots → underscores
    .replace(/[^a-z0-9_-]/g, '')        // strip invalid chars
    .slice(0, 30);                       // enforce max length

  // Ensure minimum length of 3
  while (candidate.length < 3) {
    candidate += Math.floor(Math.random() * 10);
  }

  return candidate;
};

const appendSuffix = (base, suffix) => {
  const suffixStr = String(suffix);
  const truncatedBase = base.slice(0, 30 - suffixStr.length);
  return `${truncatedBase}${suffixStr}`;
};

module.exports = { deriveUsernameCandidate, appendSuffix };