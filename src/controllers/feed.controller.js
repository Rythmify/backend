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
} = require('../services/feed.service');

const AppError = require('../utils/app-error');

const parsePagination = (query) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

const parseAlbumsPagination = (query) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 10,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

exports.getHome = async (req, res) => {
  const userId = req.user?.sub ?? null;
  const data = await getHomeService(userId);

  return res.status(200).json({
    data,
    message: 'Home page data fetched successfully.',
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

  const pagination = parseAlbumsPagination(req.query);
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
