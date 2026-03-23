// ============================================================
// services/genres.service.js
// ============================================================
const genreModel = require('../models/genre.model');

const getAllGenres = async () => {
  const genres = await genreModel.getAllGenres();

  return {
    items: genres,
  };
};

module.exports = {
  getAllGenres,
};