// ============================================================
// controllers/genres.controller.js
// ============================================================
const genresService = require('../services/genres.service');

const parsePagination = (query) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

const getAllGenres = async (req, res) => {
  const pagination = parsePagination(req.query);
  const data = await genresService.getAllGenres(pagination);

  return res.status(200).json(data);
};

module.exports = {
  getAllGenres,
};
