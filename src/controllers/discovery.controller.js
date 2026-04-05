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