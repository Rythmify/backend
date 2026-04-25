// ============================================================
// services/station.service.js
// Owner : Omar Hamza (BE-5)
// Business logic for artist station save/unsave
// ============================================================
const stationModel = require('../models/station.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

async function likeStation(userId, artistId) {
  const artist = await userModel.findById(artistId);
  if (!artist || artist.deleted_at) {
    throw new AppError('Artist not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { created, station } = await stationModel.saveStation(userId, artistId);
  return {
    station_id: station.id,
    artist_id: artistId,
    artist_name: artist.display_name,
    is_new: created,
  };
}

async function unlikeStation(userId, artistId) {
  const deleted = await stationModel.unsaveStation(userId, artistId);
  return { unliked: deleted };
}

async function getUserSavedStations(userId, pagination) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('User not found.', 404, 'RESOURCE_NOT_FOUND');

  const { limit, offset } = pagination;
  return stationModel.getUserSavedStations(userId, limit, offset);
}

module.exports = { likeStation, unlikeStation, getUserSavedStations };
