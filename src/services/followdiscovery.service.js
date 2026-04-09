// ============================================================
// services/followdiscovery.service.js
// ============================================================
const {
  getMutualFollowSuggestions,
  getArtistsByUserGenres,
} = require('../models/followdiscovery.model');

const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

async function ensureUserExists(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, 'RESOURCE_NOT_FOUND');
  }
}

// ─────────────────────────────────────────────────────────────
// getSuggestedUsers
// ─────────────────────────────────────────────────────────────

async function getSuggestedUsers(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const { items, total } = await getMutualFollowSuggestions(userId, limit, offset);

  return {
    data: items,
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// getSuggestedArtists
// ─────────────────────────────────────────────────────────────

async function getSuggestedArtists(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const { items, total } = await getArtistsByUserGenres(userId, limit, offset);

  return {
    data: items,
    pagination: { limit, offset, total },
  };
}

module.exports = {
  getSuggestedUsers,
  getSuggestedArtists,
};
