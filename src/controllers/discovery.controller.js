// ============================================================
// controllers/discovery.controller.js
// Receives HTTP requests → calls service → returns responses
// ============================================================
const discoveryService = require('../services/discovery.service');
const { success } = require('../utils/api-response');


exports.getRelatedTracks = async (req, res) => {
  const { track_id } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0,  10), 0);

  const data = await discoveryService.getRelatedTracks({ trackId: track_id, limit, offset });

  return success(res, data, 'Related tracks fetched successfully.');
};


exports.getHotForYou = async (req, res) => {
 
  const userId = req.sub || null;

  const data = await discoveryService.getHotForYou({ userId });

  return success(res, data, 'Hot track fetched successfully.');
};


exports.getTrendingByGenre = async (req, res) => {
  const { genre_id } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0,  10), 0);

  const data = await discoveryService.getTrendingByGenre({ genreId: genre_id, limit, offset });

  return success(res, data, 'Trending tracks fetched successfully.');
};


exports.getGenreTracks = async (req, res) => {
  const { genre_id } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0,  10), 0);
  const sort   = ['newest', 'popular'].includes(req.query.sort) ? req.query.sort : 'newest';

  const data = await discoveryService.getGenreTracks({ genreId: genre_id, limit, offset, sort });

  return success(res, data, 'Tracks fetched successfully.');
};


exports.getGenreAlbums = async (req, res) => {
  const { genre_id } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || 12, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0,  10), 0);

  const data = await discoveryService.getGenreAlbums({ genreId: genre_id, limit, offset });

  return success(res, data, 'Albums fetched successfully.');
};


exports.getGenrePlaylists = async (req, res) => {
  const { genre_id } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || 12, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0,  10), 0);

  const data = await discoveryService.getGenrePlaylists({ genreId: genre_id, limit, offset });

  return success(res, data, 'Playlists fetched successfully.');
};

exports.getGenreArtists = async (req, res) => {
  const { genre_id } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || 10, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0,  10), 0);

  const data = await discoveryService.getGenreArtists({ genreId: genre_id, limit, offset });

  return success(res, data, 'Artists fetched successfully.');
};

