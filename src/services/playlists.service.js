// ============================================================
// services/playlists.service.js
// Owner : Alyaa Mohamed (BE-4)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const playlistModel  = require('../models/playlist.model');
const storageService = require('./storage.service');
const AppError       = require('../utils/app-error');
const crypto         = require('crypto');

const VALID_SUBTYPES = ['playlist', 'album', 'ep', 'single', 'compilation'];

// ── Helpers ──────────────────────────────────────────────────

const generateSecretToken = () => crypto.randomBytes(24).toString('hex');

const checkOwner = (playlist, userId) => {
  if (playlist.owner_user_id !== userId) {
    throw new AppError(
      'You are not allowed to modify this playlist.',
      403,
      'PLAYLIST_FORBIDDEN'
    );
  }
};

const checkAccess = (playlist, userId, secretToken) => {
  if (!playlist.is_public) {
    const isOwner = userId && playlist.owner_user_id === userId;
    const hasToken = secretToken && playlist.secret_token === secretToken;
    if (!isOwner && !hasToken) {
      throw new AppError(
        'You do not have access to this playlist.',
        403,
        'PLAYLIST_ACCESS_DENIED'
      );
    }
  }
};

const formatPlaylist = (p) => ({
  playlist_id:   p.playlist_id || p.id,
  owner_user_id: p.owner_user_id || p.user_id,
  name:          p.name,
  description:   p.description,
  cover_image:   p.cover_image,
  subtype:       p.subtype,
  is_public:     p.is_public,
  release_date:  p.release_date,
  genre_id:      p.genre_id,
  like_count:    p.like_count,
  repost_count:  p.repost_count,
  track_count:   p.track_count,
  created_at:    p.created_at,
  updated_at:    p.updated_at,
});

// ── Upload helper (used by create & update) ───────────────────

const uploadCoverImage = async (file, playlistId) => {
  const ext = file.originalname.split('.').pop();
  const key = `playlists/${playlistId}/cover.${ext}`;
  const result = await storageService.uploadImage(file, key);
  return result.url;
};

// ============================================================
// ENDPOINT 1 — POST /playlists
// ============================================================
exports.createPlaylist = async ({ userId, name, isPublic }) => {
  // 1. Logic: Private playlists get a secret sharing token automatically
  const secretToken = isPublic === false ? generateSecretToken() : null;

  // 2. Insert minimal record
  const playlist = await playlistModel.create({
    userId,
    name,
    isPublic,
    secretToken,
    subtype: 'playlist' // Defaulting to 'playlist' at creation
  });

  return { playlist: formatPlaylist(playlist) };
};

// ============================================================
// ENDPOINT 2 — GET /playlists
// ============================================================

/**
 * GET /playlists
 * Lists playlists based on filters: 
 * - mine=true & filter=created: Playlists the user owns.
 * - mine=true & filter=liked: Playlists the user has hearted.
 * - isAlbumView=true: Shows everything that is NOT a regular playlist (Albums, EPs).
 * - public: Playlists available to everyone (optionally by ownerUserId).
 */
exports.listPlaylists = async ({ 
  requesterId, 
  mine, 
  filter, 
  ownerUserId, 
  q, 
  subtype, 
  isAlbumView, 
  limit, 
  offset 
}) => {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  if (mine && !requesterId) {
    throw new AppError('Authentication required to list your personal playlists.', 401, 'UNAUTHORIZED');
  }

  // Common filters for the Model
  const filters = { 
    q, 
    subtype, 
    isAlbumView, 
    limit: safeLimit, 
    offset: safeOffset 
  };

  let items, total;

  if (mine) {
    if (filter === 'liked') {
      // 1. Liked: Show anything I hearted (ignores who the owner is)
      [items, total] = await Promise.all([
        playlistModel.findLikedPlaylists({ userId: requesterId, ...filters }),
        playlistModel.countLikedPlaylists({ userId: requesterId, ...filters }),
      ]);
    } else {
      // 2. Created: Show specifically what I own
      [items, total] = await Promise.all([
        playlistModel.findMyPlaylists({ userId: requesterId, ...filters }),
        playlistModel.countMyPlaylists({ userId: requesterId, ...filters }),
      ]);
    }
  } else {
    // 3. Public Discovery (General search or specific Artist profile)
    [items, total] = await Promise.all([
      playlistModel.findPublicPlaylists({ ownerUserId, ...filters }),
      playlistModel.countPublicPlaylists({ ownerUserId, ...filters }),
    ]);
  }

  return {
    items: items.map(p => formatPlaylist(p)),
    meta: { 
      limit: safeLimit, 
      offset: safeOffset, 
      total: parseInt(total) 
    },
  };
};

// ============================================================
// ENDPOINT 2 — GET /playlists/{playlist_id}
// ============================================================
exports.getPlaylist = async ({ playlistId, userId, secretToken, includeTracks }) => {
  // 1. Fetch playlist metadata
  const playlist = await playlistModel.findPlaylistById(playlistId);

  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // 2. Privacy Logic (Owner vs. Public vs. Secret Link)
  if (!playlist.is_public) {
    const isOwner = userId && playlist.owner_user_id === userId;
    const hasValidToken = secretToken && secretToken === playlist.secret_token;

    if (!isOwner && !hasValidToken) {
      throw new AppError('This playlist is private.', 403, 'PRIVATE_PLAYLIST_ACCESS_DENIED');
    }
  }

  const formatted = formatPlaylist(playlist);
  let tracks = [];

  // 3. Conditional Track Loading & Smart Cover Logic
  if (includeTracks) {
    // Fetch full list if requested
    tracks = await playlistModel.findPlaylistTracks(playlistId);
    
    // Fallback cover logic using the fetched tracks
    if (!formatted.cover_image && tracks.length > 0) {
      formatted.cover_image = tracks[0].cover_image || null;
    }
  } else if (!formatted.cover_image) {
    // Tracks NOT requested, but we still need the cover image fallback
    // We call a lightweight model function that only gets the FIRST track art
    const topTrack = await playlistModel.getTopTrackArt(playlistId);
    formatted.cover_image = topTrack?.cover_image || null;
  }

  // 4. Final Response Construction
  const response = { ...formatted };
  
  if (includeTracks) {
    response.tracks = tracks;
  }

  return response;
};