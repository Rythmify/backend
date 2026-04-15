// ============================================================
// controllers/genres.controller.js
// ============================================================
const genresService = require('../services/genres.service');
const { success } = require('../utils/api-response');

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


const getGenrePage = async (req, res) => {
  const { genre_id } = req.params;

  const tracksLimit = Math.min(parseInt(req.query.tracks_limit || 12, 10), 50);
  const artistsLimit = Math.min(parseInt(req.query.artists_limit || 12, 10), 20);
  const playlistsLimit = Math.min(parseInt(req.query.playlists_limit || 4, 10), 20);
  const albumsLimit = Math.min(parseInt(req.query.albums_limit || 4, 10), 20);

  const data = await genresService.getGenrePage({
    genreId: genre_id,
    tracksLimit,
    artistsLimit,
    playlistsLimit,
    albumsLimit,
    currentUserId: req.user?.id || null,
  });

  return success(res, data, 'Genre page data fetched successfully.');
};

const getGenreTracks = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);
  const sort = ['newest', 'popular'].includes(req.query.sort) ? req.query.sort : 'newest';

  const { pagination, ...data } = await genresService.getGenreTracks({
    genreId: genre_id,
    limit,
    offset,
    sort,
  });
  return success(res, data, 'Tracks fetched successfully.', 200, pagination);
};

const getGenreAlbums = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 12, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await genresService.getGenreAlbums({
    genreId: genre_id,
    limit,
    offset,
  });

  return success(res, data, 'Albums fetched successfully.', 200, pagination);
};

const getGenrePlaylists = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 12, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await genresService.getGenrePlaylists({
    genreId: genre_id,
    limit,
    offset,
  });

  return success(res, data, 'Playlists fetched successfully.', 200, pagination);
};

const getGenreArtists = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 10, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await genresService.getGenreArtists({
    genreId: genre_id,
    limit,
    offset,
    currentUserId: req.user?.id || null,
  });

  return success(res, data, 'Artists fetched successfully.', 200, pagination);
};


module.exports = {
  getAllGenres,
  getGenrePage,
  getGenreTracks,
  getGenreAlbums,
  getGenrePlaylists,
  getGenreArtists,
};
