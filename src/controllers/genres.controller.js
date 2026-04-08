// ============================================================
// controllers/genres.controller.js
// ============================================================
const { success } = require('../utils/api-response');
const genresService = require('../services/genres.service');

const getAllGenres = async (req, res) => {
  const data = await genresService.getAllGenres();

  return success(res, data, 'Genres fetched successfully', 200);
};

module.exports = {
  getAllGenres,
};
