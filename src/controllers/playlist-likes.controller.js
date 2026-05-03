// ============================================================
// controllers/playlist-likes.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const playlistLikesService = require('../services/playlist-likes.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * GET /playlists/{playlist_id}/likers
 * Returns paginated list of users who liked a playlist
 * Auth: Required
 */
exports.getPlaylistLikers = async (req, res) => {
  const { playlist_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await playlistLikesService.getPlaylistLikers(
    playlist_id,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'Playlist likers fetched successfully', 200);
};

/**
 * POST /playlists/{playlist_id}/like
 * Like a playlist (idempotent)
 * Returns: 201 if newly liked, 200 if already liked
 * Auth: Required
 */
exports.likePlaylist = async (req, res) => {
  const { playlist_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await playlistLikesService.likePlaylist(userId, playlist_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Playlist liked successfully' : 'Playlist already liked';

  return success(
    res,
    {
      like_id: result.likeId,
      user_id: result.userId,
      playlist_id: result.playlistId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /playlists/{playlist_id}/like
 * Unlike a playlist
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.unlikePlaylist = async (req, res) => {
  const { playlist_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await playlistLikesService.unlikePlaylist(userId, playlist_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};

/**
 * GET /me/liked-playlists
 * Get authenticated user's liked playlists (paginated)
 * Auth: Required
 */
exports.getMyLikedPlaylists = async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;
  const { limit = 20, offset = 0 } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await playlistLikesService.getUserLikedPlaylists(
    userId,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'My liked playlists fetched successfully', 200);
};
