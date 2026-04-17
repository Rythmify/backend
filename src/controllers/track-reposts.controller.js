// ============================================================
// controllers/track-reposts.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const trackRepostsService = require('../services/track-reposts.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * GET /tracks/{track_id}/reposters
 * Returns paginated list of users who reposted a track
 * Auth: Required
 */
exports.getTrackReposters = async (req, res) => {
  const { track_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await trackRepostsService.getTrackReposters(
    track_id,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'Track reposters fetched successfully', 200);
};

/**
 * POST /tracks/{track_id}/repost
 * Repost a track (idempotent)
 * Returns: 201 if newly reposted, 200 if already reposted
 * Error: 400 if user tries to repost their own track
 * Auth: Required
 */
exports.repostTrack = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await trackRepostsService.repostTrack(userId, track_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Track reposted successfully' : 'Track already reposted';

  return success(
    res,
    {
      repost_id: result.repostId,
      user_id: result.userId,
      track_id: result.trackId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /tracks/{track_id}/repost
 * Remove a repost from a track
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.removeRepost = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await trackRepostsService.removeRepost(userId, track_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};

/**
 * GET /me/reposted-tracks
 * Get authenticated user's reposted tracks (paginated)
 * Auth: Required
 */
exports.getMyRepostedTracks = async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;
  const { limit = 20, offset = 0 } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await trackRepostsService.getUserRepostedTracks(
    userId,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'My reposted tracks fetched successfully', 200);
};
