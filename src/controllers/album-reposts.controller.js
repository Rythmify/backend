// ============================================================
// controllers/album-reposts.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const albumRepostsService = require('../services/album-reposts.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * GET /albums/{album_id}/reposters
 * Returns paginated list of users who reposted an album
 * Auth: Required
 */
exports.getAlbumReposters = async (req, res) => {
  const { album_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await albumRepostsService.getAlbumReposters(
    album_id,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'Album reposters fetched successfully', 200);
};

/**
 * POST /albums/{album_id}/repost
 * Repost an album (idempotent)
 * Returns: 201 if newly reposted, 200 if already reposted
 * Error: 400 if user tries to repost their own album
 * Auth: Required
 */
exports.repostAlbum = async (req, res) => {
  const { album_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await albumRepostsService.repostAlbum(userId, album_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Album reposted successfully' : 'Album already reposted';

  return success(
    res,
    {
      repost_id: result.repostId,
      user_id: result.userId,
      album_id: result.albumId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /albums/{album_id}/repost
 * Remove a repost from an album
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.removeRepost = async (req, res) => {
  const { album_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await albumRepostsService.removeRepost(userId, album_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};

/**
 * GET /me/reposted-albums
 * Get authenticated user's reposted albums (paginated)
 * Auth: Required
 */
exports.getMyRepostedAlbums = async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;
  const { limit = 20, offset = 0 } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await albumRepostsService.getUserRepostedAlbums(
    userId,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'My reposted albums fetched successfully', 200);
};
