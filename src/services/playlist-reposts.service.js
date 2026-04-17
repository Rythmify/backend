// ============================================================
// services/playlist-reposts.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const playlistRepostModel = require('../models/playlist-repost.model');
const AppError = require('../utils/app-error');

/**
 * Get paginated list of users who reposted a playlist
 * Includes user profile information
 */
exports.getPlaylistReposters = async (playlistId, limit = 20, offset = 0) => {
  // Validate inputs
  if (!playlistId || playlistId.trim() === '') {
    throw new AppError('Playlist ID is required', 400, 'INVALID_REQUEST');
  }

  if (limit < 1 || limit > 100) {
    limit = 20; // Default
  }
  if (offset < 0) {
    offset = 0;
  }

  return await playlistRepostModel.getPlaylistReposters(playlistId, limit, offset);
};

/**
 * Repost a playlist (idempotent operation)
 * Business rules:
 *   - User cannot repost their own playlist
 * Returns:
 *   - 201: Playlist newly reposted
 *   - 200: Already reposted (no change)
 */
exports.repostPlaylist = async (userId, playlistId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!playlistId || playlistId.trim() === '') {
    throw new AppError('Playlist ID is required', 400, 'INVALID_REQUEST');
  }

  // Check if user is trying to repost their own playlist
  const playlistOwner = await playlistRepostModel.getPlaylistOwner(playlistId);
  if (playlistOwner === userId) {
    throw new AppError('Cannot repost your own playlist', 400, 'CANNOT_REPOST_OWN_PLAYLIST');
  }

  // Attempt to repost playlist
  const { created, repost } = await playlistRepostModel.repostPlaylist(userId, playlistId);

  return {
    repostId: repost.id,
    userId: repost.user_id,
    playlistId: repost.playlist_id,
    createdAt: repost.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Remove a repost from a playlist (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.removeRepost = async (userId, playlistId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!playlistId || playlistId.trim() === '') {
    throw new AppError('Playlist ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to remove repost
  const deleted = await playlistRepostModel.removeRepost(userId, playlistId);

  if (!deleted) {
    throw new AppError('Repost not found', 404, 'REPOST_NOT_FOUND');
  }

  return true;
};

/**
 * Get user's reposted playlists (for /me/reposted-playlists endpoint)
 */
exports.getUserRepostedPlaylists = async (userId, limit = 20, offset = 0) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }

  if (limit < 1 || limit > 100) {
    limit = 20;
  }
  if (offset < 0) {
    offset = 0;
  }

  return await playlistRepostModel.getUserRepostedPlaylists(userId, limit, offset);
};

/**
 * Check if user has reposted a playlist (used for response decoration)
 */
exports.isPlaylistRepostedByUser = async (userId, playlistId) => {
  if (!userId) return false;
  return await playlistRepostModel.isPlaylistRepostedByUser(userId, playlistId);
};

/**
 * Get total repost count for a playlist
 */
exports.getPlaylistRepostCount = async (playlistId) => {
  if (!playlistId) return 0;
  return await playlistRepostModel.getPlaylistRepostCount(playlistId);
};
