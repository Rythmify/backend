const { getMutualFollowSuggestions, getArtistsByUserGenres } = require('../models/followdiscovery');
const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

async function ensureUserExists(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, 'RESOURCE_NOT_FOUND');
  }
}

// ─────────────────────────────────────────────────────────────
// GET /users/suggested
// ─────────────────────────────────────────────────────────────

/**
 * Returns suggested users to follow.
 *
 * Priority and fallback are implemented in the model SQL query:
 *   1. Mutual follows
 *   2. Popular users fallback
 */
async function getSuggestedUsers(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const { items, total } = await getMutualFollowSuggestions(userId, limit, offset);

  return {
    data: items,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// GET /users/suggested/artists
// ─────────────────────────────────────────────────────────────

/**
 * Returns suggested artists to follow, driven by the user's liked-track genres.
 *
 * Priority and fallback are implemented in the model SQL query:
 *   1. Artists in the user's liked-track genres
 *   2. Popular artists fallback
 */
async function getSuggestedArtists(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const { items, total } = await getArtistsByUserGenres(userId, limit, offset);

  return {
    data: items,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}

module.exports = {
  getSuggestedUsers,
  getSuggestedArtists,
};
