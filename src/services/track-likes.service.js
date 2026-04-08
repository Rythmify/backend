// ============================================================
// services/track-likes.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const trackLikeModel = require('../models/track-like.model');
const AppError = require('../utils/app-error');

/**
 * Get paginated list of users who liked a track
 * Includes user profile information
 */
exports.getTrackLikers = async (trackId, limit = 20, offset = 0) => {
  // Validate inputs
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  if (limit < 1 || limit > 100) {
    limit = 20; // Default
  }
  if (offset < 0) {
    offset = 0;
  }

  return await trackLikeModel.getTrackLikers(trackId, limit, offset);
};

/**
 * Like a track (idempotent operation)
 * Returns:
 *   - 201: Track newly liked
 *   - 200: Already liked (no change)
 */
exports.likeTrack = async (userId, trackId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to like track
  const { created, like } = await trackLikeModel.likeTrack(userId, trackId);

  return {
    likeId: like.id,
    userId: like.user_id,
    trackId: like.track_id,
    createdAt: like.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Unlike a track (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.unlikeTrack = async (userId, trackId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to unlike track
  const deleted = await trackLikeModel.unlikeTrack(userId, trackId);

  if (!deleted) {
    throw new AppError('Like not found', 404, 'LIKE_NOT_FOUND');
  }

  return true;
};

/**
 * Get user's liked tracks (for /me/liked-tracks endpoint)
 */
exports.getUserLikedTracks = async (userId, limit = 20, offset = 0) => {
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

  return await trackLikeModel.getUserLikedTracks(userId, limit, offset);
};

/**
 * Check if user likes a track (used for response decoration)
 */
exports.isTrackLikedByUser = async (userId, trackId) => {
  if (!userId) return false;
  return await trackLikeModel.isTrackLikedByUser(userId, trackId);
};

/**
 * Get total like count for a track
 */
exports.getTrackLikeCount = async (trackId) => {
  if (!trackId) return 0;
  return await trackLikeModel.getTrackLikeCount(trackId);
};
