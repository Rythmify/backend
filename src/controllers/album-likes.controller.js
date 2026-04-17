// ============================================================
// controllers/album-likes.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const albumLikesService = require('../services/album-likes.service');
const { success, error } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * GET /albums/{album_id}/likers
 * Returns paginated list of users who liked an album
 * Auth: Required
 */
exports.getAlbumLikers = async (req, res) => {
  const { album_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await albumLikesService.getAlbumLikers(
    album_id,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'Album likers fetched successfully', 200);
};

/**
 * POST /albums/{album_id}/like
 * Like an album (idempotent)
 * Returns: 201 if newly liked, 200 if already liked
 * Auth: Required
 */
exports.likeAlbum = async (req, res) => {
  const { album_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await albumLikesService.likeAlbum(userId, album_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Album liked successfully' : 'Album already liked';

  return success(
    res,
    {
      like_id: result.likeId,
      user_id: result.userId,
      album_id: result.albumId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /albums/{album_id}/like
 * Unlike an album
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.unlikeAlbum = async (req, res) => {
  const { album_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await albumLikesService.unlikeAlbum(userId, album_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};

/**
 * GET /me/liked-albums
 * Get authenticated user's liked albums (paginated)
 * Auth: Required
 */
exports.getMyLikedAlbums = async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;
  const { limit = 20, offset = 0 } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await albumLikesService.getUserLikedAlbums(
    userId,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'My liked albums fetched successfully', 200);
};
