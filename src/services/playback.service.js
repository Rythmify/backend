// ============================================================
// services/playback.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const { randomUUID } = require('crypto');
const { v5: uuidv5 } = require('uuid');
const playerStateModel = require('../models/player-state.model');
const playbackModel = require('../models/playback.model');
const playlistsService = require('./playlists.service');
const feedService = require('./feed.service');
const trackLikesService = require('./track-likes.service');
const trackRepostsService = require('./track-reposts.service');
const tracksService = require('./tracks.service');
const usersService = require('./users.service');
const userModel = require('../models/user.model');
const {
  REGION_RESTRICTED_REASON,
  isTrackGeoBlocked,
  maskPlaybackUrlsForGeo,
} = require('../utils/geo-restrictions');
const {
  QUEUE_BUCKETS,
  QUEUE_SOURCE_TYPES,
  QUEUE_CONTEXT_SOURCE_TYPES,
  QUEUE_CONTEXT_INTERACTION_TYPES,
} = require('../constants/queue.constants');
const AppError = require('../utils/app-error');
const LISTENING_HISTORY_DEDUPE_WINDOW_SECONDS = 30;
const MAX_LISTENING_HISTORY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LISTENING_HISTORY_FUTURE_SKEW_MS = 5 * 60 * 1000;
const QUEUE_CONTEXT_BATCH_SIZE = 100;
const QUEUE_PLAYABLE_STATES = new Set(['playable', 'preview']);
const USER_SCOPED_QUEUE_SOURCE_TYPES = new Set([
  'liked_tracks',
  'listening_history',
  'reposts',
  'user_tracks',
]);
const ALBUM_LIKE_PLAYLIST_SUBTYPES = new Set(['album', 'ep', 'single', 'compilation']);
const QUEUE_SOURCE_TYPE_ALIASES = new Map([
  ['system_mix', 'mix'],
  ['user_likes', 'liked_tracks'],
]);
const LEGACY_QUEUE_ITEM_NAMESPACE = '4a17d4bb-78d8-4f80-9fa8-c051f2a50ec2';
const UUID_SHAPE_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EMPTY_TRACK_RESPONSE_METADATA = Object.freeze({
  stream_url: null,
  track_title: null,
  artist_name: null,
  duration: null,
  cover_image: null,
});

// ============================================================
// validation helpers
// ============================================================

/* Validates playback UUID inputs by hex-and-hyphen shape without enforcing RFC bits. */
const assertValidUuid = (value, fieldName) => {
  if (typeof value !== 'string' || !UUID_SHAPE_REGEX.test(value)) {
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

/* Normalizes optional free-form string fields while treating blank input as null. */
const normalizeOptionalString = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} must be a string.`, 400, 'VALIDATION_FAILED');
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
};

/* Validates source_id using the semantics of the associated source_type instead of UUID-only rules. */
const normalizeQueueSourceId = (sourceType, value, fieldName, { allowNull = true } = {}) => {
  const normalizedValue = normalizeOptionalString(value, fieldName);

  if (normalizedValue === null) {
    if (allowNull) {
      return null;
    }

    throw new AppError(`${fieldName} is required.`, 400, 'VALIDATION_FAILED');
  }

  if (sourceType === 'mix' || sourceType === 'system') {
    return normalizedValue;
  }

  assertValidUuid(normalizedValue, fieldName);
  return normalizedValue;
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
  const sourceType = normalizeQueueSourceType(
    queueItem.source_type,
    'queue item source_type',
    'track'
  );

  assertAllowedValue(queueBucket, 'queue item queue_bucket', QUEUE_BUCKETS);

  return {
    track_id: queueItem.track_id,
    queue_bucket: queueBucket,
    source_type: sourceType,
    source_id: normalizeQueueSourceId(sourceType, queueItem.source_id, 'queue item source_id'),
    source_title: normalizeOptionalString(queueItem.source_title, 'queue item source_title'),
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
        source_title: null,
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
        normalizedQueueItemFields.source_title,
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

/* Collects current and queued track ids so playback responses can batch-load metadata once. */
const collectPlayerStateTrackIds = (playerState) => {
  if (!playerState) {
    return [];
  }

  return [
    ...(playerState.track_id ? [playerState.track_id] : []),
    ...playerState.queue
      .map((queueItem) => queueItem?.track_id)
      .filter((trackId) => typeof trackId === 'string' && trackId),
  ];
};

/* Resolves playback response metadata fields from one fetched track row. */
const mapTrackMetadataRowToResponseFields = (trackMetadataRow, countryCode = null) => {
  const responseFields = {
    stream_url: trackMetadataRow.stream_url || trackMetadataRow.audio_url || null,
    track_title: trackMetadataRow.title ?? null,
    artist_name: trackMetadataRow.artist_name ?? null,
    duration: trackMetadataRow.duration ?? null,
    cover_image: trackMetadataRow.cover_image ?? null,
  };
  const geoFields = {};
  if (Object.prototype.hasOwnProperty.call(trackMetadataRow, 'geo_restriction_type')) {
    geoFields.geo_restriction_type = trackMetadataRow.geo_restriction_type;
  }
  if (Object.prototype.hasOwnProperty.call(trackMetadataRow, 'geo_regions')) {
    geoFields.geo_regions = trackMetadataRow.geo_regions;
  }
  const maskedFields = maskPlaybackUrlsForGeo(
    {
      ...responseFields,
      ...geoFields,
    },
    countryCode
  );

  return {
    ...responseFields,
    stream_url: maskedFields.stream_url,
    ...(Object.prototype.hasOwnProperty.call(maskedFields, 'is_geo_blocked')
      ? {
          is_geo_blocked: maskedFields.is_geo_blocked,
          playback_restriction_reason: maskedFields.playback_restriction_reason,
        }
      : {}),
  };
};

/* Batch-loads playback response metadata for the provided track ids. */
const buildTrackMetadataMap = async (trackIds, countryCode = null) => {
  const uniqueTrackIds = [...new Set(trackIds.filter((trackId) => typeof trackId === 'string'))];

  if (!uniqueTrackIds.length) {
    return new Map();
  }

  const trackMetadataRows = await playbackModel.findTrackMetadataByIds(uniqueTrackIds);

  return new Map(
      trackMetadataRows.map((trackMetadataRow) => [
      trackMetadataRow.id.toLowerCase(),
      mapTrackMetadataRowToResponseFields(trackMetadataRow, countryCode),
    ])
  );
};

/* Returns response metadata for one track id, defaulting to null fields when missing/deleted. */
const getTrackResponseMetadata = (trackId, trackMetadataMap) => {
  if (!trackId || typeof trackId !== 'string') {
    return EMPTY_TRACK_RESPONSE_METADATA;
  }

  return trackMetadataMap.get(trackId.toLowerCase()) || EMPTY_TRACK_RESPONSE_METADATA;
};

/* Adds derived track metadata to normalized queue items without mutating stored queue shape. */
const enrichQueueItemsWithTrackMetadata = (queueItems, trackMetadataMap) =>
  queueItems.map((queueItem) => ({
    ...queueItem,
    ...getTrackResponseMetadata(queueItem.track_id, trackMetadataMap),
  }));

/* Adds derived current-track and queue-track metadata to a normalized player-state response. */
const enrichNormalizedPlayerStateWithTrackMetadata = (playerState, trackMetadataMap) => ({
  ...playerState,
  ...getTrackResponseMetadata(playerState.track_id, trackMetadataMap),
  queue: enrichQueueItemsWithTrackMetadata(playerState.queue, trackMetadataMap),
});

/* Normalizes and enriches a player-state response in one shared playback-only read pass. */
const normalizeAndEnrichPlayerState = async (playerState, countryCode = null) => {
  const normalizedPlayerState = normalizeStoredPlayerState(playerState);

  if (!normalizedPlayerState) {
    return null;
  }

  const trackMetadataMap = await buildTrackMetadataMap(
    collectPlayerStateTrackIds(normalizedPlayerState),
    countryCode
  );
  return enrichNormalizedPlayerStateWithTrackMetadata(normalizedPlayerState, trackMetadataMap);
};

/* Enriches a normalized queue-only response using the same batch metadata lookup as player state. */
const enrichQueueResponse = async (queueItems, countryCode = null) => {
  if (!queueItems.length) {
    return { queue: [] };
  }

  const trackMetadataMap = await buildTrackMetadataMap(
    queueItems.map((queueItem) => queueItem.track_id),
    countryCode
  );

  return {
    queue: enrichQueueItemsWithTrackMetadata(queueItems, trackMetadataMap),
  };
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

/* Treats null/undefined and empty-array stored queues as already clear without parsing malformed data. */
const isStoredQueueEffectivelyEmpty = (queue) =>
  queue == null || (Array.isArray(queue) && queue.length === 0);

/* Validates the PATCH /me/player/queue payload before any stored queue snapshot is inspected. */
const validateQueueReorderRequest = (reorderRequest) => {
  if (!isPlainObject(reorderRequest)) {
    throw new AppError('Request body must be an object.', 400, 'VALIDATION_FAILED');
  }

  if (!Object.prototype.hasOwnProperty.call(reorderRequest, 'items')) {
    throw new AppError('items is required.', 400, 'VALIDATION_FAILED');
  }

  if (!Array.isArray(reorderRequest.items)) {
    throw new AppError('items must be an array.', 400, 'VALIDATION_FAILED');
  }

  if (!reorderRequest.items.length) {
    throw new AppError('items must not be empty.', 400, 'VALIDATION_FAILED');
  }

  const seenQueueItemIds = new Set();
  const seenPositions = new Set();

  return reorderRequest.items.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new AppError(`items[${index}] must be an object.`, 400, 'VALIDATION_FAILED');
    }

    assertValidUuid(item.queue_item_id, 'queue_item_id');

    const position = Number(item.position);
    if (!Number.isInteger(position) || position < 1) {
      throw new AppError(
        'position must be an integer greater than or equal to 1.',
        400,
        'VALIDATION_FAILED'
      );
    }

    if (seenQueueItemIds.has(item.queue_item_id)) {
      throw new AppError('queue_item_id values must be unique.', 400, 'VALIDATION_FAILED');
    }

    if (seenPositions.has(position)) {
      throw new AppError('position values must be unique.', 400, 'VALIDATION_FAILED');
    }

    seenQueueItemIds.add(item.queue_item_id);
    seenPositions.add(position);

    return {
      queue_item_id: item.queue_item_id,
      position,
    };
  });
};

/* Guards against corrupted stored queues where queue_item_id uniqueness was not preserved. */
const assertStoredQueueItemIdsUnique = (queue) => {
  const queueItemIds = queue.map((queueItem) => queueItem.queue_item_id);
  if (new Set(queueItemIds).size !== queueItemIds.length) {
    throw new AppError(
      'Stored queue contains duplicate queue_item_id values.',
      500,
      'INTERNAL_ERROR'
    );
  }
};

/* Validates the reorder request against the normalized current queue snapshot using full-permutation rules. */
const assertValidQueuePermutation = ({ normalizedQueue, reorderInstructions }) => {
  const queueLength = normalizedQueue.length;

  if (reorderInstructions.length !== queueLength) {
    throw new AppError(
      'items must include every current queue item exactly once.',
      400,
      'VALIDATION_FAILED'
    );
  }

  const sortedPositions = reorderInstructions
    .map((instruction) => instruction.position)
    .sort((left, right) => left - right);

  const expectedPositions = Array.from({ length: queueLength }, (_, index) => index + 1);
  if (sortedPositions.some((position, index) => position !== expectedPositions[index])) {
    throw new AppError(
      'position values must form a complete contiguous set from 1 to queue length.',
      400,
      'VALIDATION_FAILED'
    );
  }

  const existingQueueItemIdSet = new Set(
    normalizedQueue.map((queueItem) => queueItem.queue_item_id)
  );

  if (
    reorderInstructions.some(
      (instruction) => !existingQueueItemIdSet.has(instruction.queue_item_id)
    )
  ) {
    throw new AppError(
      'items must include every current queue item exactly once.',
      400,
      'VALIDATION_FAILED'
    );
  }
};

/* Builds a reordered queue by mapping sorted client positions onto the already-normalized queue items. */
const buildReorderedQueue = ({ normalizedQueue, reorderInstructions }) => {
  const queueItemById = new Map(
    normalizedQueue.map((queueItem) => [queueItem.queue_item_id, queueItem])
  );

  return [...reorderInstructions]
    .sort((left, right) => left.position - right.position)
    .map((instruction) => queueItemById.get(instruction.queue_item_id));
};

/* Detects no-op reorder requests so the service can avoid unnecessary writes. */
const isSameQueueOrder = (currentQueue, reorderedQueue) =>
  currentQueue.length === reorderedQueue.length &&
  currentQueue.every(
    (queueItem, index) => queueItem.queue_item_id === reorderedQueue[index]?.queue_item_id
  );

/* Removes exactly one queued occurrence by queue_item_id while preserving all other queue order. */
const removeQueueItemById = ({ queue, queueItemId }) => {
  const queueItemIndex = queue.findIndex((queueItem) => queueItem.queue_item_id === queueItemId);

  if (queueItemIndex === -1) {
    throw new AppError('Queue item not found.', 404, 'QUEUE_ITEM_NOT_FOUND');
  }

  const updatedQueue = [...queue];
  updatedQueue.splice(queueItemIndex, 1);
  return updatedQueue;
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
const resolvePlaybackAccess = async ({
  trackId,
  requesterUserId = null,
  secretToken = null,
  countryCode = null,
}) => {
  assertValidUuid(trackId, 'track_id');

  const track = await playbackModel.findTrackByIdForPlaybackState(trackId);

  assertTrackPlaybackAccess(track, requesterUserId, secretToken);

  if (isTrackGeoBlocked(track, countryCode)) {
    return {
      track,
      playbackState: buildPlaybackState({
        trackId: track.id,
        state: 'blocked',
        reason: REGION_RESTRICTED_REASON,
      }),
    };
  }

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
    if (playbackState.reason === REGION_RESTRICTED_REASON) {
      throw new AppError(
        'Track playback is not available in your region.',
        403,
        'REGION_RESTRICTED'
      );
    }

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

/* Normalizes queue-context interaction/source input and enforces source-specific request semantics. */
const validateAndNormalizeQueueContextPayload = ({
  interactionType,
  sourceType,
  sourceId,
  targetUserId,
  requesterUserId,
}) => {
  const normalizedInteractionType = normalizeOptionalString(interactionType, 'interaction_type');
  const normalizedSourceType = normalizeOptionalString(sourceType, 'source_type');
  const normalizedSourceId = normalizeOptionalString(sourceId, 'source_id');
  const normalizedTargetUserId = normalizeOptionalUuid(targetUserId, 'target_user_id');

  if (!normalizedInteractionType) {
    throw new AppError('interaction_type is required.', 400, 'VALIDATION_FAILED');
  }

  if (!normalizedSourceType) {
    throw new AppError('source_type is required.', 400, 'VALIDATION_FAILED');
  }

  assertAllowedValue(
    normalizedInteractionType,
    'interaction_type',
    QUEUE_CONTEXT_INTERACTION_TYPES
  );
  assertAllowedValue(normalizedSourceType, 'source_type', QUEUE_CONTEXT_SOURCE_TYPES);

  if (USER_SCOPED_QUEUE_SOURCE_TYPES.has(normalizedSourceType)) {
    if (normalizedSourceId !== null) {
      throw new AppError(
        `source_id is not supported for source_type ${normalizedSourceType}. Use target_user_id instead.`,
        400,
        'VALIDATION_FAILED'
      );
    }
  } else if (normalizedSourceType === 'track') {
    if (normalizedTargetUserId !== null) {
      throw new AppError(
        'target_user_id is not supported for source_type track.',
        400,
        'VALIDATION_FAILED'
      );
    }
  } else if (normalizedTargetUserId !== null) {
    throw new AppError(
      `target_user_id is not supported for source_type ${normalizedSourceType}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  if (normalizedSourceType === 'track') {
    if (!normalizedSourceId) {
      throw new AppError('source_id is required.', 400, 'VALIDATION_FAILED');
    }

    assertValidUuid(normalizedSourceId, 'source_id');

    if (normalizedInteractionType !== 'next_up') {
      throw new AppError(
        'source_type track only supports interaction_type next_up.',
        400,
        'VALIDATION_FAILED'
      );
    }
  }

  if (
    normalizedSourceType === 'playlist' ||
    normalizedSourceType === 'album' ||
    normalizedSourceType === 'genre' ||
    normalizedSourceType === 'station'
  ) {
    if (!normalizedSourceId) {
      throw new AppError('source_id is required.', 400, 'VALIDATION_FAILED');
    }

    assertValidUuid(normalizedSourceId, 'source_id');
  }

  if (normalizedSourceType === 'mix') {
    if (!normalizedSourceId) {
      throw new AppError('source_id is required.', 400, 'VALIDATION_FAILED');
    }
  }

  const effectiveTargetUserId = normalizedTargetUserId || requesterUserId;

  if (normalizedSourceType === 'listening_history' && effectiveTargetUserId !== requesterUserId) {
    throw new AppError(
      'listening_history only supports the authenticated user.',
      400,
      'VALIDATION_FAILED'
    );
  }

  return {
    interactionType: normalizedInteractionType,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
    targetUserId: effectiveTargetUserId,
  };
};

/* Builds a stable user-facing label for queue source metadata. */
const getUserDisplayName = (user) => user?.display_name || user?.username || 'User';

/* Builds human-readable source labels for user-scoped contexts. */
const buildUserScopedSourceTitle = ({
  sourceType,
  effectiveUserId,
  requesterUserId,
  targetUser,
}) => {
  const nounBySourceType = {
    liked_tracks: 'liked tracks',
    listening_history: 'listening history',
    reposts: 'reposts',
    user_tracks: 'tracks',
  };

  const noun = nounBySourceType[sourceType] || 'tracks';
  if (effectiveUserId === requesterUserId) {
    return sourceType === 'user_tracks' ? 'Your tracks' : `Your ${noun}`;
  }

  return `${getUserDisplayName(targetUser)}'s ${noun}`;
};

/* Pages through existing scoped list loaders until the full ordered context is collected. */
const collectPaginatedContextItems = async (loadPage) => {
  const collectedItems = [];
  let offset = 0;
  let total = null;

  while (total === null || offset < total) {
    const page = await loadPage({
      limit: QUEUE_CONTEXT_BATCH_SIZE,
      offset,
    });

    const items = page.items;
    total = page.total;

    if (!items.length) {
      break;
    }

    collectedItems.push(...items);
    offset += items.length;

    if (items.length < QUEUE_CONTEXT_BATCH_SIZE) {
      break;
    }
  }

  return collectedItems;
};

/* Keeps source ordering metadata together with the track ID while resolving context payloads. */
const buildContextTrackEntries = (items, trackIdSelector) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const trackId = trackIdSelector(item);
      if (!trackId) {
        return null;
      }

      return {
        trackId,
        sourcePosition: index + 1,
      };
    })
    .filter(Boolean);

/* Filters a context down to tracks the requester can actually play or preview. */
const filterPlayableContextTrackEntries = async ({
  requesterUserId,
  trackEntries,
  countryCode = null,
}) => {
  const playableEntries = [];

  for (const trackEntry of trackEntries) {
    try {
      const { playbackState } = await resolvePlaybackAccess({
        trackId: trackEntry.trackId,
        requesterUserId,
        secretToken: null,
        countryCode,
      });

      if (QUEUE_PLAYABLE_STATES.has(playbackState.state)) {
        playableEntries.push(trackEntry);
      }
    } catch (err) {
      if (err.code === 'TRACK_NOT_FOUND' || err.code === 'RESOURCE_PRIVATE') {
        continue;
      }

      throw err;
    }
  }

  return playableEntries;
};

/* Raises a clear 404 when a real source resolves to zero playable queue entries. */
const assertQueueContextNotEmpty = (trackEntries) => {
  if (!trackEntries.length) {
    throw new AppError(
      'Resolved queue context contains no playable tracks.',
      404,
      'QUEUE_CONTEXT_EMPTY'
    );
  }
};

/* Loads user-scoped context sources after verifying the referenced user exists. */
const resolveUserScopedQueueContext = async ({
  requesterUserId,
  sourceType,
  targetUserId,
  loadItems,
  countryCode = null,
}) => {
  const targetUser = await userModel.findById(targetUserId);
  if (!targetUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const rawItems = await collectPaginatedContextItems(loadItems);
  const playableTrackEntries = await filterPlayableContextTrackEntries({
    requesterUserId,
    trackEntries: buildContextTrackEntries(rawItems, (item) => item.track?.id || item.id),
    countryCode,
  });

  assertQueueContextNotEmpty(playableTrackEntries);

  return {
    sourceType,
    sourceId: targetUserId,
    sourceTitle: buildUserScopedSourceTitle({
      sourceType,
      effectiveUserId: targetUserId,
      requesterUserId,
      targetUser,
    }),
    trackEntries: playableTrackEntries,
  };
};

/* Reuses playlist loading logic for both playlist and album-style queue contexts. */
const resolvePlaylistQueueContext = async ({
  requesterUserId,
  sourceType,
  sourceId,
  countryCode = null,
}) => {
  const playlist = await playlistsService.getPlaylist({
    playlistId: sourceId,
    userId: requesterUserId,
    secretToken: null,
    includeTracks: true,
  });

  const isPlaylist = playlist.subtype === 'playlist';
  const isAlbumLike = ALBUM_LIKE_PLAYLIST_SUBTYPES.has(playlist.subtype);

  if (sourceType === 'playlist' && !isPlaylist) {
    throw new AppError('Playlist not found.', 404, 'PLAYLIST_NOT_FOUND');
  }

  if (sourceType === 'album' && !isAlbumLike) {
    throw new AppError('Album not found.', 404, 'ALBUM_NOT_FOUND');
  }

  const playableTrackEntries = await filterPlayableContextTrackEntries({
    requesterUserId,
    trackEntries: buildContextTrackEntries(playlist.tracks, (track) => track.track_id),
    countryCode,
  });

  assertQueueContextNotEmpty(playableTrackEntries);

  return {
    sourceType,
    sourceId: playlist.playlist_id,
    sourceTitle: playlist.name,
    trackEntries: playableTrackEntries,
  };
};

/* Reuses discovery mix logic so mix IDs remain service-defined strings rather than UUID-only values. */
const resolveMixQueueContext = async ({ requesterUserId, sourceId, countryCode = null }) => {
  const mix = await feedService.getMixById(requesterUserId, sourceId);
  const playableTrackEntries = await filterPlayableContextTrackEntries({
    requesterUserId,
    trackEntries: buildContextTrackEntries(mix.tracks, (track) => track.id),
    countryCode,
  });

  assertQueueContextNotEmpty(playableTrackEntries);

  return {
    sourceType: 'mix',
    sourceId: mix.mix_id || sourceId,
    sourceTitle: mix.title,
    trackEntries: playableTrackEntries,
  };
};

/* Reuses the existing station endpoint flow and paginates through the artist's full station track list. */
const resolveStationQueueContext = async ({ requesterUserId, sourceId, countryCode = null }) => {
  const firstPage = await feedService.getStationTracks(
    sourceId,
    { limit: QUEUE_CONTEXT_BATCH_SIZE, offset: 0 },
    requesterUserId
  );
  const remainingItems = await collectPaginatedContextItems(async ({ limit, offset }) => {
    if (offset === 0) {
      return {
        items: firstPage.data,
        total: firstPage.pagination.total,
      };
    }

    const page = await feedService.getStationTracks(sourceId, { limit, offset }, requesterUserId);

    return {
      items: page.data,
      total: page.pagination.total,
    };
  });
  const playableTrackEntries = await filterPlayableContextTrackEntries({
    requesterUserId,
    trackEntries: buildContextTrackEntries(remainingItems, (track) => track.id),
    countryCode,
  });

  assertQueueContextNotEmpty(playableTrackEntries);

  return {
    sourceType: 'station',
    sourceId: firstPage.station.artist_id || sourceId,
    sourceTitle: firstPage.station.name,
    trackEntries: playableTrackEntries,
  };
};

/* Reuses trending-by-genre discovery logic so genre visibility stays aligned with feed behavior. */
const resolveGenreQueueContext = async ({ requesterUserId, sourceId, countryCode = null }) => {
  const firstPage = await feedService.getTrendingByGenre(
    sourceId,
    { limit: QUEUE_CONTEXT_BATCH_SIZE, offset: 0 },
    requesterUserId
  );
  const rawItems = await collectPaginatedContextItems(async ({ limit, offset }) => {
    if (offset === 0) {
      return {
        items: firstPage.tracks,
        total: firstPage.pagination.total,
      };
    }

    const page = await feedService.getTrendingByGenre(sourceId, { limit, offset }, requesterUserId);

    return {
      items: page.tracks,
      total: page.pagination.total,
    };
  });
  const playableTrackEntries = await filterPlayableContextTrackEntries({
    requesterUserId,
    trackEntries: buildContextTrackEntries(rawItems, (track) => track.id),
    countryCode,
  });

  assertQueueContextNotEmpty(playableTrackEntries);

  return {
    sourceType: 'genre',
    sourceId: firstPage.genre_id || sourceId,
    sourceTitle: firstPage.genre_name,
    trackEntries: playableTrackEntries,
  };
};

/* Reuses the legacy direct-next-up access rules for single-track queue insertions. */
const resolveTrackQueueContext = async ({ requesterUserId, sourceId, countryCode = null }) => {
  const { playbackState } = await resolvePlaybackAccess({
    trackId: sourceId,
    requesterUserId,
    secretToken: null,
    countryCode,
  });

  if (!QUEUE_PLAYABLE_STATES.has(playbackState.state)) {
    assertQueueContextNotEmpty([]);
  }

  return {
    sourceType: 'track',
    sourceId: null,
    sourceTitle: null,
    trackEntries: [
      {
        trackId: sourceId,
        sourcePosition: null,
      },
    ],
  };
};

/* Reuses the existing supported loaders for each queue context source type. */
const resolveQueueContext = async ({
  requesterUserId,
  sourceType,
  sourceId,
  targetUserId,
  countryCode = null,
}) => {
  switch (sourceType) {
    case 'track':
      return resolveTrackQueueContext({
        requesterUserId,
        sourceId,
        countryCode,
      });
    case 'playlist':
    case 'album':
      return resolvePlaylistQueueContext({
        requesterUserId,
        sourceType,
        sourceId,
        countryCode,
      });
    case 'mix':
      return resolveMixQueueContext({
        requesterUserId,
        sourceId,
        countryCode,
      });
    case 'station':
      return resolveStationQueueContext({
        requesterUserId,
        sourceId,
        countryCode,
      });
    case 'genre':
      return resolveGenreQueueContext({
        requesterUserId,
        sourceId,
        countryCode,
      });
    case 'liked_tracks':
      return resolveUserScopedQueueContext({
        requesterUserId,
        sourceType,
        targetUserId,
        loadItems: ({ limit, offset }) =>
          trackLikesService
            .getUserLikedTracks(targetUserId, limit, offset)
            .then((page) => ({ items: page.items, total: page.total })),
        countryCode,
      });
    case 'listening_history':
      return resolveUserScopedQueueContext({
        requesterUserId,
        sourceType,
        targetUserId,
        loadItems: ({ limit, offset }) =>
          playbackModel
            .findListeningHistoryByUserId(targetUserId, limit, offset)
            .then((items) => ({ items, total: null })),
        countryCode,
      });
    case 'reposts':
      return resolveUserScopedQueueContext({
        requesterUserId,
        sourceType,
        targetUserId,
        loadItems: ({ limit, offset }) =>
          trackRepostsService
            .getUserRepostedTracks(targetUserId, limit, offset)
            .then((page) => ({ items: page.items, total: page.total })),
        countryCode,
      });
    case 'user_tracks':
      return resolveUserScopedQueueContext({
        requesterUserId,
        sourceType,
        targetUserId,
        loadItems: ({ limit, offset }) => {
          if (targetUserId === requesterUserId) {
            const query = { limit, offset };
            if (countryCode !== null) {
              query.countryCode = countryCode;
            }
            return tracksService
              .getMyTracks(targetUserId, query)
              .then((page) => ({
                items: page.data,
                total: page.pagination.total,
              }));
          }

          const query = { userId: targetUserId, limit, offset };
          if (countryCode !== null) {
            query.countryCode = countryCode;
          }
          return usersService
            .getUserTracks(query)
            .then((page) => ({
              items: page.data,
              total: page.pagination.total,
            }));
        },
        countryCode,
      });
    default:
      throw new AppError(`Unsupported source_type: ${sourceType}.`, 400, 'VALIDATION_FAILED');
  }
};

/* Splits the normalized queue into manual next_up items and passive context items. */
const splitQueueBuckets = (queue) => ({
  nextUpItems: queue.filter((queueItem) => queueItem.queue_bucket === 'next_up'),
  contextItems: queue.filter((queueItem) => queueItem.queue_bucket === 'context'),
});

const normalizeNullableForCompare = (value) => (value === undefined || value === '' ? null : value);

/* Compares only stable context semantics so replaying the same context is a write-free no-op. */
const doesExistingPlayContextMatchResolvedContext = ({
  existingPlayerState,
  existingContextItems,
  resolvedContext,
}) => {
  if (!existingPlayerState || !resolvedContext?.trackEntries?.length) {
    return false;
  }

  const resolvedEntries = resolvedContext.trackEntries;
  const resolvedTopTrackId = resolvedEntries[0]?.trackId;

  if (existingPlayerState.track_id !== resolvedTopTrackId) {
    return false;
  }

  const resolvedQueueEntries = resolvedEntries.slice(1);

  if (existingContextItems.length !== resolvedQueueEntries.length) {
    return false;
  }

  return existingContextItems.every((queueItem, index) => {
    const resolvedEntry = resolvedQueueEntries[index];

    return (
      queueItem.queue_bucket === 'context' &&
      queueItem.track_id === resolvedEntry.trackId &&
      queueItem.source_type === resolvedContext.sourceType &&
      normalizeNullableForCompare(queueItem.source_id) ===
        normalizeNullableForCompare(resolvedContext.sourceId) &&
      normalizeNullableForCompare(queueItem.source_position) ===
        normalizeNullableForCompare(resolvedEntry.sourcePosition)
    );
  });
};

/* Creates normalized queue items for one resolved context without deduplicating repeated tracks. */
const buildQueueContextItems = ({
  queueBucket,
  sourceType,
  sourceId,
  sourceTitle,
  trackEntries,
}) => {
  const addedAt = new Date().toISOString();

  return trackEntries.map((trackEntry) => ({
    queue_item_id: randomUUID(),
    track_id: trackEntry.trackId,
    queue_bucket: queueBucket,
    source_type: sourceType,
    source_id: sourceId,
    source_title: sourceTitle,
    source_position: trackEntry.sourcePosition,
    added_at: addedAt,
  }));
};

// ============================================================
// exported service functions
// ============================================================

/* Returns the saved player state for an authenticated user. */
exports.getPlayerState = async ({ userId, countryCode = null }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const playerState = await playerStateModel.findByUserId(userId);
  return normalizeAndEnrichPlayerState(playerState, countryCode);
};

/* Returns the authenticated user's paginated deduplicated recently played tracks. */
exports.getRecentlyPlayed = async ({ userId, limit, offset, countryCode = null }) => {
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
    data: items.map((item) => ({
      ...item,
      track: maskPlaybackUrlsForGeo(item.track, countryCode),
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Clears active listening history for the authenticated user without physically deleting rows. */
exports.clearListeningHistory = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  return playbackModel.softDeleteListeningHistoryByUserId(userId);
};

/* Syncs offline listening-history events and the latest player state after reconnect. */
exports.syncPlayback = async ({ userId, historyEvents, currentState, countryCode = null }) => {
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
      syncedCurrentState = await normalizeAndEnrichPlayerState(syncedCurrentState, countryCode);
      currentStateSaved = true;
    } else {
      currentStateIgnoredAsStale = true;
      syncedCurrentState = await normalizeAndEnrichPlayerState(
        await playerStateModel.findByUserId(userId),
        countryCode
      );
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
exports.getListeningHistory = async ({ userId, limit, offset, countryCode = null }) => {
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
    data: items.map((item) => ({
      ...item,
      track: maskPlaybackUrlsForGeo(item.track, countryCode),
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Resolves playback accessibility for a track without recording a play or writing any state. */
exports.getPlaybackState = async ({
  trackId,
  requesterUserId = null,
  secretToken = null,
  countryCode = null,
}) => {
  const { playbackState } = await resolvePlaybackAccess({
    trackId,
    requesterUserId,
    secretToken,
    countryCode,
  });

  return playbackState;
};

/* Resolves a play request, records listening history when applicable, and returns the playback payload. */
exports.playTrack = async ({
  trackId,
  requesterUserId = null,
  secretToken = null,
  countryCode = null,
}) => {
  const { playbackState } = await resolvePlaybackAccess({
    trackId,
    requesterUserId,
    secretToken,
    countryCode,
  });

  assertPlayablePlaybackState(playbackState);
  await recordListeningHistoryIfNeeded({ requesterUserId, playbackState });

  return playbackState;
};

/* Saves a user's player state after validating track existence and payload integrity. */
exports.savePlayerState = async ({
  userId,
  trackId,
  positionSeconds,
  volume,
  queue,
  countryCode = null,
}) => {
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

  return normalizeAndEnrichPlayerState(savedPlayerState, countryCode);
};

/* Applies a supported playback context to the queue and returns the full normalized saved player state. */
exports.addQueueContext = async ({
  userId,
  interactionType,
  sourceType,
  sourceId,
  targetUserId,
  countryCode = null,
}) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const normalizedRequest = validateAndNormalizeQueueContextPayload({
    interactionType,
    sourceType,
    sourceId,
    targetUserId,
    requesterUserId: userId,
  });
  const existingPlayerState = await playerStateModel.findStateRowByUserId(userId);
  const normalizedExistingQueue = normalizeQueue(existingPlayerState?.queue ?? []);
  const { nextUpItems, contextItems } = splitQueueBuckets(normalizedExistingQueue);
  const resolvedContext = await resolveQueueContext({
    requesterUserId: userId,
    sourceType: normalizedRequest.sourceType,
    sourceId: normalizedRequest.sourceId,
    targetUserId: normalizedRequest.targetUserId,
    countryCode,
  });

  if (
    normalizedRequest.interactionType === 'play' &&
    doesExistingPlayContextMatchResolvedContext({
      existingPlayerState,
      existingContextItems: contextItems,
      resolvedContext,
    })
  ) {
    return normalizeAndEnrichPlayerState(existingPlayerState, countryCode);
  }

  const newContextItems = buildQueueContextItems({
    queueBucket: normalizedRequest.interactionType === 'play' ? 'context' : 'next_up',
    sourceType: resolvedContext.sourceType,
    sourceId: resolvedContext.sourceId,
    sourceTitle: resolvedContext.sourceTitle,
    trackEntries:
      normalizedRequest.interactionType === 'play'
        ? resolvedContext.trackEntries.slice(1)
        : resolvedContext.trackEntries,
  });

  const savedPlayerState = await playerStateModel.upsert({
    userId,
    trackId:
      normalizedRequest.interactionType === 'play'
        ? resolvedContext.trackEntries[0].trackId
        : (existingPlayerState?.track_id ?? null),
    positionSeconds:
      normalizedRequest.interactionType === 'play'
        ? 0
        : (existingPlayerState?.position_seconds ?? 0),
    volume: existingPlayerState?.volume ?? 1,
    queue:
      normalizedRequest.interactionType === 'play'
        ? [...nextUpItems, ...newContextItems]
        : [...nextUpItems, ...newContextItems, ...contextItems],
  });

  return normalizeAndEnrichPlayerState(savedPlayerState, countryCode);
};

/* Reorders the authenticated user's normalized queue using a full queue permutation request. */
exports.reorderPlayerQueue = async ({ userId, reorderRequest, countryCode = null }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const reorderInstructions = validateQueueReorderRequest(reorderRequest);
  const existingPlayerState = await playerStateModel.findStateRowByUserId(userId);

  if (!existingPlayerState) {
    throw new AppError('Queue not found.', 404, 'QUEUE_NOT_FOUND');
  }

  const normalizedExistingQueue = normalizeQueue(existingPlayerState.queue ?? []);

  if (!normalizedExistingQueue.length) {
    throw new AppError('Queue not found.', 404, 'QUEUE_NOT_FOUND');
  }

  assertStoredQueueItemIdsUnique(normalizedExistingQueue);
  assertValidQueuePermutation({
    normalizedQueue: normalizedExistingQueue,
    reorderInstructions,
  });

  const reorderedQueue = buildReorderedQueue({
    normalizedQueue: normalizedExistingQueue,
    reorderInstructions,
  });

  if (isSameQueueOrder(normalizedExistingQueue, reorderedQueue)) {
    return enrichQueueResponse(normalizedExistingQueue, countryCode);
  }

  const savedPlayerState = await playerStateModel.upsert({
    userId,
    trackId: existingPlayerState.track_id,
    positionSeconds: existingPlayerState.position_seconds,
    volume: existingPlayerState.volume,
    queue: reorderedQueue,
  });

  return enrichQueueResponse(normalizeStoredPlayerState(savedPlayerState).queue, countryCode);
};

/* Clears the authenticated user's entire upcoming queue without changing the rest of player_state. */
exports.clearPlayerQueue = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  const existingPlayerState = await playerStateModel.findStateRowByUserId(userId);

  if (!existingPlayerState) {
    return { queue: [] };
  }

  if (isStoredQueueEffectivelyEmpty(existingPlayerState.queue)) {
    return { queue: [] };
  }

  await playerStateModel.upsert({
    userId,
    trackId: existingPlayerState.track_id,
    positionSeconds: existingPlayerState.position_seconds,
    volume: existingPlayerState.volume,
    queue: [],
  });

  return { queue: [] };
};

/* Removes one stored queue item by queue_item_id without changing the current track or playback state. */
exports.removeQueueItem = async ({ userId, queueItemId, countryCode = null }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  assertValidUuid(queueItemId, 'queue_item_id');

  const existingPlayerState = await playerStateModel.findStateRowByUserId(userId);

  if (!existingPlayerState) {
    throw new AppError('Queue item not found.', 404, 'QUEUE_ITEM_NOT_FOUND');
  }

  const normalizedExistingQueue = normalizeQueue(existingPlayerState.queue ?? []);

  if (!normalizedExistingQueue.length) {
    throw new AppError('Queue item not found.', 404, 'QUEUE_ITEM_NOT_FOUND');
  }

  const updatedQueue = removeQueueItemById({
    queue: normalizedExistingQueue,
    queueItemId,
  });

  const savedPlayerState = await playerStateModel.upsert({
    userId,
    trackId: existingPlayerState.track_id,
    positionSeconds: existingPlayerState.position_seconds,
    volume: existingPlayerState.volume,
    queue: updatedQueue,
  });

  return enrichQueueResponse(normalizeStoredPlayerState(savedPlayerState).queue, countryCode);
};
