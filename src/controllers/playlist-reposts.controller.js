// ============================================================
// controllers/playlist-reposts.controller.js
// Owner: Beshoy Maher (BE-3)
// Validates requests → calls service → returns HTTP response
// ============================================================

const playlistRepostsService = require('../services/playlist-reposts.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * GET /playlists/{playlist_id}/reposters
 * Returns paginated list of users who reposted a playlist
 * Auth: Required
 */
exports.getPlaylistReposters = async (req, res) => {
  const { playlist_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await playlistRepostsService.getPlaylistReposters(
    playlist_id,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'Playlist reposters fetched successfully', 200);
};

/**
 * POST /playlists/{playlist_id}/repost
 * Repost a playlist (idempotent)
 * Returns: 201 if newly reposted, 200 if already reposted
 * Error: 400 if user tries to repost their own playlist
 * Auth: Required
 */
exports.repostPlaylist = async (req, res) => {
  const { playlist_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const result = await playlistRepostsService.repostPlaylist(userId, playlist_id);

  // Return 201 if newly created, 200 if already existed
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew ? 'Playlist reposted successfully' : 'Playlist already reposted';

  return success(
    res,
    {
      repost_id: result.repostId,
      user_id: result.userId,
      playlist_id: result.playlistId,
      created_at: result.createdAt,
    },
    message,
    statusCode
  );
};

/**
 * DELETE /playlists/{playlist_id}/repost
 * Remove a repost from a playlist
 * Returns: 204 No Content on success
 * Auth: Required
 */
exports.removeRepost = async (req, res) => {
  const { playlist_id } = req.params;
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  await playlistRepostsService.removeRepost(userId, playlist_id);

  // Return 204 No Content (no body)
  return res.status(204).send();
};

/**
 * GET /me/reposted-playlists
 * Get authenticated user's reposted playlists (paginated)
 * Auth: Required
 */
exports.getMyRepostedPlaylists = async (req, res) => {
  const userId = req.user?.id || req.user?.sub || req.user?.user_id;
  const { limit = 20, offset = 0 } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  // Validate limit and offset
  if (isNaN(limit) || isNaN(offset)) {
    throw new AppError('Limit and offset must be numbers', 400, 'VALIDATION_FAILED');
  }

  const result = await playlistRepostsService.getUserRepostedPlaylists(
    userId,
    parseInt(limit),
    parseInt(offset)
  );

  return success(res, result, 'My reposted playlists fetched successfully', 200);
};
