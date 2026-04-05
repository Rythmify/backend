// ============================================================
// services/playback.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const playerStateModel = require('../models/player-state.model');
const AppError = require('../utils/app-error');
const { validate: isUuid } = require('uuid');

const assertValidUuid = (value, fieldName) => {
  if (!isUuid(value)) {
    throw new AppError(`${fieldName} must be a valid UUID.`, 400, 'VALIDATION_FAILED');
  }
};

exports.getPlayerState = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  return playerStateModel.findByUserId(userId);
};

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
