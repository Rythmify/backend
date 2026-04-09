// ============================================================
// services/genres.service.js
// ============================================================
const genreModel = require('../models/genre.model');

const getAllGenres = async ({ limit, offset }) => {
  const genres = await genreModel.getAllGenres();
  const total = genres.length;

  return {
    data: genres.slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total,
    },
  };
};

module.exports = {
  getAllGenres,
};
