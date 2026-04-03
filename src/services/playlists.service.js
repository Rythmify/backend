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
  slug:          p.slug,
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

const generateSlug = (name) => {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .substring(0, 100);              // max 100 chars

  // Fallback so slug is never empty after normalization.
  return slug || 'playlist';
};

const makeUniqueSlug = async (baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await playlistModel.findBySlug(slug, excludeId);
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// ============================================================
// ENDPOINT 1 — POST /playlists
// ============================================================
exports.createPlaylist = async ({ userId, name, isPublic }) => {
  // 1. Logic: Private playlists get a secret sharing token automatically
  const secretToken = isPublic === false ? generateSecretToken() : null;

  const baseSlug = generateSlug(name);
  const slug = await makeUniqueSlug(baseSlug);

  // 2. Insert minimal record
  const playlist = await playlistModel.create({
    userId,
    name,
    isPublic,
    secretToken,
    subtype: 'playlist', // Defaulting to 'playlist' at creation
    slug,
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

  const formattedItems = await Promise.all(
    items.map(async (playlist) => {
      const formatted = formatPlaylist(playlist);

      // Smart fallback: if playlist has no custom cover, use first track cover.
      if (!formatted.cover_image) {
        const topTrack = await playlistModel.getTopTrackArt(formatted.playlist_id);
        formatted.cover_image = topTrack?.cover_image || null;
      }

      return formatted;
    })
  );

  return {
    items: formattedItems,
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
  const isOwner = userId && playlist.owner_user_id === userId;
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

  if (isOwner) {
    response.secret_token = playlist.secret_token || null;
  }
  
  if (includeTracks) {
    response.tracks = tracks;
  }

  return response;
};

// ============================================================
// ENDPOINT 4 — PATCH /playlists/:playlist_id
// ============================================================
// ============================================================
// ENDPOINT 4 — PATCH /playlists/:playlist_id
// ============================================================
exports.updatePlaylist = async ({
  playlistId, userId, name, description, isPublic,
  coverImageFile, releaseDate, releaseDateProvided, genreId, genreIdProvided, subtype, slug, tags,
}) => {
  // ── Fetch ─────────────────────────────────────────────────
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // ── Ownership ─────────────────────────────────────────────
  if (playlist.owner_user_id !== userId) {
    throw new AppError(
      'You are not allowed to modify this playlist.',
      403,
      'PLAYLIST_FORBIDDEN'
    );
  }

  // ── At least one field required ───────────────────────────
  const allUndefined = [
    name, description, isPublic, coverImageFile,
    subtype, slug, tags,
  ].every((v) => v === undefined || v === null)
    && !releaseDateProvided
    && !genreIdProvided;

  if (allUndefined) {
    throw new AppError(
      'At least one field must be provided.',
      422,
      'BUSINESS_RULE_VIOLATION'
    );
  }

  // ── Name validation ───────────────────────────────────────
  if (name !== undefined && name.trim().length === 0) {
    throw new AppError(
      'Playlist name cannot be empty.',
      400,
      'VALIDATION_FAILED'
    );
  }

  // ── Subtype validation ────────────────────────────────────
  if (subtype !== undefined && !VALID_SUBTYPES.includes(subtype)) {
    throw new AppError(
      `Invalid subtype. Must be one of: ${VALID_SUBTYPES.join(', ')}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  // ── Release date required for non-playlist subtypes ───────
  const REQUIRES_RELEASE_DATE = ['album', 'ep', 'single', 'compilation'];
  const effectiveSubtype      = subtype     || playlist.subtype;
  const effectiveReleaseDate  = releaseDateProvided ? releaseDate : playlist.release_date;

  if (
    REQUIRES_RELEASE_DATE.includes(effectiveSubtype) &&
    !effectiveReleaseDate
  ) {
    throw new AppError(
      `Release date is required when subtype is ${effectiveSubtype}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  // ── Release date format validation ────────────────────────
  if (releaseDateProvided && releaseDate !== null) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(releaseDate)) {
      throw new AppError(
        'Invalid release_date format. Use YYYY-MM-DD.',
        400,
        'VALIDATION_FAILED'
      );
    }

    // Ensure the provided date is a real calendar date (e.g. reject 2026-02-31).
    const [year, month, day] = releaseDate.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;

    if (!isRealDate) {
      throw new AppError(
        'Invalid release_date value.',
        400,
        'VALIDATION_FAILED'
      );
    }

    const today = new Date();
    const todayUtc = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    if (releaseDate < todayUtc) {
      throw new AppError(
        'release_date cannot be in the past.',
        400,
        'VALIDATION_FAILED'
      );
    }
  }

  // ── Genre ID validation ───────────────────────────────────
  if (genreIdProvided && genreId !== null) {
    const db = require('../config/db');
    const genreCheck = await db.query(
      `SELECT id FROM genres WHERE id = $1`,
      [genreId]
    );
    if (!genreCheck.rows[0]) {
      throw new AppError(
        'Genre not found.',
        404,
        'RESOURCE_NOT_FOUND'
      );
    }
  }

  // ── Tags validation ───────────────────────────────────────
  if (tags !== undefined && !Array.isArray(tags)) {
    throw new AppError(
      'Tags must be an array of strings.',
      400,
      'VALIDATION_FAILED'
    );
  }

  if (tags !== undefined && tags.length > 10) {
    throw new AppError(
      'Maximum of 10 tags allowed per playlist.',
      400,
      'VALIDATION_FAILED'
    );
  }

  // ── Secret token logic ────────────────────────────────────
  let secretToken;
  if (isPublic === false && !playlist.secret_token) {
    secretToken = generateSecretToken();
  } else if (isPublic === true) {
    secretToken = null;
  }

  // ── Slug logic (explicit slug takes priority, else derive from name) ──
  let resolvedSlug;
  if (slug !== undefined) {
    if (slug.length === 0) {
      throw new AppError(
        'Slug cannot be empty.',
        400,
        'VALIDATION_FAILED'
      );
    }

    const normalizedSlug = generateSlug(slug);
    resolvedSlug = await makeUniqueSlug(normalizedSlug, playlistId);
  } else if (name !== undefined) {
    const baseSlug = generateSlug(name);
    resolvedSlug = await makeUniqueSlug(baseSlug, playlistId);
  }

  // ── Cover image upload ────────────────────────────────────
  let coverImageUrl;
  if (coverImageFile) {
    if (playlist.cover_image) {
      await storageService.deleteAllVersionsByUrl(playlist.cover_image);
    }
    const ext    = coverImageFile.originalname.split('.').pop();
    const key    = `playlists/${playlistId}/cover.${ext}`;
    const result = await storageService.uploadImage(coverImageFile, key);
    coverImageUrl = result.url;
  }

  // ── Update playlist fields ────────────────────────────────
  const updatePayload = {
    name,
    description,
    isPublic,
    secretToken,
    subtype,
    coverImage:  coverImageUrl,
    releaseDate,
    genreId: genreIdProvided ? genreId : undefined,
    slug: resolvedSlug,
  };

  const hasDbFieldUpdate = Object.values(updatePayload).some((v) => v !== undefined);
  const updated = hasDbFieldUpdate
    ? await playlistModel.updatePlaylist(playlistId, updatePayload)
    : playlist;

  // ── Replace tags 
  let updatedTags = playlist.tags || [];
  if (tags !== undefined) {
    updatedTags = await playlistModel.replacePlaylistTags(playlistId, tags);
  }

  const formatted  = formatPlaylist(updated || playlist);
  formatted.tags   = updatedTags;

  return { playlist: formatted };
};

// ============================================================
// ENDPOINT 5 — DELETE /playlists/:playlist_id
// ============================================================
exports.deletePlaylist = async ({ playlistId, userId }) => {
  // 1. Fetch playlist
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // 2. Only owner can delete
  if (playlist.owner_user_id !== userId) {
    throw new AppError(
      'You are not allowed to delete this playlist.',
      403,
      'PLAYLIST_FORBIDDEN'
    );
  }

  // 3. Delete cover image from blob if exists
  if (playlist.cover_image) {
    await storageService.deleteAllVersionsByUrl(playlist.cover_image);
  }

  // 4. Hard delete — cascade removes playlist_tracks, playlist_likes,
  //    playlist_reposts, and playlist_tags automatically via ON DELETE CASCADE
  const deleted = await playlistModel.hardDelete(playlistId);
  if (!deleted) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  return true;
};

// ============================================================
// ENDPOINT 6 — POST /playlists/:playlist_id/tracks
// ============================================================

/**
 * Adds a track to a playlist.
 * - Validates ownership
 * - Validates track exists and is not deleted/hidden
 * - Prevents duplicate tracks in the same playlist
 * - Supports optional position insertion (shifts existing tracks down)
 * - Defaults to appending at the end if no position is given
 */
exports.addTrack = async ({ playlistId, userId, trackId, position }) => {
  // 1. Fetch playlist
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // 2. Owner check
  checkOwner(playlist, userId);

  // 3. Validate track exists and is accessible
  // [DEPENDS: tracks module — Saja] — confirm function name is findTrackByIdWithDetails
  const trackModel = require('../models/track.model');
  const track = await trackModel.findTrackByIdWithDetails(trackId);
  if (!track) {
    throw new AppError('Track not found.', 404, 'TRACK_NOT_FOUND');
  }
  if (track.is_hidden) {
    throw new AppError('Track not found.', 404, 'TRACK_NOT_FOUND');
  }
  if (!track.is_public) {
    throw new AppError(
      'Only public tracks can be added to playlists.',
      422,
      'PLAYLIST_TRACK_MUST_BE_PUBLIC'
    );
  }

  // 4. Check for duplicate
  const alreadyExists = await playlistModel.findPlaylistTrack(playlistId, trackId);
  if (alreadyExists) {
    throw new AppError(
      'Track already exists in this playlist.',
      409,
      'PLAYLIST_TRACK_ALREADY_EXISTS'
    );
  }

  // 5. Determine insertion position
  const maxPos = await playlistModel.getMaxPosition(playlistId);
  const nextPos = maxPos + 1;

  let insertAt;
  if (position === undefined || position === null) {
    // No position given — append to end
    insertAt = nextPos;
  } else {
    if (position < 1 || position > nextPos) {
      throw new AppError(
        `Position must be between 1 and ${nextPos}.`,
        422,
        'PLAYLIST_POSITION_INVALID'
      );
    }
    // Shift existing tracks down to make room
    await playlistModel.shiftPositionsDown(playlistId, position);
    insertAt = position;
  }

  // 6. Insert the track
  await playlistModel.insertTrackAtPosition(playlistId, trackId, insertAt);

  // 7. Return updated playlist with all tracks
  const tracks = await playlistModel.findPlaylistTracks(playlistId);
  const formatted = formatPlaylist(playlist);

  if (!formatted.cover_image && tracks.length > 0) {
    formatted.cover_image = tracks[0].cover_image || null;
  }

  return {
    playlist: {
      ...formatted,
      track_count: tracks.length,
      tracks,
    },
  };
};