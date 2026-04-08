// ============================================================
// controllers/followdiscovery.controller.js
// ============================================================
const {
  getSuggestedUsers: getSuggestedUsersService,
  getSuggestedArtists: getSuggestedArtistsService,
} = require('../services/followdiscovery.service');

const AppError = require('../utils/app-error');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Parses and clamps pagination params.
 * Default limit 20, max 100.
 */
const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const parsedLimit  = Number.parseInt(query.limit,  10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit:  Number.isFinite(parsedLimit)  ? Math.min(Math.max(parsedLimit,  1), maxLimit)  : defaultLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

// ─────────────────────────────────────────────────────────────
// GET /users/suggested
// ─────────────────────────────────────────────────────────────

/**
 * Returns suggested users to follow.
 *
 * Query params:
 *   limit  — integer 1–100, default 20
 *   offset — integer ≥ 0,   default 0
 */
exports.getSuggestedUsers = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const pagination = parsePagination(req.query);
  const { data, pagination: resultPagination } = await getSuggestedUsersService(userId, pagination);

  return res.status(200).json({
    data,
    pagination: resultPagination,
  });
};

// ─────────────────────────────────────────────────────────────
// GET /users/suggested/artists
// ─────────────────────────────────────────────────────────────

/**
 * Returns suggested artists to follow.
 *
 * Query params:
 *   limit  — integer 1–100, default 20
 *   offset — integer ≥ 0,   default 0
 */
exports.getSuggestedArtists = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const pagination = parsePagination(req.query);
  const { data, pagination: resultPagination } = await getSuggestedArtistsService(userId, pagination);

  return res.status(200).json({
    data,
    pagination: resultPagination,
  });
};