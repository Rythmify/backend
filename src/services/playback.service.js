// ============================================================
// services/playback.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const { randomUUID } = require('crypto');
const { validate: isUuid, v5: uuidv5 } = require('uuid');
const playerStateModel = require('../models/player-state.model');
const playbackModel = require('../models/playback.model');
const { QUEUE_BUCKETS, QUEUE_SOURCE_TYPES } = require('../constants/queue.constants');
const AppError = require('../utils/app-error');
const LISTENING_HISTORY_DEDUPE_WINDOW_SECONDS = 30;
const MAX_LISTENING_HISTORY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LISTENING_HISTORY_FUTURE_SKEW_MS = 5 * 60 * 1000;
const QUEUE_SOURCE_TYPE_ALIASES = new Map([
  ['system_mix', 'system'],
  ['station', 'system'],
  ['user_likes', 'system'],
  ['reposts', 'system'],
]);
const LEGACY_QUEUE_ITEM_NAMESPACE = '4a17d4bb-78d8-4f80-9fa8-c051f2a50ec2';

// ============================================================
// validation helpers
// ============================================================

/* Validates UUID inputs before any playback lookup reaches the data layer. */
const assertValidUuid = (value, fieldName) => {
  if (!isUuid(value)) {
    throw new AppError(`${fieldName} must be a valid UUID.`, 400, 'VALIDATION_FAILED');
  }
};

/* Restricts enum-like queue fields to the values the API currently supports. */
const assertAllowedValue = (value, fieldName, allowedValues) => {
  if (!allowedValues.has(value)) {
    throw new AppError(
      `${fieldName} must be one of: ${Array.from(allowedValues).join(', ')}.`,
      400,
      'VALIDATION_FAILED'
    );
  }
};

/* Distinguishes JSON-style payload objects from arrays and other complex values. */
const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

/* Normalizes nullable queue source types while keeping omitted fields backward-compatible. */
const normalizeQueueSourceType = (value, fieldName, defaultValue = 'track') => {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === null || value === '') {
    return null;
  }

  const normalizedValue = QUEUE_SOURCE_TYPE_ALIASES.get(value) || value;
  assertAllowedValue(normalizedValue, fieldName, QUEUE_SOURCE_TYPES);
  return normalizedValue;
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
const assertTimestampNotTooOldOrTooFarInFuture = ({
  date,
  fieldName,
  maxPastAgeMs = null,
  allowFutureSkewMs = MAX_LISTENING_HISTORY_FUTURE_SKEW_MS,
}) => {
  const now = Date.now();
  const timestampMs = date.getTime();

  if (maxPastAgeMs !== null && timestampMs < now - maxPastAgeMs) {
    throw new AppError(
      `${fieldName} must not be more than 7 days in the past.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  if (timestampMs > now + allowFutureSkewMs) {
    throw new AppError(`${fieldName} must not be in the future.`, 400, 'VALIDATION_FAILED');
  }
};

/* Enforces the offline-sync time window so only recent plays are accepted. */
const assertPlayedAtWithinAllowedWindow = (playedAt) =>
  assertTimestampNotTooOldOrTooFarInFuture({
    date: playedAt,
    fieldName: 'played_at',
    maxPastAgeMs: MAX_LISTENING_HISTORY_AGE_MS,
  });

/* Parses and validates current_state.state_updated_at for reconnect sync payloads. */
const parseStateUpdatedAt = (value) => {
  if (value === undefined || value === null || value === '') {
    throw new AppError('current_state.state_updated_at is required.', 400, 'VALIDATION_FAILED');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      'current_state.state_updated_at must be a valid datetime.',
      400,
      'VALIDATION_FAILED'
    );
  }

  assertTimestampNotTooOldOrTooFarInFuture({
    date: parsed,
    fieldName: 'current_state.state_updated_at',
  });

  return parsed;
};

/* Normalizes nullable UUID fields used by richer queue metadata. */
const normalizeOptionalUuid = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  assertValidUuid(value, fieldName);
  return value;
};

/* Normalizes nullable non-negative integer queue metadata fields. */
const normalizeOptionalNonNegativeInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(
      `${fieldName} must be an integer greater than or equal to 0.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  return parsed;
};

/* Preserves valid queue timestamps and fills any missing/invalid timestamps with a generated ISO value. */
const normalizeQueueAddedAt = (value, fallbackTimestamp) => {
  if (value === undefined || value === null || value === '') {
    return fallbackTimestamp;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackTimestamp;
  }

  return parsed.toISOString();
};

/* Produces stable UUIDs for legacy queue entries that were stored without queue_item_id values. */
const buildLegacyQueueItemId = (kind, signature, occurrence) =>
  uuidv5(`${kind}:${signature}:${occurrence}`, LEGACY_QUEUE_ITEM_NAMESPACE);

/* Counts repeated legacy queue signatures so deterministic IDs stay unique within one queue snapshot. */
const nextLegacyQueueItemOccurrence = (occurrences, key) => {
  const nextOccurrence = (occurrences.get(key) || 0) + 1;
  occurrences.set(key, nextOccurrence);
  return nextOccurrence;
};

/* Normalizes queue-item fields other than queue_item_id so legacy and modern payloads share one shape. */
const normalizeQueueItemFields = (queueItem, fallbackTimestamp) => {
  if (!isPlainObject(queueItem)) {
    throw new AppError(
      'Each queue item must be a UUID string or object.',
      400,
      'VALIDATION_FAILED'
    );
  }

  if (!queueItem.track_id) {
    throw new AppError('queue item track_id is required.', 400, 'VALIDATION_FAILED');
  }
  assertValidUuid(queueItem.track_id, 'queue item track_id');

  const queueBucket = queueItem.queue_bucket ?? 'next_up';

  assertAllowedValue(queueBucket, 'queue item queue_bucket', QUEUE_BUCKETS);

  return {
    track_id: queueItem.track_id,
    queue_bucket: queueBucket,
    source_type: normalizeQueueSourceType(queueItem.source_type, 'queue item source_type', 'track'),
    source_id: normalizeOptionalUuid(queueItem.source_id, 'queue item source_id'),
    source_position: normalizeOptionalNonNegativeInteger(
      queueItem.source_position,
      'queue item source_position'
    ),
    added_at: normalizeQueueAddedAt(queueItem.added_at, fallbackTimestamp),
  };
};

/* Normalizes one modern queue-item object while preserving any provided metadata that validates. */
const normalizeQueueItemObject = (
  queueItem,
  fallbackTimestamp,
  generatedQueueItemId = randomUUID()
) => {
  if (
    queueItem.queue_item_id !== undefined &&
    queueItem.queue_item_id !== null &&
    queueItem.queue_item_id !== ''
  ) {
    assertValidUuid(queueItem.queue_item_id, 'queue item queue_item_id');
  }

  return {
    queue_item_id: queueItem.queue_item_id || generatedQueueItemId,
    ...normalizeQueueItemFields(queueItem, fallbackTimestamp),
  };
};

/* Accepts both legacy queue UUID strings and richer queue objects, then returns normalized queue items. */
const normalizeQueue = (queue) => {
  if (queue === undefined) {
    return [];
  }

  if (!Array.isArray(queue)) {
    throw new AppError('queue must be an array.', 400, 'VALIDATION_FAILED');
  }

  const fallbackTimestamp = new Date().toISOString();
  const legacyQueueItemOccurrences = new Map();

  return queue.map((queueItem) => {
    if (typeof queueItem === 'string') {
      assertValidUuid(queueItem, 'queue item');
      const occurrence = nextLegacyQueueItemOccurrence(
        legacyQueueItemOccurrences,
        `legacy-string:${queueItem}`
      );

      return {
        queue_item_id: buildLegacyQueueItemId('legacy-string', queueItem, occurrence),
        track_id: queueItem,
        queue_bucket: 'next_up',
        source_type: 'track',
        source_id: null,
        source_position: null,
        added_at: fallbackTimestamp,
      };
    }

    if (
      queueItem &&
      typeof queueItem === 'object' &&
      !Array.isArray(queueItem) &&
      !queueItem.queue_item_id
    ) {
      const normalizedQueueItemFields = normalizeQueueItemFields(queueItem, fallbackTimestamp);
      const signature = JSON.stringify([
        normalizedQueueItemFields.track_id,
        normalizedQueueItemFields.queue_bucket,
        normalizedQueueItemFields.source_type,
        normalizedQueueItemFields.source_id,
        normalizedQueueItemFields.source_position,
      ]);
      const occurrence = nextLegacyQueueItemOccurrence(
        legacyQueueItemOccurrences,
        `legacy-object:${signature}`
      );

      return {
        queue_item_id: buildLegacyQueueItemId('legacy-object', signature, occurrence),
        ...normalizedQueueItemFields,
      };
    }

    return normalizeQueueItemObject(queueItem, fallbackTimestamp);
  });
};

/* Batch-validates the player-state track plus every queued track so queue saves stay exact and cheap. */
const assertReferencedTracksExist = async (trackIds) => {
  const uniqueTrackIds = [...new Set(trackIds)];
  const existingTrackIds = await playerStateModel.findExistingTrackIds(uniqueTrackIds);
  const existingTrackIdSet = new Set(existingTrackIds.map((trackId) => trackId.toLowerCase()));

  if (uniqueTrackIds.some((trackId) => !existingTrackIdSet.has(trackId.toLowerCase()))) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }
};

/* Normalizes stored queue payloads on read so GET responses always expose queue objects. */
const normalizeStoredPlayerState = (playerState) => {
  if (!playerState) {
    return null;
  }

  return {
    ...playerState,
    queue: normalizeQueue(playerState.queue ?? []),
  };
};

/* Validates and normalizes the queue-mutation payload for inserting one item into the upcoming queue. */
const validateAndNormalizeNextUpPayload = async ({ trackId, insertAfterQueueItemId }) => {
  if (!trackId) {
    throw new AppError('track_id is required.', 400, 'VALIDATION_FAILED');
  }
  assertValidUuid(trackId, 'track_id');

  if (
    insertAfterQueueItemId !== undefined &&
    insertAfterQueueItemId !== null &&
    insertAfterQueueItemId !== ''
  ) {
    assertValidUuid(insertAfterQueueItemId, 'insert_after_queue_item_id');
  }

  return {
    trackId,
    insertAfterQueueItemId:
      insertAfterQueueItemId === undefined ||
      insertAfterQueueItemId === null ||
      insertAfterQueueItemId === ''
        ? null
        : insertAfterQueueItemId,
  };
};

/* Finds the insertion point for a new Next Up item while preserving the stored queue order. */
const resolveNextUpInsertionIndex = ({ queue, insertAfterQueueItemId }) => {
  if (insertAfterQueueItemId) {
    const existingIndex = queue.findIndex(
      (queueItem) => queueItem.queue_item_id === insertAfterQueueItemId
    );

    if (existingIndex === -1) {
      throw new AppError('Queue item not found.', 404, 'QUEUE_ITEM_NOT_FOUND');
    }

    return existingIndex + 1;
  }

  const firstContextIndex = queue.findIndex((queueItem) => queueItem.queue_bucket === 'context');
  return firstContextIndex === -1 ? queue.length : firstContextIndex;
};

/* Builds one normalized Next Up queue item with server-owned identifiers and timestamps. */
const buildNextUpQueueItem = ({ trackId }) => ({
  queue_item_id: randomUUID(),
  track_id: trackId,
  queue_bucket: 'next_up',
  source_type: 'track',
  source_id: null,
  source_position: null,
  added_at: new Date().toISOString(),
});

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

/* Validates and normalizes one listening-history sync event before any writes are attempted. */
const validateAndNormalizeHistoryEvent = async ({ userId, event }) => {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new AppError('Each history_events item must be an object.', 400, 'VALIDATION_FAILED');
  }

  if (!event.track_id) {
    throw new AppError('track_id is required.', 400, 'VALIDATION_FAILED');
  }

  assertValidUuid(event.track_id, 'track_id');

  const parsedPlayedAt = parsePlayedAt(event.played_at);
  const normalizedDurationPlayedSeconds = parseDurationPlayedSeconds(event.duration_played_seconds);

  assertPlayedAtWithinAllowedWindow(parsedPlayedAt);
  await resolveListeningHistoryAccess({ trackId: event.track_id, requesterUserId: userId });

  return {
    trackId: event.track_id,
    playedAt: parsedPlayedAt.toISOString(),
    durationPlayedSeconds: normalizedDurationPlayedSeconds,
  };
};

/* Reuses the existing write dedupe semantics for one validated sync history event. */
const syncListeningHistoryEvent = async ({ userId, trackId, playedAt, durationPlayedSeconds }) => {
  const existingEntry = await playbackModel.findRecentListeningHistoryEntry({
    userId,
    trackId,
    playedAt,
    windowSeconds: LISTENING_HISTORY_DEDUPE_WINDOW_SECONDS,
  });

  if (existingEntry) {
    return { created: false };
  }

  await playbackModel.insertListeningHistory({
    userId,
    trackId,
    durationPlayed: durationPlayedSeconds,
    playedAt,
  });

  return { created: true };
};

/* Validates and normalizes player-state payloads shared by online saves and reconnect sync. */
const validateAndNormalizePlayerStatePayload = async ({
  trackId,
  positionSeconds,
  volume,
  queue,
}) => {
  if (!trackId) {
    throw new AppError('track_id is required.', 400, 'VALIDATION_FAILED');
  }
  assertValidUuid(trackId, 'track_id');

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

  const normalizedQueue = normalizeQueue(queue);

  await assertReferencedTracksExist([
    trackId,
    ...normalizedQueue.map((queueItem) => queueItem.track_id),
  ]);

  return {
    trackId,
    positionSeconds: normalizedPositionSeconds,
    volume: normalizedVolume,
    queue: normalizedQueue,
  };
};

/* Maps the current resume position to the integer progress proxy stored on listening_history rows. */
const toListeningHistoryProgressSeconds = (positionSeconds) =>
  Math.max(0, Math.floor(positionSeconds));

/* Normalizes the optional playback sync envelope and rejects empty sync requests early. */
const validatePlaybackSyncPayloadShape = ({ historyEvents, currentState }) => {
  const normalizedHistoryEvents =
    historyEvents === undefined || historyEvents === null ? [] : historyEvents;
  const normalizedCurrentState =
    currentState === undefined || currentState === null ? null : currentState;

  if (!Array.isArray(normalizedHistoryEvents)) {
    throw new AppError('history_events must be an array.', 400, 'VALIDATION_FAILED');
  }

  if (
    normalizedCurrentState !== null &&
    (typeof normalizedCurrentState !== 'object' || Array.isArray(normalizedCurrentState))
  ) {
    throw new AppError('current_state must be an object.', 400, 'VALIDATION_FAILED');
  }

  if (!normalizedHistoryEvents.length && !normalizedCurrentState) {
    throw new AppError(
      'At least one of history_events or current_state must be provided.',
      400,
      'VALIDATION_FAILED'
    );
  }

  return {
    historyEvents: normalizedHistoryEvents,
    currentState: normalizedCurrentState,
  };
};

// ============================================================
// exported service functions
// ============================================================

/* Returns the saved player state for an authenticated user. */
exports.getPlayerState = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const playerState = await playerStateModel.findByUserId(userId);
  return normalizeStoredPlayerState(playerState);
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

/* Syncs offline listening-history events and the latest player state after reconnect. */
exports.syncPlayback = async ({ userId, historyEvents, currentState }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const normalizedPayload = validatePlaybackSyncPayloadShape({ historyEvents, currentState });
  const validatedHistoryEvents = [];

  for (const event of normalizedPayload.historyEvents) {
    validatedHistoryEvents.push(await validateAndNormalizeHistoryEvent({ userId, event }));
  }

  validatedHistoryEvents.sort((left, right) => new Date(left.playedAt) - new Date(right.playedAt));

  let validatedCurrentState = null;
  if (normalizedPayload.currentState) {
    const normalizedPlayerState = await validateAndNormalizePlayerStatePayload({
      trackId: normalizedPayload.currentState.track_id,
      positionSeconds: normalizedPayload.currentState.position_seconds,
      volume: normalizedPayload.currentState.volume,
      queue: normalizedPayload.currentState.queue,
    });

    validatedCurrentState = {
      ...normalizedPlayerState,
      stateUpdatedAt: parseStateUpdatedAt(
        normalizedPayload.currentState.state_updated_at
      ).toISOString(),
    };
  }

  let historyEventsRecorded = 0;
  let historyEventsDeduplicated = 0;

  for (const event of validatedHistoryEvents) {
    const result = await syncListeningHistoryEvent({
      userId,
      trackId: event.trackId,
      playedAt: event.playedAt,
      durationPlayedSeconds: event.durationPlayedSeconds,
    });

    if (result.created) {
      historyEventsRecorded += 1;
    } else {
      historyEventsDeduplicated += 1;
    }
  }

  let syncedCurrentState = null;
  let currentStateSaved = false;
  let currentStateIgnoredAsStale = false;

  if (validatedCurrentState) {
    syncedCurrentState = await playerStateModel.upsertIfNewer({
      userId,
      trackId: validatedCurrentState.trackId,
      positionSeconds: validatedCurrentState.positionSeconds,
      volume: validatedCurrentState.volume,
      queue: validatedCurrentState.queue,
      updatedAt: validatedCurrentState.stateUpdatedAt,
    });

    if (syncedCurrentState) {
      syncedCurrentState = normalizeStoredPlayerState(syncedCurrentState);
      currentStateSaved = true;
    } else {
      currentStateIgnoredAsStale = true;
      syncedCurrentState = normalizeStoredPlayerState(await playerStateModel.findByUserId(userId));
    }
  }

  return {
    history_events_received: validatedHistoryEvents.length,
    history_events_recorded: historyEventsRecorded,
    history_events_deduplicated: historyEventsDeduplicated,
    current_state_saved: currentStateSaved,
    current_state_ignored_as_stale: currentStateIgnoredAsStale,
    current_state: syncedCurrentState,
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

  const normalizedPlayerState = await validateAndNormalizePlayerStatePayload({
    trackId,
    positionSeconds,
    volume,
    queue,
  });

  const savedPlayerState = await playerStateModel.upsert({
    userId,
    trackId: normalizedPlayerState.trackId,
    positionSeconds: normalizedPlayerState.positionSeconds,
    volume: normalizedPlayerState.volume,
    queue: normalizedPlayerState.queue,
  });

  const recentHistoryEntry = await playbackModel.findLatestListeningHistoryEntryByUserAndTrack({
    userId,
    trackId: normalizedPlayerState.trackId,
    playedAfter: new Date(Date.now() - MAX_LISTENING_HISTORY_AGE_MS).toISOString(),
  });

  if (recentHistoryEntry) {
    await playbackModel.updateListeningHistoryProgress({
      historyId: recentHistoryEntry.id,
      progressSeconds: toListeningHistoryProgressSeconds(normalizedPlayerState.positionSeconds),
    });
  }

  return savedPlayerState;
};

/* Inserts one item into the authenticated user's Next Up queue without changing the current track. */
exports.addToNextUp = async ({ userId, trackId, insertAfterQueueItemId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const normalizedPayload = await validateAndNormalizeNextUpPayload({
    trackId,
    insertAfterQueueItemId,
  });
  await resolvePlaybackAccess({
    trackId: normalizedPayload.trackId,
    requesterUserId: userId,
    secretToken: null,
  });

  const existingPlayerState = await playerStateModel.findStateRowByUserId(userId);
  const normalizedExistingQueue = normalizeQueue(existingPlayerState?.queue ?? []);
  const insertionIndex = resolveNextUpInsertionIndex({
    queue: normalizedExistingQueue,
    insertAfterQueueItemId: normalizedPayload.insertAfterQueueItemId,
  });
  const nextUpQueueItem = buildNextUpQueueItem({
    trackId: normalizedPayload.trackId,
  });
  const updatedQueue = [...normalizedExistingQueue];

  updatedQueue.splice(insertionIndex, 0, nextUpQueueItem);

  const savedPlayerState = await playerStateModel.upsert({
    userId,
    trackId: existingPlayerState?.track_id ?? null,
    positionSeconds: existingPlayerState?.position_seconds ?? 0,
    volume: existingPlayerState?.volume ?? 1,
    queue: updatedQueue,
  });

  return {
    queue: normalizeStoredPlayerState(savedPlayerState).queue,
  };
};
