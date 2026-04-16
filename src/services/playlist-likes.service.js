// ============================================================
// services/playlist-likes.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const playlistLikeModel = require('../models/playlist-like.model');
const notificationModel = require('../models/notification.model');
const AppError = require('../utils/app-error');

/**
 * Get paginated list of users who liked a playlist
 * Includes user profile information
 */
exports.getPlaylistLikers = async (playlistId, limit = 20, offset = 0) => {
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

  return await playlistLikeModel.getPlaylistLikers(playlistId, limit, offset);
};

/**
 * Like a playlist (idempotent operation)
 * Returns:
 *   - 201: Playlist newly liked
 *   - 200: Already liked (no change)
 */
exports.likePlaylist = async (userId, playlistId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!playlistId || playlistId.trim() === '') {
    throw new AppError('Playlist ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to like playlist
  const { created, like } = await playlistLikeModel.likePlaylist(userId, playlistId);

  await notifyPlaylistLikeIfNeeded({ created, userId, playlistId });

  return {
    likeId: like.id,
    userId: like.user_id,
    playlistId: like.playlist_id,
    createdAt: like.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Unlike a playlist (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.unlikePlaylist = async (userId, playlistId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!playlistId || playlistId.trim() === '') {
    throw new AppError('Playlist ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to unlike playlist
  const deleted = await playlistLikeModel.unlikePlaylist(userId, playlistId);

  if (!deleted) {
    throw new AppError('Like not found', 404, 'LIKE_NOT_FOUND');
  }

  return true;
};

/**
 * Get user's liked playlists (for /me/liked-playlists endpoint)
 */
exports.getUserLikedPlaylists = async (userId, limit = 20, offset = 0) => {
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

  return await playlistLikeModel.getUserLikedPlaylists(userId, limit, offset);
};

/**
 * Check if user likes a playlist (used for response decoration)
 */
exports.isPlaylistLikedByUser = async (userId, playlistId) => {
  if (!userId) return false;
  return await playlistLikeModel.isPlaylistLikedByUser(userId, playlistId);
};

/**
 * Get total like count for a playlist
 */
exports.getPlaylistLikeCount = async (playlistId) => {
  if (!playlistId) return 0;
  return await playlistLikeModel.getPlaylistLikeCount(playlistId);
};

async function notifyPlaylistLikeIfNeeded({ created, userId, playlistId }) {
  if (!created) return;

  const ownerId = await notificationModel.getPlaylistOwnerId(playlistId);
  if (!ownerId || ownerId === userId) return;

  await notificationModel.createNotification({
    userId: ownerId,
    actionUserId: userId,
    type: 'like',
    referenceId: playlistId,
    referenceType: 'playlist',
  });
}
