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
const LISTENING_HISTORY_DEDUPE_WINDOW_SECONDS = 30;
const MAX_LISTENING_HISTORY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LISTENING_HISTORY_FUTURE_SKEW_MS = 5 * 60 * 1000;

// ============================================================
// validation helpers
// ============================================================

/* Validates UUID inputs before any playback lookup reaches the data layer. */
const assertValidUuid = (value, fieldName) => {
  if (!isUuid(value)) {
    throw new AppError(`${fieldName} must be a valid UUID.`, 400, 'VALIDATION_FAILED');
  }
};

/* Parses offset-style pagination values and enforces the endpoint bounds used across the backend. */
const parsePaginationNumber = ({ value, field, defaultValue, min, max = null }) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  const exceedsMax = max !== null && parsed > max;

  if (!Number.isInteger(parsed) || parsed < min || exceedsMax) {
    if (field === 'limit') {
      throw new AppError('limit must be an integer between 1 and 100.', 400, 'VALIDATION_FAILED');
    }

    throw new AppError(
      'offset must be an integer greater than or equal to 0.',
      400,
      'VALIDATION_FAILED'
    );
  }

  return parsed;
};

/* Parses and validates the required played_at timestamp for listening-history writes. */
const parsePlayedAt = (value) => {
  if (value === undefined || value === null || value === '') {
    throw new AppError('played_at is required.', 400, 'VALIDATION_FAILED');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('played_at must be a valid datetime.', 400, 'VALIDATION_FAILED');
  }

  return parsed;
};

/* Validates optional duration payloads so analytics writes stay non-negative integers. */
const parseDurationPlayedSeconds = (value) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(
      'duration_played_seconds must be an integer greater than or equal to 0.',
      400,
      'VALIDATION_FAILED'
    );
  }

  return parsed;
};

/* Enforces the offline-sync time window so only recent plays are accepted. */
const assertPlayedAtWithinAllowedWindow = (playedAt) => {
  const now = Date.now();
  const playedAtMs = playedAt.getTime();

  if (playedAtMs < now - MAX_LISTENING_HISTORY_AGE_MS) {
    throw new AppError(
      'played_at must not be more than 7 days in the past.',
      400,
      'VALIDATION_FAILED'
    );
  }

  if (playedAtMs > now + MAX_LISTENING_HISTORY_FUTURE_SKEW_MS) {
    throw new AppError('played_at must not be in the future.', 400, 'VALIDATION_FAILED');
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

/* Loads the track, enforces access rules, and returns the resolved playback-state in one shared flow. */
const resolvePlaybackAccess = async ({ trackId, requesterUserId = null, secretToken = null }) => {
  assertValidUuid(trackId, 'track_id');

  const track = await playbackModel.findTrackByIdForPlaybackState(trackId);

  assertTrackPlaybackAccess(track, requesterUserId, secretToken);

  return {
    track,
    playbackState: resolveTrackPlaybackState(track),
  };
};

/* Loads a track for explicit history writes and normalizes inaccessible/private cases to 404. */
const resolveListeningHistoryAccess = async ({ trackId, requesterUserId }) => {
  assertValidUuid(trackId, 'track_id');

  const track = await playbackModel.findTrackByIdForPlaybackState(trackId);

  try {
    assertTrackPlaybackAccess(track, requesterUserId, null);
  } catch (err) {
    if (err.code === 'RESOURCE_PRIVATE' || err.code === 'TRACK_NOT_FOUND') {
      throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
    }
    throw err;
  }

  return track;
};

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
// play-recording helpers
// ============================================================

/* Converts resolved playback states into endpoint-specific operational outcomes for /play. */
const assertPlayablePlaybackState = (playbackState) => {
  if (playbackState.state === 'processing') {
    throw new AppError(
      'Track is still processing. Please retry shortly.',
      202,
      'BUSINESS_OPERATION_NOT_ALLOWED'
    );
  }

  if (playbackState.state === 'failed') {
    throw new AppError('Track processing failed', 503, 'UPLOAD_PROCESSING_FAILED');
  }

  if (playbackState.state === 'blocked') {
    throw new AppError(
      'Playback is blocked for this track.',
      403,
      'BUSINESS_OPERATION_NOT_ALLOWED'
    );
  }

  if (playbackState.state === 'unavailable') {
    throw new AppError('No playable audio available', 500, 'STREAM_URL_MISSING');
  }
};

/* Persists listening history only for authenticated successful plays so DB triggers handle play counts. */
const recordListeningHistoryIfNeeded = async ({ requesterUserId, playbackState }) => {
  if (!requesterUserId) {
    return null;
  }

  if (playbackState.state !== 'playable' && playbackState.state !== 'preview') {
    return null;
  }

  return playbackModel.insertListeningHistory({
    userId: requesterUserId,
    trackId: playbackState.track_id,
  });
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

/* Returns the authenticated user's paginated deduplicated recently played tracks. */
exports.getRecentlyPlayed = async ({ userId, limit, offset }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const parsedLimit = parsePaginationNumber({
    value: limit,
    field: 'limit',
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  const parsedOffset = parsePaginationNumber({
    value: offset,
    field: 'offset',
    defaultValue: 0,
    min: 0,
  });

  const [items, total] = await Promise.all([
    playbackModel.findRecentlyPlayedByUserId(userId, parsedLimit, parsedOffset),
    playbackModel.countRecentlyPlayedByUserId(userId),
  ]);

  return {
    data: items,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Deletes all listening history rows for the authenticated user without failing on empty history. */
exports.clearListeningHistory = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  return playbackModel.deleteListeningHistoryByUserId(userId);
};

/* Records one authenticated listening history write while deduplicating retries in a 30-second window. */
exports.writeListeningHistory = async ({ userId, trackId, playedAt, durationPlayedSeconds }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  if (!trackId) {
    throw new AppError('track_id is required.', 400, 'VALIDATION_FAILED');
  }

  assertValidUuid(trackId, 'track_id');

  const parsedPlayedAt = parsePlayedAt(playedAt);
  const normalizedDurationPlayedSeconds = parseDurationPlayedSeconds(durationPlayedSeconds);

  assertPlayedAtWithinAllowedWindow(parsedPlayedAt);
  await resolveListeningHistoryAccess({ trackId, requesterUserId: userId });

  const existingEntry = await playbackModel.findRecentListeningHistoryEntry({
    userId,
    trackId,
    playedAt: parsedPlayedAt.toISOString(),
    windowSeconds: LISTENING_HISTORY_DEDUPE_WINDOW_SECONDS,
  });

  if (existingEntry) {
    return {
      created: false,
      data: { success: true },
      message: 'Listening history entry already recorded recently.',
    };
  }

  await playbackModel.insertListeningHistory({
    userId,
    trackId,
    durationPlayed: normalizedDurationPlayedSeconds,
    playedAt: parsedPlayedAt.toISOString(),
  });

  return {
    created: true,
    data: { success: true },
    message: 'Listening history entry recorded.',
  };
};

/* Returns the authenticated user's paginated play-by-play listening history. */
exports.getListeningHistory = async ({ userId, limit, offset }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const parsedLimit = parsePaginationNumber({
    value: limit,
    field: 'limit',
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  const parsedOffset = parsePaginationNumber({
    value: offset,
    field: 'offset',
    defaultValue: 0,
    min: 0,
  });

  const [items, total] = await Promise.all([
    playbackModel.findListeningHistoryByUserId(userId, parsedLimit, parsedOffset),
    playbackModel.countListeningHistoryByUserId(userId),
  ]);

  return {
    data: items,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Resolves playback accessibility for a track without recording a play or writing any state. */
exports.getPlaybackState = async ({ trackId, requesterUserId = null, secretToken = null }) => {
  const { playbackState } = await resolvePlaybackAccess({
    trackId,
    requesterUserId,
    secretToken,
  });

  return playbackState;
};

/* Resolves a play request, records listening history when applicable, and returns the playback payload. */
exports.playTrack = async ({ trackId, requesterUserId = null, secretToken = null }) => {
  const { playbackState } = await resolvePlaybackAccess({
    trackId,
    requesterUserId,
    secretToken,
  });

  assertPlayablePlaybackState(playbackState);
  await recordListeningHistoryIfNeeded({ requesterUserId, playbackState });

  return playbackState;
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
