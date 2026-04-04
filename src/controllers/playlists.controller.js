const service = require('../services/playlists.service');
const { success, error } = require('../utils/api-response');
const { validate: isUuid } = require('uuid');

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

/**
 * Validate required params/body fields and send a consistent error response.
 */
const validateRequiredFields = (res, fields) => {
  for (const { value, name } of fields) {
    if (value === undefined || value === null || String(value).trim().length === 0) {
      error(res, 'VALIDATION_FAILED', `${name} is required.`, 400);
      return false;
    }
  }
  return true;
};

const validateUuidFields = (res, fields) => {
  for (const { value, name } of fields) {
    if (!isUuid(String(value).trim())) {
      error(res, 'VALIDATION_FAILED', `${name} must be a valid UUID.`, 400);
      return false;
    }
  }
  return true;
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
  const isPublicNormalized =
    is_public !== undefined ? is_public === true || is_public === 'true' : true;

  const data = await service.createPlaylist({
    userId,
    name,
    isPublic: isPublicNormalized,
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
    ownerUserId: req.query.owner_user_id ?? null,
    isAlbumView: is_album_view === 'true',
    subtype,
    q,
    limit,
    offset,
  });

  return success(res, data, 'Playlists fetched successfully.');
};

// ============================================================
// ENDPOINT 2 — GET /playlists/{playlist_id}
// ============================================================
exports.getPlaylist = async (req, res) => {
  const userId = req.user?.sub ?? null; // ID from JWT if present
  const { playlist_id } = req.params;
  const { secret_token, include_tracks } = req.query; // For sharing private playlists via links

  if (!validateRequiredFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;
  if (!validateUuidFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;

  const data = await service.getPlaylist({
    playlistId: playlist_id,
    userId,
    secretToken: secret_token,
    includeTracks: include_tracks === undefined ? true : include_tracks === 'true',
  });

  return success(res, data, 'Playlist details fetched successfully.');
};

// ============================================================
// ENDPOINT 4 — PATCH /playlists/:playlist_id
// ============================================================
exports.updatePlaylist = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { playlist_id } = req.params;
  if (!validateRequiredFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;
  if (!validateUuidFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;

  // Sanitize: convert empty strings to undefined so DB never sees ""
  const sanitize = (v) => (v === '' || v === undefined ? undefined : v);
  const sanitizeBool = (v) => {
    if (v === '' || v === undefined) return undefined;
    return v === true || v === 'true';
  };
  const sanitizeArray = (v) => {
    if (v === undefined) return undefined;
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v === '') return undefined;
    return [v];
  };

  const hasReleaseDateField = Object.prototype.hasOwnProperty.call(req.body, 'release_date');
  const hasGenreIdField = Object.prototype.hasOwnProperty.call(req.body, 'genre_id');
  const sanitizeReleaseDate = (v) => {
    if (v === undefined) return undefined;
    if (v === '' || v === null) return null;
    return String(v).trim();
  };
  const sanitizeGenreId = (v) => {
    if (v === undefined) return undefined;
    if (v === '' || v === null) return null;
    return String(v).trim();
  };

  const name = sanitize(req.body.name);
  const description = sanitize(req.body.description);
  const isPublic = sanitizeBool(req.body.is_public);
  const releaseDate = sanitizeReleaseDate(req.body.release_date);
  const genreId = sanitizeGenreId(req.body.genre_id);
  const subtype = sanitize(req.body.subtype);
  const slug = req.body.slug !== undefined ? String(req.body.slug).trim() : undefined;
  const tags = sanitizeArray(req.body.tags);
  const clearCoverImage =
    req.body.remove_cover_image === true ||
    req.body.remove_cover_image === 'true' ||
    req.body.cover_image === '';

  const data = await service.updatePlaylist({
    playlistId: playlist_id,
    userId,
    name,
    description,
    isPublic,
    coverImageFile: req.file || null,
    clearCoverImage,
    releaseDate,
    releaseDateProvided: hasReleaseDateField,
    genreIdProvided: hasGenreIdField,
    genreId,
    subtype,
    slug,
    tags,
  });

  return success(res, data.playlist, 'Playlist updated successfully.');
};

// ============================================================
// ENDPOINT 5 — DELETE /playlists/:playlist_id
// ============================================================
exports.deletePlaylist = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { playlist_id } = req.params;
  if (!validateRequiredFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;
  if (!validateUuidFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;

  await service.deletePlaylist({
    playlistId: playlist_id,
    userId,
  });

  return success(res, { success: true }, 'Playlist deleted successfully.');
};

// ============================================================
// ENDPOINT 6 — POST /playlists/:playlist_id/tracks
// ============================================================
exports.addTrack = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { playlist_id } = req.params;
  if (!validateRequiredFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;
  if (!validateUuidFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;

  const { track_id, position } = req.body;

  if (!validateRequiredFields(res, [{ value: track_id, name: 'track_id' }])) return;
  if (!validateUuidFields(res, [{ value: track_id, name: 'track_id' }])) return;

  // Parse position if provided
  let parsedPosition;
  if (position !== undefined && position !== null) {
    parsedPosition = parseInt(position);
    if (isNaN(parsedPosition) || parsedPosition < 1) {
      return error(res, 'VALIDATION_FAILED', 'position must be a positive integer.', 400);
    }
  }

  const data = await service.addTrack({
    playlistId: playlist_id,
    userId,
    trackId: track_id,
    position: parsedPosition,
  });

  return success(res, data.playlist, 'Track added to playlist successfully.', 201);
};

// ============================================================
// ENDPOINT 7 — GET /playlists/:playlist_id/tracks
// ============================================================
exports.getPlaylistTracks = async (req, res) => {
  const userId = req.user?.sub ?? null;
  const { playlist_id } = req.params;
  const { secret_token, page, limit } = req.query;

  const data = await service.getPlaylistTracks({
    playlistId: playlist_id,
    userId,
    secretToken: secret_token,
    page,
    limit,
  });

  return success(res, data, 'Playlist tracks fetched successfully.');
};

// ============================================================
// ENDPOINT 8 — PATCH /playlists/:playlist_id/tracks/reorder
// ============================================================
exports.reorderPlaylistTracks = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { playlist_id } = req.params;
  const { items } = req.body;

  const data = await service.reorderPlaylistTracks({
    playlistId: playlist_id,
    userId,
    items,
  });

  return success(res, data, 'Playlist tracks reordered successfully.');
};

// ============================================================
// ENDPOINT 7 — DELETE /playlists/:playlist_id/tracks/:track_id
// ============================================================
exports.removeTrack = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { playlist_id, track_id } = req.params;

  if (
    !validateRequiredFields(res, [
      { value: playlist_id, name: 'Playlist id' },
      { value: track_id, name: 'Track id' },
    ])
  )
    return;

  if (
    !validateUuidFields(res, [
      { value: playlist_id, name: 'Playlist id' },
      { value: track_id, name: 'Track id' },
    ])
  )
    return;

  const data = await service.removeTrack({
    playlistId: playlist_id,
    userId,
    trackId: track_id,
  });

  return success(res, data.playlist, 'Track removed from playlist successfully.');
};

// ============================================================
// ENDPOINT 8 — GET /playlists/:playlist_id/embed
// ============================================================
exports.getEmbed = async (req, res) => {
  const userId = req.user?.sub ?? null; // optional auth

  const { playlist_id } = req.params;
  if (!validateRequiredFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;
  if (!validateUuidFields(res, [{ value: playlist_id, name: 'Playlist id' }])) return;

  const { secret_token, theme, autoplay, width, height } = req.query;

  const data = await service.getEmbed({
    playlistId: playlist_id,
    userId,
    secretToken: secret_token,
    theme,
    autoplay,
    width,
    height,
  });

  return success(res, data, 'Playlist embed code generated successfully.');
};
