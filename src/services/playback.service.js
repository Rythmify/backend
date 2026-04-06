// ============================================================
// services/playback.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const { validate: isUuid } = require('uuid');
const playerStateModel = require('../models/player-state.model');
const playbackModel = require('../models/playback.model');
const AppError = require('../utils/app-error');

// ============================================================
// validation helpers
// ============================================================

/* Validates UUID inputs before any playback lookup reaches the data layer. */
const assertValidUuid = (value, fieldName) => {
  if (!isUuid(value)) {
    throw new AppError(`${fieldName} must be a valid UUID.`, 400, 'VALIDATION_FAILED');
  }
};

// ============================================================
// requester/access helpers
// ============================================================

/* Checks whether the requester owns the track and can bypass listener-only visibility rules. */
const isTrackOwner = (track, requesterUserId) =>
  requesterUserId && requesterUserId === track.user_id;

/* Verifies whether a supplied private share token grants access to a private track. */
const hasValidPrivateLink = (track, secretToken) =>
  !track.is_public && !!secretToken && !!track.secret_token && secretToken === track.secret_token;

/* Enforces hidden and private access rules so playback-state matches track privacy behavior. */
const assertTrackPlaybackAccess = (track, requesterUserId, secretToken) => {
  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const owner = isTrackOwner(track, requesterUserId);
  const validPrivateLink = hasValidPrivateLink(track, secretToken);

  if (track.is_hidden && !owner) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (!track.is_public && !owner && !validPrivateLink) {
    throw new AppError('This track is private', 403, 'RESOURCE_PRIVATE');
  }
};

// ============================================================
// playback-state resolution helpers
// ============================================================

/* Shapes playback-state responses with explicit URLs and a stable reason field. */
const buildPlaybackState = ({
  trackId,
  state,
  streamUrl = null,
  previewUrl = null,
  reason = null,
}) => ({
  track_id: trackId,
  state,
  stream_url: streamUrl,
  preview_url: previewUrl,
  reason,
});

/* Resolves the ready-state playback outcome after access has already been granted. */
const resolveReadyPlaybackState = (track) => {
  if (track.enable_app_playback === false) {
    return buildPlaybackState({
      trackId: track.id,
      state: 'blocked',
      reason: 'app_playback_disabled',
    });
  }

  if (track.stream_url) {
    return buildPlaybackState({
      trackId: track.id,
      state: 'playable',
      streamUrl: track.stream_url,
      previewUrl: track.preview_url || null,
    });
  }

  if (track.preview_url) {
    return buildPlaybackState({
      trackId: track.id,
      state: 'preview',
      previewUrl: track.preview_url,
      reason: 'preview_only',
    });
  }

  return buildPlaybackState({
    trackId: track.id,
    state: 'unavailable',
    reason: 'playback_url_unavailable',
  });
};

/* Maps non-ready track statuses to non-playing playback-state responses. */
const resolveTrackPlaybackState = (track) => {
  if (track.status === 'processing') {
    return buildPlaybackState({
      trackId: track.id,
      state: 'processing',
      reason: 'track_processing',
    });
  }

  if (track.status === 'failed') {
    return buildPlaybackState({
      trackId: track.id,
      state: 'failed',
      reason: 'track_processing_failed',
    });
  }

  return resolveReadyPlaybackState(track);
};

// ============================================================
// exported service functions
// ============================================================

/* Returns the saved player state for an authenticated user. */
exports.getPlayerState = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  return playerStateModel.findByUserId(userId);
};

/* Resolves playback accessibility for a track without recording a play or writing any state. */
exports.getPlaybackState = async ({ trackId, requesterUserId = null, secretToken = null }) => {
  assertValidUuid(trackId, 'track_id');

  const track = await playbackModel.findTrackByIdForPlaybackState(trackId);

  assertTrackPlaybackAccess(track, requesterUserId, secretToken);

  return resolveTrackPlaybackState(track);
};

/* Saves a user's player state after validating track existence and payload integrity. */
exports.savePlayerState = async ({ userId, trackId, positionSeconds, volume, queue }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  if (!trackId) {
    throw new AppError('track_id is required.', 400, 'VALIDATION_FAILED');
  }
  assertValidUuid(trackId, 'track_id');

  const trackExists = await playerStateModel.trackExists(trackId);
  if (!trackExists) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (positionSeconds === undefined || positionSeconds === null || positionSeconds === '') {
    throw new AppError('position_seconds is required.', 400, 'VALIDATION_FAILED');
  }

  const normalizedPositionSeconds = Number(positionSeconds);
  if (!Number.isFinite(normalizedPositionSeconds) || normalizedPositionSeconds < 0) {
    throw new AppError(
      'position_seconds must be a number greater than or equal to 0.',
      400,
      'VALIDATION_FAILED'
    );
  }

  let normalizedVolume = 1;
  if (volume !== undefined) {
    normalizedVolume = Number(volume);
    if (!Number.isFinite(normalizedVolume) || normalizedVolume < 0 || normalizedVolume > 1) {
      throw new AppError('volume must be between 0 and 1.', 400, 'VALIDATION_FAILED');
    }
  }

  let normalizedQueue = [];
  if (queue !== undefined) {
    if (!Array.isArray(queue)) {
      throw new AppError('queue must be an array.', 400, 'VALIDATION_FAILED');
    }
    queue.forEach((queueTrackId) => assertValidUuid(queueTrackId, 'queue item'));
    normalizedQueue = queue;
  }

  return playerStateModel.upsert({
    userId,
    trackId,
    positionSeconds: normalizedPositionSeconds,
    volume: normalizedVolume,
    queue: normalizedQueue,
  });
};
