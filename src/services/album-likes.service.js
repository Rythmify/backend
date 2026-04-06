// ============================================================
// services/album-likes.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const albumLikeModel = require('../models/album-like.model');
const AppError = require('../utils/app-error');

/**
 * Get paginated list of users who liked an album
 * Includes user profile information
 */
exports.getAlbumLikers = async (albumId, limit = 20, offset = 0) => {
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

  return await albumLikeModel.getAlbumLikers(albumId, limit, offset);
};

/**
 * Like an album (idempotent operation)
 * Returns:
 *   - 201: Album newly liked
 *   - 200: Already liked (no change)
 */
exports.likeAlbum = async (userId, albumId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!albumId || albumId.trim() === '') {
    throw new AppError('Album ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to like album
  const { created, like } = await albumLikeModel.likeAlbum(userId, albumId);

  return {
    likeId: like.id,
    userId: like.user_id,
    albumId: like.album_id,
    createdAt: like.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Unlike an album (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.unlikeAlbum = async (userId, albumId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!albumId || albumId.trim() === '') {
    throw new AppError('Album ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to unlike album
  const deleted = await albumLikeModel.unlikeAlbum(userId, albumId);

  if (!deleted) {
    throw new AppError('Like not found', 404, 'LIKE_NOT_FOUND');
  }

  return true;
};

/**
 * Get user's liked albums (for /me/liked-albums endpoint)
 */
exports.getUserLikedAlbums = async (userId, limit = 20, offset = 0) => {
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

  return await albumLikeModel.getUserLikedAlbums(userId, limit, offset);
};

/**
 * Check if user likes an album (used for response decoration)
 */
exports.isAlbumLikedByUser = async (userId, albumId) => {
  if (!userId) return false;
  return await albumLikeModel.isAlbumLikedByUser(userId, albumId);
};

/**
 * Get total like count for an album
 */
exports.getAlbumLikeCount = async (albumId) => {
  if (!albumId) return 0;
  return await albumLikeModel.getAlbumLikeCount(albumId);
};
