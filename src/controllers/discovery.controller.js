// ============================================================
// controllers/discovery.controller.js
// Receives HTTP requests → calls service → returns responses
// ============================================================
const discoveryService = require('../services/discovery.service');
const { success } = require('../utils/api-response');

exports.getRelatedTracks = async (req, res) => {
  const { track_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await discoveryService.getRelatedTracks({ trackId: track_id, limit, offset });

  return success(res, data, 'Related tracks fetched successfully.', 200, pagination);
};


exports.getTrendingByGenre = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await discoveryService.getTrendingByGenre({ genreId: genre_id, limit, offset });

  return success(res, data, 'Trending tracks fetched successfully.', 200, pagination);
};

exports.getGenrePage = async (req, res) => {
  const { genre_id } = req.params;

  const tracksLimit = Math.min(parseInt(req.query.tracks_limit || 12, 10), 50);
  const artistsLimit = Math.min(parseInt(req.query.artists_limit || 12, 10), 20);
  const playlistsLimit = Math.min(parseInt(req.query.playlists_limit || 4, 10), 20);
  const albumsLimit = Math.min(parseInt(req.query.albums_limit || 4, 10), 20);

  const data = await discoveryService.getGenrePage({
    genreId: genre_id,
    tracksLimit,
    artistsLimit,
    playlistsLimit,
    albumsLimit,
    currentUserId: req.sub || null,
  });

  return success(res, data, 'Genre page data fetched successfully.');
};

exports.getGenreTracks = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);
  const sort = ['newest', 'popular'].includes(req.query.sort) ? req.query.sort : 'newest';

  const { pagination, ...data } = await discoveryService.getGenreTracks({ genreId: genre_id, limit, offset, sort });
  return success(res, data, 'Tracks fetched successfully.', 200, pagination);
};

exports.getGenreAlbums = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 12, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await discoveryService.getGenreAlbums({ genreId: genre_id, limit, offset });

  return success(res, data, 'Albums fetched successfully.', 200, pagination);
};

exports.getGenrePlaylists = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 12, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await discoveryService.getGenrePlaylists({ genreId: genre_id, limit, offset });

  return success(res, data, 'Playlists fetched successfully.', 200, pagination);
};

exports.getGenreArtists = async (req, res) => {
  const { genre_id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || 10, 10), 20);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

  const { pagination, ...data } = await discoveryService.getGenreArtists({
    genreId: genre_id,
    limit,
    offset,
    currentUserId: req.sub || null,
  });

  return success(res, data, 'Artists fetched successfully.', 200, pagination);
};
