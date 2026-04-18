// ============================================================
// controllers/track-likes.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const trackLikesService = require('../services/track-likes.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * GET /tracks/{track_id}/likers
 * Returns paginated list of users who liked a track
 * Auth: Required
 */
exports.getTrackLikers = async (req, res) => {
  const { track_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await trackLikesService.getTrackLikers(
    track_id,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'Track likers fetched successfully', 200);
};

/**
 * POST /tracks/{track_id}/like
 * Like a track (idempotent)
 * Returns: 201 if newly liked, 200 if already liked
 * Auth: Required
 */
exports.likeTrack = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await trackLikesService.likeTrack(userId, track_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Track liked successfully' : 'Track already liked';

  return success(
    res,
    {
      like_id: result.likeId,
      user_id: result.userId,
      track_id: result.trackId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /tracks/{track_id}/like
 * Unlike a track
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.unlikeTrack = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await trackLikesService.unlikeTrack(userId, track_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};

/**
 * GET /me/liked-tracks
 * Get authenticated user's liked tracks (paginated)
 * Auth: Required
 */
exports.getMyLikedTracks = async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;
  const { limit = 20, offset = 0 } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await trackLikesService.getUserLikedTracks(
    userId,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'My liked tracks fetched successfully', 200);
};
