// ============================================================
// controllers/feed.controller.js
// Owner : Omar Hamza (BE-5)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const {
  getHome: getHomeService,
  getMoreOfWhatYouLike: getMoreOfWhatYouLikeService,
  getAlbumsForYou: getAlbumsForYouService,
  getDailyMix: getDailyMixService,
  getWeeklyMix: getWeeklyMixService,
  getMixById: getMixByIdService,
  getTrendingByGenre: getTrendingByGenreService,
  getHotForYou: getHotForYouService,
  listStations: listStationsService,
  getStationTracks: getStationTracksService,
  getArtistsToWatch: getArtistsToWatchService,
} = require('../services/feed.service');

const AppError = require('../utils/app-error');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Parses and clamps pagination params for standard track/user lists.
 * Default limit 20, max 50.
 */
const parsePagination = (query, { defaultLimit = 20, maxLimit = 50 } = {}) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), maxLimit)
      : defaultLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

/**
 * Validates UUID-shaped identifiers used in this codebase.
 * We do not enforce RFC UUID version/variant bits.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (value) => UUID_REGEX.test(value);

// ─────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────

exports.getHome = async (req, res) => {
  const userId = req.user?.sub ?? null;
  const data = await getHomeService(userId);

  return res.status(200).json({
    data,
    message: 'Home page data fetched successfully.',
  });
};

exports.getHotForYou = async (req, res) => {
  const userId = req.user?.sub ?? null;
  const data = await getHotForYouService(userId);

  return res.status(200).json({
    data,
    message: 'Hot for you track fetched successfully.',
  });
};

exports.getTrendingByGenre = async (req, res) => {
  const { genre_id } = req.params;
  const userId = req.user?.sub ?? null;

  if (!isValidUuid(genre_id)) {
    throw new AppError('Invalid genre_id format.', 400, 'VALIDATION_FAILED');
  }

  const pagination = parsePagination(req.query);
  const data = await getTrendingByGenreService(genre_id, pagination, userId);

  return res.status(200).json({
    data,
    message: 'Trending tracks for genre fetched successfully.',
  });
};

exports.getMoreOfWhatYouLike = async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const pagination = parsePagination(req.query);
  const {
    data,
    source,
    pagination: resultPagination,
  } = await getMoreOfWhatYouLikeService(userId, pagination);

  return res.status(200).json({
    data,
    source,
    pagination: resultPagination,
  });
};

exports.getAlbumsForYou = async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 20 });
  const {
    data,
    source,
    pagination: resultPagination,
  } = await getAlbumsForYouService(userId, pagination);

  return res.status(200).json({
    data,
    source,
    pagination: resultPagination,
  });
};

exports.getDailyMix = async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const data = await getDailyMixService(userId);

  return res.status(200).json({ data });
};

exports.getWeeklyMix = async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const data = await getWeeklyMixService(userId);

  return res.status(200).json({ data });
};

exports.getMixById = async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  }

  const { mixId } = req.params;
  const data = await getMixByIdService(userId, mixId);

  return res.status(200).json({ data });
};

exports.listStations = async (req, res) => {
  const userId = req.user?.sub ?? null;
  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 20 });
  const { data, pagination: resultPagination } = await listStationsService(pagination, userId);

  return res.status(200).json({
    data,
    pagination: resultPagination,
  });
};

exports.getStationTracks = async (req, res) => {
  const { artist_id } = req.params;
  const userId = req.user?.sub ?? null;

  if (!isValidUuid(artist_id)) {
    throw new AppError('Invalid artist_id format.', 400, 'VALIDATION_FAILED');
  }

  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const {
    station,
    data,
    pagination: resultPagination,
  } = await getStationTracksService(artist_id, pagination, userId);

  return res.status(200).json({
    station,
    data,
    pagination: resultPagination,
  });
};

exports.getArtistsToWatch = async (req, res) => {
  const userId = req.user?.sub ?? null;
  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 20 });
  const { data, pagination: resultPagination } = await getArtistsToWatchService(pagination, userId);

  return res.status(200).json({
    data,
    pagination: resultPagination,
  });
};
