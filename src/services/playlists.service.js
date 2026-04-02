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
// Endpoint 1 — POST /playlists
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
