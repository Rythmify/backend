// ============================================================
// services/playlists.service.js
// Owner : Alyaa Mohamed (BE-4)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const playlistModel = require('../models/playlist.model');
const subscriptionsService = require('./subscriptions.service');
const storageService = require('./storage.service');
const AppError = require('../utils/app-error');
const crypto = require('crypto');
const userModel = require('../models/user.model');
const followModel = require('../models/follow.model');
const playlistLikeModel = require('../models/playlist-like.model');
const db = require('../config/db');
const { findTracksByGenreId, getDailyTracks, getWeeklyTracks } = require('../models/feed.model');
const { findRelatedTracks } = require('../models/track.model');
// Accept canonical UUID text shape used by Postgres UUID columns.
// We intentionally do not enforce RFC version/variant bits here because
// seed data may contain UUID-shaped IDs that fail strict RFC checks.
const UUID_SHAPE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_SUBTYPES = ['playlist', 'album', 'ep', 'single', 'compilation'];

// Enum values that represent generated/seed playlists.
// These are immutable through regular playlist endpoints.
// IMPORTANT: keep this in sync with the playlist_type enum in the database.
const GENERATED_PLAYLIST_TYPES = [
  'auto_generated',
  'curated_daily',
  'curated_weekly',
  'genre_trending',
  'track_radio',
  'liked_songs', // system-managed
];

function assertNotGenerated(playlist) {
  if (GENERATED_PLAYLIST_TYPES.includes(playlist.type)) {
    throw new AppError(
      'This playlist is managed automatically and cannot be modified directly.',
      403,
      'PLAYLIST_GENERATED_IMMUTABLE'
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────

const generateSecretToken = () => crypto.randomBytes(24).toString('hex');
const isUnlimited = (limit) => limit === null || limit === undefined;

const checkOwner = (playlist, userId) => {
  if (playlist.owner_user_id !== userId) {
    throw new AppError('You are not allowed to modify this playlist.', 403, 'PLAYLIST_FORBIDDEN');
  }
};

const checkAccess = (playlist, userId, secretToken) => {
  if (!playlist.is_public) {
    const isOwner = userId && playlist.owner_user_id === userId;
    const hasToken = secretToken && playlist.secret_token === secretToken;
    if (!isOwner && !hasToken) {
      throw new AppError('You do not have access to this playlist.', 403, 'PLAYLIST_ACCESS_DENIED');
    }
  }
};

const formatPlaylist = (p) => ({
  playlist_id: p.playlist_id || p.id,
  owner_user_id: p.owner_user_id || p.user_id,
  name: p.name,
  description: p.description,
  cover_image: p.cover_image,
  type: p.type,
  subtype: p.subtype,
  slug: p.slug,
  is_public: p.is_public,
  release_date: p.release_date,
  genre_id: p.genre_id,
  like_count: p.like_count,
  repost_count: p.repost_count,
  track_count: p.track_count,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

// ── Upload helper (used by create & update) ───────────────────

const uploadCoverImage = async (file, playlistId) => {
  const ext = file.originalname.split('.').pop();
  const key = `playlists/${playlistId}/cover.${ext}`;
  const result = await storageService.uploadImage(file, key);
  return result.url;
};

const hasCustomPlaylistCover = (coverUrl, playlistId) => {
  if (!coverUrl) return false;
  return coverUrl.includes(`/playlists/${playlistId}/cover.`);
};

const syncPlaylistCoverFromFirstTrack = async (playlistId) => {
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) return null;

  // Preserve explicit custom covers uploaded for this playlist.
  if (hasCustomPlaylistCover(playlist.cover_image, playlistId)) {
    return playlist;
  }

  const topTrack = await playlistModel.getTopTrackArt(playlistId);
  const nextCover = topTrack?.cover_image || null;

  if (playlist.cover_image === nextCover) {
    return playlist;
  }

  const updated = await playlistModel.updatePlaylist(playlistId, { coverImage: nextCover });
  return updated || playlist;
};

const generateSlug = (name) => {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .substring(0, 100); // max 100 chars

  // Fallback so slug is never empty after normalization.
  return slug || 'playlist';
};

const makeUniqueSlug = async (baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;
  let existing = await playlistModel.findBySlug(slug, excludeId);

  while (existing) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    existing = await playlistModel.findBySlug(slug, excludeId);
  }

  return slug;
};

const verifyUserAccess = async (targetUserId, requesterId) => {
  const targetUser = await userModel.findById(targetUserId);
  if (!targetUser) {
    throw new AppError('User not found.', 404, 'NOT_FOUND');
  }

  // If the profile is private, and the requester is looking at someone else's profile
  if (targetUser.is_private && targetUserId !== requesterId) {
    if (!requesterId) {
      throw new AppError(
        'This profile is private. You must sign in and follow the user to view their content.',
        403,
        'PROFILE_ACCESS_DENIED'
      );
    }

    // Check if the requester actually follows this private user
    const followStatus = await followModel.getFollowStatus(requesterId, targetUserId);
    if (!followStatus.is_following) {
      throw new AppError(
        'This profile is private. You must follow the user to view their content.',
        403,
        'PROFILE_ACCESS_DENIED'
      );
    }
  }

  return true;
};

// ============================================================
// ENDPOINT 1 — POST /playlists
// ============================================================
const assertCanCreatePlaylist = async (userId) => {
  const plan = await subscriptionsService.getEffectiveActivePlanForUser(userId);

  if (isUnlimited(plan.playlist_limit)) {
    return;
  }

  const playlistsCreated = await playlistModel.countUserRegularPlaylists(userId);
  if (playlistsCreated < plan.playlist_limit) {
    return;
  }

  throw new AppError(
    'Free plan allows up to 2 playlists. Upgrade to premium to create more.',
    403,
    'SUBSCRIPTION_PLAYLIST_LIMIT_REACHED'
  );
};

exports.assertCanCreatePlaylist = assertCanCreatePlaylist;

exports.createPlaylist = async ({ userId, name, isPublic }) => {
  await assertCanCreatePlaylist(userId);

  // 1. Logic: Private playlists get a secret sharing token automatically
  const secretToken = generateSecretToken();

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

  const formatted = formatPlaylist(playlist);
  if (!playlist.is_public) {
    formatted.secret_token = playlist.secret_token;
  }
  return { playlist: formatted };
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
  offset,
}) => {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  if (mine && !requesterId) {
    throw new AppError(
      'Authentication required to list your personal playlists.',
      401,
      'UNAUTHORIZED'
    );
  }

  // Common filters for the Model
  const filters = {
    q,
    subtype,
    isAlbumView,
    limit: safeLimit,
    offset: safeOffset,
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
      total: parseInt(total),
    },
  };
};

// ============================================================
// ENDPOINT 2 — GET /playlists/{playlist_id}
// ============================================================
exports.getPlaylist = async ({ playlistId, userId, secretToken, includeTracks }) => {
  // Accept either UUID or playlist slug in the route param.
  // If a slug is provided, resolve it to the playlist UUID first.
  const normalizedPlaylistId = String(playlistId).trim();
  if (!UUID_SHAPE_REGEX.test(normalizedPlaylistId)) {
    const lookup = await playlistModel.findBySlug(normalizedPlaylistId);
    if (!lookup?.id) {
      throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
    }
    playlistId = lookup.id;
  } else {
    playlistId = normalizedPlaylistId;
  }

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

  // 3. Fire all independent queries in parallel:
  //    - track list (if requested)
  //    - total playlist duration (always — needed for display regardless of page)
  //    - is_liked_by_me (only if authenticated, otherwise resolves immediately to false)
  const [tracks, totalDurationSeconds, isLikedByMe] = await Promise.all([
    includeTracks ? playlistModel.findPlaylistTracks(playlistId) : Promise.resolve([]),
    playlistModel.getTotalDuration(playlistId),
    userId ? playlistLikeModel.isPlaylistLikedByUser(userId, playlistId) : Promise.resolve(false),
  ]);

  // 4. Smart cover fallback — use first track art if no custom cover
  if (!formatted.cover_image) {
    if (includeTracks && tracks.length > 0) {
      formatted.cover_image = tracks[0].cover_image || null;
    } else {
      const topTrack = await playlistModel.getTopTrackArt(playlistId);
      formatted.cover_image = topTrack?.cover_image || null;
    }
  }

  // 5. Final Response Construction
  const response = {
    ...formatted,
    total_duration_seconds: totalDurationSeconds,
    is_liked_by_me: isLikedByMe,
  };

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
exports.updatePlaylist = async ({
  playlistId,
  userId,
  name,
  description,
  isPublic,
  coverImageFile,
  clearCoverImage,
  releaseDate,
  releaseDateProvided,
  genreId,
  genreIdProvided,
  subtype,
  slug,
  tags,
}) => {
  // ── Fetch ─────────────────────────────────────────────────
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // ── Guard: generated playlists are immutable ───────────────
  assertNotGenerated(playlist);

  // ── Ownership ─────────────────────────────────────────────
  if (playlist.owner_user_id !== userId) {
    throw new AppError('You are not allowed to modify this playlist.', 403, 'PLAYLIST_FORBIDDEN');
  }

  // ── At least one field required ───────────────────────────
  const allUndefined =
    [name, description, isPublic, coverImageFile, subtype, slug, tags].every(
      (v) => v === undefined || v === null
    ) &&
    !clearCoverImage &&
    !releaseDateProvided &&
    !genreIdProvided;

  if (allUndefined) {
    throw new AppError('At least one field must be provided.', 422, 'BUSINESS_RULE_VIOLATION');
  }

  // ── Name validation ───────────────────────────────────────
  if (name !== undefined && name.trim().length === 0) {
    throw new AppError('Playlist name cannot be empty.', 400, 'VALIDATION_FAILED');
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
  const effectiveSubtype = subtype || playlist.subtype;
  const effectiveReleaseDate = releaseDateProvided ? releaseDate : playlist.release_date;

  if (REQUIRES_RELEASE_DATE.includes(effectiveSubtype) && !effectiveReleaseDate) {
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
      throw new AppError('Invalid release_date format. Use YYYY-MM-DD.', 400, 'VALIDATION_FAILED');
    }

    // Ensure the provided date is a real calendar date (e.g. reject 2026-02-31).
    const [year, month, day] = releaseDate.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;

    if (!isRealDate) {
      throw new AppError('Invalid release_date value.', 400, 'VALIDATION_FAILED');
    }
  }

  // ── Genre ID validation ───────────────────────────────────
  if (genreIdProvided && genreId !== null) {
    const db = require('../config/db');
    const genreCheck = await db.query(`SELECT id FROM genres WHERE id = $1`, [genreId]);
    if (!genreCheck.rows[0]) {
      throw new AppError('Genre not found.', 404, 'RESOURCE_NOT_FOUND');
    }
  }

  // ── Tags validation ───────────────────────────────────────
  if (tags !== undefined && !Array.isArray(tags)) {
    throw new AppError('Tags must be an array of strings.', 400, 'VALIDATION_FAILED');
  }

  if (tags !== undefined && tags.length > 10) {
    throw new AppError('Maximum of 10 tags allowed per playlist.', 400, 'VALIDATION_FAILED');
  }

  // ── Secret token logic ────────────────────────────────────
  // Token is generated once and never cleared — old share links always work
  let secretToken;
  if (!playlist.secret_token) {
    // No token exists yet — generate one regardless of current privacy setting
    // so it's ready whenever the playlist is made private
    secretToken = generateSecretToken();
  }
  // Never set to null — token persists even when playlist is public

  // ── Slug logic (explicit slug takes priority, else derive from name) ──
  let resolvedSlug;
  if (slug !== undefined) {
    if (slug.length === 0) {
      throw new AppError('Slug cannot be empty.', 400, 'VALIDATION_FAILED');
    }

    const normalizedSlug = generateSlug(slug);
    resolvedSlug = await makeUniqueSlug(normalizedSlug, playlistId);
  }

  // ── Cover image upload ────────────────────────────────────
  let coverImageUrl;
  if (clearCoverImage) {
    if (playlist.cover_image) {
      await storageService.deleteAllVersionsByUrl(playlist.cover_image);
    }
    coverImageUrl = null;
  } else if (coverImageFile) {
    if (playlist.cover_image) {
      await storageService.deleteAllVersionsByUrl(playlist.cover_image);
    }
    coverImageUrl = await uploadCoverImage(coverImageFile, playlistId);
  }

  // ── Update playlist fields ────────────────────────────────
  const updatePayload = {
    name,
    description,
    isPublic,
    secretToken,
    subtype,
    coverImage: coverImageUrl,
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

  const finalPlaylist = updated || playlist;
  const syncedPlaylist =
    clearCoverImage && !coverImageFile
      ? await syncPlaylistCoverFromFirstTrack(playlistId)
      : finalPlaylist;

  const formatted = formatPlaylist(syncedPlaylist);
  formatted.tags = updatedTags;

  // Keep update response consistent with GET details cover fallback behavior.
  if (!formatted.cover_image) {
    const topTrack = await playlistModel.getTopTrackArt(playlistId);
    formatted.cover_image = topTrack?.cover_image || null;
  }

  // Return secret_token to owner if playlist is private
  if (!finalPlaylist.is_public) {
    formatted.secret_token = finalPlaylist.secret_token || playlist.secret_token;
  }

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

  // Guard: generated playlists are immutable
  assertNotGenerated(playlist);

  // 2. Only owner can delete
  if (playlist.owner_user_id !== userId) {
    throw new AppError('You are not allowed to delete this playlist.', 403, 'PLAYLIST_FORBIDDEN');
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

  // Guard: generated playlists are immutable
  assertNotGenerated(playlist);

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

  const syncedPlaylist = await syncPlaylistCoverFromFirstTrack(playlistId);

  // 7. Return updated playlist with all tracks
  const tracks = await playlistModel.findPlaylistTracks(playlistId);
  const formatted = formatPlaylist(syncedPlaylist || playlist);
  return {
    playlist: {
      ...formatted,
      track_count: tracks.length,
      tracks,
    },
  };
};

// ============================================================
// ENDPOINT 7 — GET /playlists/:playlist_id/tracks
// ============================================================
exports.getPlaylistTracks = async ({ playlistId, userId, secretToken, page, limit }) => {
  // 1. Fetch playlist to verify it exists and check access
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // 2. Privacy check
  if (!playlist.is_public) {
    const isOwner = userId && playlist.owner_user_id === userId;
    const hasToken = secretToken && secretToken === playlist.secret_token;
    if (!isOwner && !hasToken) {
      throw new AppError('You do not have access to this playlist.', 403, 'PLAYLIST_ACCESS_DENIED');
    }
  }

  // 3. Pagination
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  // 4. Fetch paginated tracks + full-playlist total duration in parallel
  const [{ rows, total }, totalDurationSeconds] = await Promise.all([
    playlistModel.findPlaylistTracksPaginated(playlistId, { limit: parsedLimit, offset }),
    playlistModel.getTotalDuration(playlistId),
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  return {
    playlist_id: playlistId,
    total_duration_seconds: totalDurationSeconds,
    tracks: rows,
    pagination: {
      page: parsedPage,
      per_page: parsedLimit,
      total_items: total,
      total_pages: totalPages,
      has_next: parsedPage < totalPages,
      has_prev: parsedPage > 1,
    },
  };
};

// ============================================================
// ENDPOINT 8 — PATCH /playlists/:playlist_id/tracks/reorder
// ============================================================
exports.reorderPlaylistTracks = async ({ playlistId, userId, items }) => {
  // 1. Fetch playlist
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // Guard: generated playlists are immutable
  assertNotGenerated(playlist);

  // 2. Only owner can reorder
  if (playlist.owner_user_id !== userId) {
    throw new AppError('You are not allowed to modify this playlist.', 403, 'PLAYLIST_FORBIDDEN');
  }

  // 3. items must be an array
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items must be a non-empty array.', 400, 'VALIDATION_FAILED');
  }

  // 4. Must provide full list
  const existingIds = await playlistModel.getAllTracksInPlaylist(playlistId);
  if (items.length !== existingIds.length) {
    throw new AppError(
      'Reorder requires the full list of playlist tracks.',
      422,
      'PLAYLIST_REORDER_REQUIRES_FULL_LIST'
    );
  }

  // 5. All track_ids must exist in playlist
  const incomingIds = items.map((i) => i.track_id);
  const missing = incomingIds.filter((id) => !existingIds.includes(id));
  if (missing.length > 0) {
    throw new AppError(
      'One or more tracks are not in this playlist.',
      404,
      'PLAYLIST_TRACK_NOT_FOUND'
    );
  }

  // 6. Positions must be 1..N with no gaps and no duplicates
  const positions = items.map((i) => i.position).sort((a, b) => a - b);
  const isValid = positions.every((p, i) => p === i + 1);
  if (!isValid) {
    throw new AppError(
      'Positions must start at 1 with no gaps and no duplicates.',
      422,
      'PLAYLIST_POSITIONS_INVALID'
    );
  }

  // 7. Perform reorder in a transaction
  await playlistModel.reorderTracks(playlistId, items);

  await syncPlaylistCoverFromFirstTrack(playlistId);

  // 8. Return updated track list
  const { rows, total } = await playlistModel.findPlaylistTracksPaginated(playlistId, {
    limit: 100,
    offset: 0,
  });

  return {
    playlist_id: playlistId,
    tracks: rows,
    total,
  };
};

// ============================================================
// ENDPOINT 7 — DELETE /playlists/:playlist_id/tracks/:track_id
// ============================================================

/**
 * Removes a track from a playlist and re-normalizes positions.
 * - Owner only
 * - Returns 404 if track is not in the playlist
 * - Re-normalizes positions after removal (1..N, no gaps)
 */
exports.removeTrack = async ({ playlistId, userId, trackId }) => {
  // 1. Fetch playlist
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // Guard: generated playlists are immutable
  assertNotGenerated(playlist);

  // 2. Owner check
  checkOwner(playlist, userId);

  // 3. Remove the track — returns false if it wasn't in the playlist
  const removed = await playlistModel.removeTrackFromPlaylist(playlistId, trackId);
  if (!removed) {
    throw new AppError('Track not found in this playlist.', 404, 'PLAYLIST_TRACK_NOT_FOUND');
  }

  const syncedPlaylist = await syncPlaylistCoverFromFirstTrack(playlistId);

  // 4. Return updated playlist with all remaining tracks
  const tracks = await playlistModel.findPlaylistTracks(playlistId);
  const formatted = formatPlaylist(syncedPlaylist || playlist);
  return {
    playlist: {
      ...formatted,
      track_count: tracks.length,
      tracks,
    },
  };
};

// ============================================================
// ENDPOINT 8 — GET /playlists/:playlist_id/embed
// ============================================================
exports.getEmbed = async ({ playlistId, userId, secretToken, theme, autoplay, width, height }) => {
  // 1. Fetch playlist
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // 2. Access check — same logic as getPlaylist
  checkAccess(playlist, userId, secretToken);

  // 3. Sanitize & clamp query params
  const safeWidth = Math.min(1200, Math.max(200, parseInt(width) || 600));
  const safeHeight = Math.min(600, Math.max(100, parseInt(height) || 200));
  const safeTheme = ['light', 'dark'].includes(theme) ? theme : 'light';
  const safeAutoplay = autoplay === 'true' || autoplay === true ? 'true' : 'false';

  // 4. Build embed URL and iframe HTML
  // [TODO: update CLIENT_URL when domain is finalized — currently uses env var]
  const env = require('../config/env');
  const baseUrl = env.CLIENT_URL || 'http://localhost:8080';
  const embedUrl = `${baseUrl}/embed/playlists/${playlistId}?theme=${safeTheme}&autoplay=${safeAutoplay}`;
  const iframeHtml = `<iframe src='${embedUrl}' width='${safeWidth}' height='${safeHeight}' frameborder='0' allow='autoplay'></iframe>`;

  return {
    embed_url: embedUrl,
    iframe_html: iframeHtml,
  };
};

// ============================================================
// ENDPOINT — GET /users/{user_id}/playlists
// ============================================================
exports.getUserPlaylists = async ({ targetUserId, limit, offset, requesterId }) => {
  await verifyUserAccess(targetUserId, requesterId);

  // We reuse the existing listPlaylists method, telling it exactly what to fetch!
  return exports.listPlaylists({
    requesterId,
    ownerUserId: targetUserId,
    subtype: 'playlist',
    limit,
    offset,
  });
};

// ============================================================
// ENDPOINT — GET /users/{user_id}/albums
// ============================================================
exports.getUserAlbums = async ({ targetUserId, limit, offset, requesterId }) => {
  await verifyUserAccess(targetUserId, requesterId);

  // By passing isAlbumView: true, your existing model handles all the subtype logic
  return exports.listPlaylists({
    requesterId,
    ownerUserId: targetUserId,
    isAlbumView: true,
    limit,
    offset,
  });
};

// ============================================================
// Private helper — fetch the live tracks for a generated playlist
// ============================================================
async function fetchGeneratedTracks(playlist, userId) {
  const type = playlist.type;
  const genreId = playlist.genre_id ?? null;

  // Genre mix types
  if (['auto_generated', 'genre_trending'].includes(type)) {
    if (!genreId) return [];
    const tracks = await findTracksByGenreId(genreId, 50, userId);
    return Array.isArray(tracks) ? tracks : [];
  }

  // Daily mix types
  if (type === 'curated_daily') {
    const tracks = await getDailyTracks(30, userId);
    return Array.isArray(tracks) ? tracks : [];
  }

  // Weekly mix types
  if (type === 'curated_weekly') {
    const tracks = await getWeeklyTracks(userId, 50);
    return Array.isArray(tracks) ? tracks : [];
  }

  return [];
}

// ============================================================
// ENDPOINT — POST /playlists/:playlist_id/convert
// Snapshot a generated playlist into a real regular playlist.
// ============================================================
exports.convertPlaylist = async ({ playlistId, userId, name, isPublic }) => {
  // 1. Load seed playlist
  const playlist = await playlistModel.findPlaylistById(playlistId);
  if (!playlist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  // 2. Must belong to the requesting user
  if (playlist.owner_user_id !== userId) {
    throw new AppError('You do not have access to this playlist.', 403, 'PLAYLIST_FORBIDDEN');
  }

  // 3. Must be a generated type
  if (!GENERATED_PLAYLIST_TYPES.includes(playlist.type)) {
    throw new AppError('Only generated playlists can be converted.', 422, 'PLAYLIST_NOT_GENERATED');
  }

  // 4. Validate name
  if (!name || String(name).trim().length === 0) {
    throw new AppError('Playlist name is required.', 400, 'VALIDATION_FAILED');
  }

  await assertCanCreatePlaylist(userId);

  // 5. Fetch live tracks from the correct source
  const tracks = await fetchGeneratedTracks(playlist, userId);

  // 6. Create new regular playlist
  const secretToken = generateSecretToken();
  const baseSlug = generateSlug(String(name).trim());
  const slug = await makeUniqueSlug(baseSlug);

  const newPlaylist = await playlistModel.create({
    userId,
    name: String(name).trim(),
    isPublic: isPublic ?? false,
    secretToken,
    subtype: 'playlist',
    slug,
  });

  // 7. Bulk insert tracks with sequential positions
  if (tracks.length > 0) {
    await playlistModel.bulkInsertTracks(newPlaylist.id, tracks);
  }

  // 8. Like the new playlist (mirrors the like held on the seed)
  await db.query(
    `INSERT INTO playlist_likes (user_id, playlist_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, playlist_id) DO NOTHING`,
    [userId, newPlaylist.id]
  );

  // 9. Remove like from seed playlist (FK: must happen before seed deletion)
  await db.query(`DELETE FROM playlist_likes WHERE user_id = $1 AND playlist_id = $2`, [
    userId,
    playlistId,
  ]);

  // 10. Hard delete the seed row
  await playlistModel.hardDelete(playlistId);

  // 11. Return new playlist with tracks
  const formatted = formatPlaylist(newPlaylist);
  formatted.tracks = await playlistModel.findPlaylistTracks(newPlaylist.id);
  formatted.track_count = formatted.tracks.length;

  if (!isPublic) {
    formatted.secret_token = newPlaylist.secret_token;
  }

  return { playlist: formatted };
};
