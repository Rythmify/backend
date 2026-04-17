// ============================================================
// services/track-reposts.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const trackRepostModel = require('../models/track-repost.model');
const AppError = require('../utils/app-error');

/**
 * Get paginated list of users who reposted a track
 * Includes user profile information
 */
exports.getTrackReposters = async (trackId, limit = 20, offset = 0) => {
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

  return await trackRepostModel.getTrackReposters(trackId, limit, offset);
};

/**
 * Repost a track (idempotent operation)
 * Business rules:
 *   - User cannot repost their own track
 * Returns:
 *   - 201: Track newly reposted
 *   - 200: Already reposted (no change)
 */
exports.repostTrack = async (userId, trackId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  // Check if user is trying to repost their own track
  const trackOwner = await trackRepostModel.getTrackOwner(trackId);
  if (trackOwner === userId) {
    throw new AppError('Cannot repost your own track', 400, 'CANNOT_REPOST_OWN_TRACK');
  }

  // Attempt to repost track
  const { created, repost } = await trackRepostModel.repostTrack(userId, trackId);

  return {
    repostId: repost.id,
    userId: repost.user_id,
    trackId: repost.track_id,
    createdAt: repost.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Remove a repost from a track (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.removeRepost = async (userId, trackId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to remove repost
  const deleted = await trackRepostModel.removeRepost(userId, trackId);

  if (!deleted) {
    throw new AppError('Repost not found', 404, 'REPOST_NOT_FOUND');
  }

  return true;
};

/**
 * Get user's reposted tracks (for /me/reposted-tracks endpoint)
 */
exports.getUserRepostedTracks = async (userId, limit = 20, offset = 0) => {
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

  return await trackRepostModel.getUserRepostedTracks(userId, limit, offset);
};

/**
 * Check if user has reposted a track (used for response decoration)
 */
exports.isTrackRepostedByUser = async (userId, trackId) => {
  if (!userId) return false;
  return await trackRepostModel.isTrackRepostedByUser(userId, trackId);
};

/**
 * Get total repost count for a track
 */
exports.getTrackRepostCount = async (trackId) => {
  if (!trackId) return 0;
  return await trackRepostModel.getTrackRepostCount(trackId);
};
