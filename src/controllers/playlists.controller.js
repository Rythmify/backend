const service = require('../services/playlists.service');
const { success, error } = require('../utils/api-response');

/**
 * Helper to extract the authenticated user ID from the request.
 * Matches the format used in messages.controller.js
 */
const getAuthenticatedUserId = (req, res) => {
  const userId = req?.user?.sub;
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    return null;
  }
  return userId;
};

// ============================================================
// ENDPOINT 1 — POST /playlists
// ============================================================
exports.createPlaylist = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const { name, is_public } = req.body; // ONLY name and privacy

  if (!name) {
    return error(res, 'VALIDATION_FAILED', 'Playlist name is required.', 400);
  }

  if (!name || name.trim().length === 0) {
    return error(res, 'VALIDATION_FAILED', 'Playlist name cannot be empty or just spaces.', 400);
  }

  // Handle privacy (defaulting to true/public if not provided)
  const isPublicNormalized = is_public !== undefined 
    ? (is_public === true || is_public === 'true') 
    : true;

  const data = await service.createPlaylist({
    userId,
    name,
    isPublic: isPublicNormalized
  });

  return success(res, data.playlist, 'Playlist created successfully.', 201);
};

// ============================================================
// ENDPOINT 2 — GET /playlists
// ============================================================
exports.listPlaylists = async (req, res) => {
  const userId = req.user?.sub ?? null;
  // Make sure these two are included in the destructuring:
  const { mine, filter, q, limit, offset, subtype, is_album_view } = req.query; 

  const data = await service.listPlaylists({
    requesterId: userId,
    mine: mine === 'true',
    filter,
    isAlbumView: is_album_view === 'true', // Convert string "true" to boolean
    subtype,
    q,
    limit,
    offset,
  });

  return success(res, data, 'Playlists fetched successfully.');
};