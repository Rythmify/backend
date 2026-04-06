const {
  getSuggestedUsers: getSuggestedUsersService,
  getSuggestedArtists: getSuggestedArtistsService,
} = require('../services/followdiscovery.service');
const AppError = require('../utils/app-error');

const parsePagination = (query) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20,
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
 *
 * Response: SuggestedUsersResponse (spec §SuggestedUser)
 */
exports.getSuggestedUsers = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
    }

    const pagination = parsePagination(req.query);
    const { data, pagination: resultPagination } = await getSuggestedUsersService(
      userId,
      pagination
    );

    return res.status(200).json({
      data,
      pagination: resultPagination,
    });
  } catch (err) {
    next(err);
  }
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
 *
 * Response: SuggestedArtistsResponse (spec §SuggestedArtist)
 */
exports.getSuggestedArtists = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
    }

    const pagination = parsePagination(req.query);
    const { data, pagination: resultPagination } = await getSuggestedArtistsService(
      userId,
      pagination
    );

    return res.status(200).json({
      data,
      pagination: resultPagination,
    });
  } catch (err) {
    next(err);
  }
};
