// ============================================================
// services/insights.service.js
// Business rules and validation for creator insights.
// ============================================================
const insightsModel = require('../models/insights.model');
const AppError = require('../utils/app-error');

const UUID_SHAPED_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RANGE_CONFIG = {
  '7d': {
    granularity: 'day',
    bucketCount: 7,
  },
  '30d': {
    granularity: 'day',
    bucketCount: 30,
  },
  '12m': {
    granularity: 'month',
    bucketCount: 12,
  },
};

const normalizeUuidLike = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^\{/, '')
    .replace(/\}$/, '');

const assertValidTimezone = (timezone) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new AppError('timezone must be a valid IANA time zone.', 400, 'VALIDATION_FAILED');
  }
};

exports.getMyInsights = async ({ userId, range = '30d', trackId = null, timezone = 'UTC' }) => {
  const requestedRange = range || '30d';
  const config = RANGE_CONFIG[requestedRange];

  if (!config) {
    throw new AppError('range must be one of: 7d, 30d, 12m.', 400, 'VALIDATION_FAILED');
  }

  const normalizedTimezone = String(timezone || 'UTC').trim() || 'UTC';
  assertValidTimezone(normalizedTimezone);

  const normalizedTrackId =
    trackId === undefined || trackId === null || trackId === '' ? null : normalizeUuidLike(trackId);

  if (normalizedTrackId && !UUID_SHAPED_REGEX.test(normalizedTrackId)) {
    throw new AppError('track_id must be a valid UUID.', 400, 'VALIDATION_FAILED');
  }

  if (normalizedTrackId) {
    const ownedTrack = await insightsModel.findOwnedTrackById({
      userId,
      trackId: normalizedTrackId,
    });

    if (!ownedTrack) {
      throw new AppError(
        'You are not allowed to access insights for this track.',
        403,
        'PERMISSION_DENIED'
      );
    }
  }

  const { totals, series } = await insightsModel.getCreatorInsights({
    userId,
    trackId: normalizedTrackId,
    granularity: config.granularity,
    bucketCount: config.bucketCount,
    timezone: normalizedTimezone,
  });

  return {
    range: requestedRange,
    granularity: config.granularity,
    timezone: normalizedTimezone,
    track_id: normalizedTrackId,
    totals,
    series,
  };
};
