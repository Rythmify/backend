// ============================================================
// services/album-reposts.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const albumRepostModel = require('../models/album-repost.model');
const AppError = require('../utils/app-error');

/**
 * Get paginated list of users who reposted an album
 * Includes user profile information
 */
exports.getAlbumReposters = async (albumId, limit = 20, offset = 0) => {
  // Validate inputs
  if (!albumId || albumId.trim() === '') {
    throw new AppError('Album ID is required', 400, 'INVALID_REQUEST');
  }

  if (limit < 1 || limit > 100) {
    limit = 20; // Default
  }
  if (offset < 0) {
    offset = 0;
  }

  return await albumRepostModel.getAlbumReposters(albumId, limit, offset);
};

/**
 * Repost an album (idempotent operation)
 * Business rules:
 *   - User cannot repost their own album
 * Returns:
 *   - 201: Album newly reposted
 *   - 200: Already reposted (no change)
 */
exports.repostAlbum = async (userId, albumId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!albumId || albumId.trim() === '') {
    throw new AppError('Album ID is required', 400, 'INVALID_REQUEST');
  }

  // Check if user is trying to repost their own album
  const albumOwner = await albumRepostModel.getAlbumOwner(albumId);
  if (albumOwner === userId) {
    throw new AppError('Cannot repost your own album', 400, 'CANNOT_REPOST_OWN_ALBUM');
  }

  // Attempt to repost album
  const { created, repost } = await albumRepostModel.repostAlbum(userId, albumId);

  return {
    repostId: repost.id,
    userId: repost.user_id,
    albumId: repost.album_id,
    createdAt: repost.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Remove a repost from an album (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.removeRepost = async (userId, albumId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!albumId || albumId.trim() === '') {
    throw new AppError('Album ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to remove repost
  const deleted = await albumRepostModel.removeRepost(userId, albumId);

  if (!deleted) {
    throw new AppError('Repost not found', 404, 'REPOST_NOT_FOUND');
  }

  return true;
};

/**
 * Get user's reposted albums (for /me/reposted-albums endpoint)
 */
exports.getUserRepostedAlbums = async (userId, limit = 20, offset = 0) => {
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

  return await albumRepostModel.getUserRepostedAlbums(userId, limit, offset);
};

/**
 * Check if user has reposted an album (used for response decoration)
 */
exports.isAlbumRepostedByUser = async (userId, albumId) => {
  if (!userId) return false;
  return await albumRepostModel.isAlbumRepostedByUser(userId, albumId);
};

/**
 * Get total repost count for an album
 */
exports.getAlbumRepostCount = async (albumId) => {
  if (!albumId) return 0;
  return await albumRepostModel.getAlbumRepostCount(albumId);
};
