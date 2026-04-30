// ============================================================
// controllers/station.controller.js
// Owner : Omar Hamza (BE-5)
// HTTP layer for station save/unsave and listing
// ============================================================
const {
  likeStation: likeStationService,
  unlikeStation: unlikeStationService,
  getUserSavedStations: getUserSavedStationsService,
} = require('../services/station.service');
const AppError = require('../utils/app-error');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v) => UUID_REGEX.test(v);

const parsePagination = (query, { defaultLimit = 20, maxLimit = 50 } = {}) => {
  const limit = Number.parseInt(query.limit, 10);
  const offset = Number.parseInt(query.offset, 10);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), maxLimit) : defaultLimit,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
};

exports.likeStation = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  const { artist_id } = req.params;
  if (!isValidUuid(artist_id)) throw new AppError('Invalid artist_id.', 400, 'VALIDATION_FAILED');
  const data = await likeStationService(userId, artist_id);
  return res.status(data.is_new ? 201 : 200).json({ data, message: 'Station saved.' });
};

exports.unlikeStation = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  const { artist_id } = req.params;
  if (!isValidUuid(artist_id)) throw new AppError('Invalid artist_id.', 400, 'VALIDATION_FAILED');
  const data = await unlikeStationService(userId, artist_id);
  return res.status(200).json({ data, message: 'Station removed.' });
};

exports.getUserSavedStations = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw new AppError('Authentication required.', 401, 'AUTH_TOKEN_MISSING');
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const { items, total } = await getUserSavedStationsService(userId, pagination);
  return res.status(200).json({
    data: items,
    meta: { limit: pagination.limit, offset: pagination.offset, total },
    message: 'Saved stations fetched successfully.',
  });
};
