// ============================================================
// services/tracks.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const AppError = require('../utils/app-error.js');
const tracksModel = require('../models/track.model.js');
const tagModel = require('../models/tag.model.js');
const storageService = require('./storage.service.js');
const { processTrackInBackground } = require('./track-processing.service');
const env = require('../config/env');
const crypto = require('crypto');
const { validate: isUuid } = require('uuid');

const GEO_RESTRICTION_TYPES = ['worldwide', 'exclusive_regions', 'blocked_regions'];

/* Detects UUID-like IDs that still need tag-name hydration before returning API data. */
const looksLikeDbId = (value) => typeof value === 'string' && value.includes('-');

// Geo settings validations
const resolveGeoSettings = ({
  geoRestrictionTypeInput,
  geoRegionsInput,
  currentGeoType = 'worldwide',
  currentGeoRegions = [],
}) => {
  let geoRestrictionType =
    geoRestrictionTypeInput !== undefined ? clean(geoRestrictionTypeInput) : currentGeoType;

  if (!geoRestrictionType) {
    geoRestrictionType = 'worldwide';
  }

  if (!GEO_RESTRICTION_TYPES.includes(geoRestrictionType)) {
    throw new AppError('Invalid geo_restriction_type', 400, 'VALIDATION_FAILED');
  }

  const geoRegions =
    geoRegionsInput !== undefined ? parseArray(geoRegionsInput) : currentGeoRegions;

  if (!Array.isArray(geoRegions)) {
    throw new AppError('geo_regions must be an array', 400, 'VALIDATION_FAILED');
  }

  if (geoRegions.length > 250) {
    throw new AppError('Maximum 250 geo regions allowed', 400, 'VALIDATION_FAILED');
  }

  const invalidRegion = geoRegions.find(
    (code) => typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)
  );

  if (invalidRegion) {
    throw new AppError('Invalid geo region code', 400, 'VALIDATION_FAILED');
  }

  if (geoRestrictionType === 'worldwide' && geoRegions.length > 0) {
    throw new AppError(
      'geo_regions must be empty when geo_restriction_type is worldwide',
      400,
      'VALIDATION_FAILED'
    );
  }

  if (
    (geoRestrictionType === 'exclusive_regions' || geoRestrictionType === 'blocked_regions') &&
    geoRegions.length === 0
  ) {
    throw new AppError(
      'geo_regions is required for the selected geo_restriction_type',
      400,
      'VALIDATION_FAILED'
    );
  }

  return {
    geo_restriction_type: geoRestrictionType,
    geo_regions: geoRegions,
  };
};

// convert string to boolean
const toBool = (v, d) => {
  if (v === undefined || v === null || v === '') return d;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
};

// return array from json
const parseArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
};

// generate a secret token for private tracks
const generateSecretToken = () => crypto.randomBytes(24).toString('hex');

/* Normalizes empty request values to null so optional fields can be cleared consistently. */
const clean = (v) => (v === undefined || v === null || v === '' ? null : v);

/* Ensures service methods only operate on valid track UUIDs before hitting the data layer. */
const assertValidTrackId = (trackId) => {
  // Reject malformed identifiers early to avoid invalid track lookups and accidental broad queries.
  if (!isUuid(trackId)) {
    throw new AppError('track_id must be a valid UUID.', 400, 'VALIDATION_FAILED');
  }
};

/* Parses and validates offset-style pagination values for owner track listings. */
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

/* Parses array-like inputs and fails fast when a field must be a real JSON array. */
const parseStrictArray = (v, fieldName) => {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v;

  try {
    const parsed = JSON.parse(v);
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new AppError(`${fieldName} must be a valid array`, 400, 'VALIDATION_FAILED');
  }
};

/* Normalizes tag names for storage and enforces track-level tag limits. */
const normalizeTagNames = (rawTags) => {
  const normalized = rawTags.map((tag) => {
    if (typeof tag !== 'string') {
      throw new AppError('Each tag must be a string', 400, 'VALIDATION_FAILED');
    }

    const cleaned = tag.trim().toLowerCase();

    if (!cleaned) {
      throw new AppError('Tag names cannot be empty', 400, 'VALIDATION_FAILED');
    }

    return cleaned;
  });

  const unique = [...new Set(normalized)];

  if (unique.length > 10) {
    throw new AppError('Maximum 10 tags allowed', 400, 'VALIDATION_FAILED');
  }

  return unique;
};

/* Resolves raw tag input into normalized names plus persisted tag IDs for joins. */
const resolveTagsFromInput = async (rawTags) => {
  if (rawTags === undefined) {
    return undefined;
  }

  const parsed = parseStrictArray(rawTags, 'tags');
  const tagNames = normalizeTagNames(parsed);

  if (!tagNames.length) {
    return {
      tagNames: [],
      tagIds: [],
    };
  }

  const rows = await tracksModel.findOrCreateTagsByNames(tagNames);
  const idByName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  return {
    tagNames,
    tagIds: tagNames.map((name) => {
      // Tags are created/fetched first, so a missing ID here signals an unexpected persistence issue.
      const tagId = idByName.get(name);

      if (!tagId) {
        throw new AppError(`Failed to resolve tag: ${name}`, 500, 'TAG_RESOLUTION_FAILED');
      }

      return tagId;
    }),
  };
};

/* Loads tag names for stored tag IDs so responses stay human-readable. */
const hydrateTagNamesByIds = async (tagIds) => {
  const ids = (tagIds || []).map(String);

  if (!ids.length) {
    return [];
  }

  const rows = await tagModel.findByIds(ids);
  const nameById = new Map(rows.map((row) => [String(row.id), row.name]));

  return ids.map((id) => nameById.get(id)).filter(Boolean);
};

/* Hydrates tag IDs on a single track object while leaving already-readable tags untouched. */
const mapTrackTagsToNames = async (track) => {
  if (!track || !Array.isArray(track.tags)) {
    return track;
  }

  if (!track.tags.length) {
    return { ...track, tags: [] };
  }

  // Some query paths already return names, so only resolve entries that look like stored tag IDs.
  const hasAnyDbIds = track.tags.some((tag) => looksLikeDbId(tag));

  if (!hasAnyDbIds) {
    return track;
  }

  const resolvedTags = await hydrateTagNamesByIds(track.tags.filter((tag) => looksLikeDbId(tag)));

  const resolvedIdTags = track.tags.filter((tag) => looksLikeDbId(tag));
  const nameById = new Map(resolvedIdTags.map((id, index) => [String(id), resolvedTags[index]]));

  return {
    ...track,
    tags: track.tags.map((tag) => nameById.get(String(tag)) || tag),
  };
};

/* Hydrates tag IDs across a paginated track list in one batch query. */
const mapTrackListTagsToNames = async (tracks) => {
  if (!Array.isArray(tracks) || !tracks.length) return tracks;

  const allIds = [
    ...new Set(
      tracks
        .flatMap((track) => (Array.isArray(track.tags) ? track.tags : []))
        .filter(looksLikeDbId)
        .map(String)
    ),
  ];

  if (!allIds.length) return tracks;

  const rows = await tagModel.findByIds(allIds);
  const nameById = new Map(rows.map((row) => [String(row.id), row.name]));

  return tracks.map((track) => {
    if (!Array.isArray(track.tags)) return track;

    return {
      ...track,
      tags: track.tags.map((tag) => nameById.get(String(tag)) || tag),
    };
  });
};

/* Creates a track record, uploads source assets, and kicks off background processing. */
const uploadTrack = async ({ user, audioFile, coverImageFile, body }) => {
  const userId = user?.sub || user?.id || user?.user_id;
  if (!userId) throw new AppError('Authenticated user not found', 401, 'AUTH_TOKEN_INVALID');

  const resolvedTags = await resolveTagsFromInput(body.tags);
  const tagIds = resolvedTags?.tagIds || [];

  let genreId = null;
  if (body.genre) {
    genreId = await tracksModel.getGenreIdByName(body.genre);
    if (!genreId) {
      throw new AppError('Invalid genre', 400, 'VALIDATION_FAILED');
    }
  }

  const audioKey = `tracks/${userId}/${Date.now()}-${audioFile.originalname}`;
  const uploadedAudio = await storageService.uploadTrack(audioFile, audioKey);

  let coverImageUrl = null;
  if (coverImageFile) {
    // Cover assets are stored under a separate prefix so generated media can be managed independently.
    const coverKey = `tracks/${userId}/covers/${Date.now()}-${coverImageFile.originalname}`;
    const uploadedCover = await storageService.uploadImage(coverImageFile, coverKey);
    coverImageUrl = uploadedCover.url;
  }

  const geoData = resolveGeoSettings({
    geoRestrictionTypeInput: body.geo_restriction_type,
    geoRegionsInput: body.geo_regions,
    currentGeoType: 'worldwide',
    currentGeoRegions: [],
  });

  const isPublic = toBool(body.is_public, true);
  // Private tracks receive a share token up front so owners can generate private URLs immediately.
  const secretToken = isPublic ? null : generateSecretToken();

  const trackData = {
    title: body.title.trim(),
    description: clean(body.description),
    genre_id: genreId,
    cover_image: coverImageUrl,
    audio_url: uploadedAudio.url,
    file_size: audioFile.size,
    status: 'processing',
    is_public: isPublic,
    secret_token: secretToken,

    release_date: clean(body.release_date),
    isrc: clean(body.isrc),
    p_line: clean(body.p_line),
    buy_link: clean(body.buy_link),
    record_label: clean(body.record_label),
    publisher: clean(body.publisher),
    explicit_content: toBool(body.explicit_content, false),
    license_type: clean(body.license_type) || 'all_rights_reserved',

    enable_downloads: toBool(body.enable_downloads, false),
    enable_offline_listening: toBool(body.enable_offline_listening, false),
    include_in_rss_feed: toBool(body.include_in_rss_feed, true),
    display_embed_code: toBool(body.display_embed_code, true),
    enable_app_playback: toBool(body.enable_app_playback, true),

    allow_comments: toBool(body.allow_comments, true),
    show_comments_public: toBool(body.show_comments_public, true),
    show_insights_public: toBool(body.show_insights_public, true),
    geo_restriction_type: geoData.geo_restriction_type,
    geo_regions: geoData.geo_regions,
    user_id: userId,
  };

  const createdTrack = await tracksModel.createTrack(trackData);

  if (tagIds.length) {
    await tracksModel.addTrackTags(createdTrack.id, tagIds);
  }

  await tracksModel.addTrackArtists(createdTrack.id, [userId]);

  processTrackInBackground({
    trackId: createdTrack.id,
    userId,
    audioUrl: createdTrack.audio_url,
  });

  return {
    ...createdTrack,
    tags: resolvedTags?.tagNames || [],
  };
};

/* Fetches a track with visibility enforcement for owners, public listeners, and private links. */
const getTrackById = async (trackId, requesterUserId = null, secretToken = null) => {
  assertValidTrackId(trackId);
  const track = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const isOwner = requesterUserId === track.user_id;
  const hasValidPrivateLink =
    // Private access is granted only when the supplied token matches the stored share token.
    !track.is_public && !!secretToken && !!track.secret_token && secretToken === track.secret_token;

  // Hidden tracks stay unavailable to everyone except the owner, regardless of share settings.
  if (track.is_hidden && !isOwner) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (!track.is_public && !isOwner && !hasValidPrivateLink) {
    throw new AppError('This track is private', 403, 'RESOURCE_PRIVATE');
  }

  const { secret_token, ...safeTrack } = track;

  return mapTrackTagsToNames(safeTrack);
};

/* Updates public/private visibility after verifying ownership and share-token state. */
const updateTrackVisibility = async (trackId, userId, isPublic) => {
  assertValidTrackId(trackId);

  if (typeof isPublic !== 'boolean') {
    throw new AppError('is_public must be a boolean', 400, 'VALIDATION_FAILED');
  }

  const track = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (track.user_id !== userId) {
    // Only the owning artist can change track privacy or regenerate private access behavior.
    throw new AppError(
      'You do not have permission to modify this track',
      403,
      'PERMISSION_NOT_OWNER'
    );
  }

  const secretToken = isPublic ? track.secret_token : track.secret_token || generateSecretToken();

  const updatedTrack = await tracksModel.updateTrackVisibility(trackId, isPublic, secretToken);

  return {
    track_id: updatedTrack.id,
    is_public: updatedTrack.is_public,
  };
};

/* Returns or creates the private share link token for an owner-only private track. */
const getPrivateShareLink = async (trackId, userId) => {
  assertValidTrackId(trackId);
  const track = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (track.user_id !== userId) {
    throw new AppError(
      'You do not have permission to access this track share link',
      403,
      'PERMISSION_NOT_OWNER'
    );
  }

  if (track.is_public) {
    throw new AppError('Share link is only available for private tracks', 400, 'VALIDATION_FAILED');
  }

  const secretToken = track.secret_token || generateSecretToken();

  if (!track.secret_token) {
    // Persist the token the first time a private share link is requested so future links remain stable.
    await tracksModel.updateTrackVisibility(trackId, false, secretToken);
  }

  const baseUrl = env.APP_URL || env.CLIENT_URL || null;
  const sharePath = `/tracks/${track.id}?secret_token=${secretToken}`;

  return {
    track_id: track.id,
    secret_token: secretToken,
    share_url: baseUrl ? `${baseUrl}${sharePath}` : sharePath,
  };
};

/* Returns the authenticated user's tracks with offset pagination, status filtering, and hydrated tags. */
const getMyTracks = async (userId, query = {}) => {
  const limit = parsePaginationNumber({
    value: query.limit,
    field: 'limit',
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  const offset = parsePaginationNumber({
    value: query.offset,
    field: 'offset',
    defaultValue: 0,
    min: 0,
  });

  const status =
    query.status === undefined || query.status === null || query.status === ''
      ? null
      : query.status;
  const allowedStatuses = ['processing', 'ready', 'failed'];

  if (status && !allowedStatuses.includes(status)) {
    throw new AppError('Invalid track status', 400, 'VALIDATION_FAILED');
  }

  const { items, total } = await tracksModel.findMyTracks(userId, {
    limit,
    offset,
    status,
  });

  return {
    items: await mapTrackListTagsToNames(items),
    meta: {
      limit,
      offset,
      total,
    },
  };
};

/* Permanently deletes a track after ownership checks and blob cleanup. */
const deleteTrack = async (trackId, userId) => {
  assertValidTrackId(trackId);
  const track = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (track.user_id !== userId) {
    throw new AppError(
      'You do not have permission to delete this track',
      403,
      'PERMISSION_NOT_OWNER'
    );
  }

  await storageService.deleteManyByUrls([
    track.audio_url,
    track.stream_url,
    track.preview_url,
    track.waveform_url,
    track.cover_image,
  ]);

  const deleted = await tracksModel.deleteTrackPermanently(trackId);

  if (!deleted) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }
};

/* Updates editable track metadata, tags, artwork, and geo settings without changing core privacy flow. */
const updateTrack = async ({ trackId, userId, payload, coverImageFile }) => {
  assertValidTrackId(trackId);
  const track = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (track.user_id !== userId) {
    throw new AppError(
      'You do not have permission to modify this track',
      403,
      'PERMISSION_NOT_OWNER'
    );
  }

  if (
    (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) &&
    !coverImageFile
  ) {
    throw new AppError('No valid fields provided for update', 400, 'VALIDATION_FAILED');
  }

  let genreId;
  if (payload.genre !== undefined) {
    if (payload.genre === null || payload.genre === '') {
      genreId = null;
    } else {
      genreId = await tracksModel.getGenreIdByName(payload.genre);
      if (!genreId) {
        throw new AppError('Invalid genre', 400, 'VALIDATION_FAILED');
      }
    }
  }

  let resolvedTags;
  if (payload.tags !== undefined) {
    resolvedTags = await resolveTagsFromInput(payload.tags);
  }

  const updateData = {};

  if (payload.title !== undefined) updateData.title = payload.title?.trim();
  if (payload.description !== undefined) updateData.description = clean(payload.description);
  if (payload.genre !== undefined) updateData.genre_id = genreId;

  if (payload.is_public !== undefined) {
    throw new AppError(
      'Use PATCH /tracks/:track_id/visibility to change track privacy',
      400,
      'VALIDATION_FAILED'
    );
  }

  if (payload.buy_link !== undefined) updateData.buy_link = clean(payload.buy_link);
  if (payload.record_label !== undefined) updateData.record_label = clean(payload.record_label);
  if (payload.publisher !== undefined) updateData.publisher = clean(payload.publisher);
  if (payload.release_date !== undefined) updateData.release_date = clean(payload.release_date);
  if (payload.isrc !== undefined) updateData.isrc = clean(payload.isrc);
  if (payload.p_line !== undefined) updateData.p_line = clean(payload.p_line);
  if (payload.license_type !== undefined) updateData.license_type = clean(payload.license_type);

  if (payload.explicit_content !== undefined) {
    updateData.explicit_content = toBool(payload.explicit_content, track.explicit_content);
  }

  if (payload.enable_downloads !== undefined) {
    updateData.enable_downloads = toBool(payload.enable_downloads, track.enable_downloads);
  }

  if (payload.enable_offline_listening !== undefined) {
    updateData.enable_offline_listening = toBool(
      payload.enable_offline_listening,
      track.enable_offline_listening
    );
  }

  if (payload.include_in_rss_feed !== undefined) {
    updateData.include_in_rss_feed = toBool(payload.include_in_rss_feed, track.include_in_rss_feed);
  }

  if (payload.display_embed_code !== undefined) {
    updateData.display_embed_code = toBool(payload.display_embed_code, track.display_embed_code);
  }

  if (payload.enable_app_playback !== undefined) {
    updateData.enable_app_playback = toBool(payload.enable_app_playback, track.enable_app_playback);
  }

  if (payload.allow_comments !== undefined) {
    updateData.allow_comments = toBool(payload.allow_comments, track.allow_comments);
  }

  if (payload.show_comments_public !== undefined) {
    updateData.show_comments_public = toBool(
      payload.show_comments_public,
      track.show_comments_public
    );
  }

  if (payload.show_insights_public !== undefined) {
    updateData.show_insights_public = toBool(
      payload.show_insights_public,
      track.show_insights_public
    );
  }

  if (coverImageFile) {
    // Reuse the upload path convention so cover replacements land beside the track's other artwork.
    const coverKey = `tracks/${userId}/covers/${Date.now()}-${coverImageFile.originalname}`;
    const uploadedCover = await storageService.uploadImage(coverImageFile, coverKey);
    updateData.cover_image = uploadedCover.url;
  }

  if (payload.title !== undefined) {
    if (typeof payload.title !== 'string' || !payload.title.trim()) {
      throw new AppError('title is required', 400, 'VALIDATION_FAILED');
    }
  }

  if (payload.license_type !== undefined) {
    const allowedLicenseTypes = ['all_rights_reserved', 'creative_commons'];
    if (!allowedLicenseTypes.includes(payload.license_type)) {
      throw new AppError('Invalid license_type', 400, 'VALIDATION_FAILED');
    }
  }

  if (payload.geo_restriction_type !== undefined || payload.geo_regions !== undefined) {
    // Geo validation reuses current values so partial updates still produce a complete valid rule set.
    const geoData = resolveGeoSettings({
      geoRestrictionTypeInput: payload.geo_restriction_type,
      geoRegionsInput: payload.geo_regions,
      currentGeoType: track.geo_restriction_type || 'worldwide',
      currentGeoRegions: track.geo_regions || [],
    });

    updateData.geo_restriction_type = geoData.geo_restriction_type;
    updateData.geo_regions = geoData.geo_regions;
  }

  const hasScalarUpdates = Object.keys(updateData).length > 0;
  const hasTagUpdates = payload.tags !== undefined;

  if (!hasScalarUpdates && !hasTagUpdates) {
    throw new AppError('No valid fields provided to update', 400, 'VALIDATION_FAILED');
  }

  const updatedRow = hasScalarUpdates
    ? await tracksModel.updateTrackFields(trackId, updateData)
    : track;

  if (hasScalarUpdates && !updatedRow) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (hasTagUpdates) {
    await tracksModel.replaceTrackTags(trackId, resolvedTags.tagIds);
  }

  const finalTrack = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!finalTrack) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (
    coverImageFile &&
    track.cover_image &&
    finalTrack.cover_image &&
    track.cover_image !== finalTrack.cover_image
  ) {
    // Remove the old cover only after the new URL is persisted to avoid broken artwork references.
    await storageService.deleteAllVersionsByUrl(track.cover_image);
  }

  if (hasTagUpdates) {
    return {
      ...finalTrack,
      tags: resolvedTags.tagNames,
    };
  }

  return mapTrackTagsToNames(finalTrack);
};

/* Returns the playable stream URL once processing and access checks have both passed. */
const getTrackStream = async (trackId, requesterUserId = null, secretToken = null) => {
  const track = await getTrackById(trackId, requesterUserId, secretToken);

  if (track.status === 'processing') {
    throw new AppError(
      'Track is still processing. Please retry shortly.',
      202,
      'BUSINESS_OPERATION_NOT_ALLOWED'
    );
  }

  if (track.status === 'failed') {
    throw new AppError('Track processing failed', 503, 'UPLOAD_PROCESSING_FAILED');
  }

  const playableUrl = track.stream_url || track.audio_url;

  if (!playableUrl) {
    throw new AppError('No playable audio available', 500, 'STREAM_URL_MISSING');
  }

  return {
    track_id: track.id,
    stream_url: playableUrl,
  };
};

/* Loads and returns waveform peak data for an accessible track after processing completes. */
const getTrackWaveform = async (trackId, requesterUserId = null, secretToken = null) => {
  const track = await getTrackById(trackId, requesterUserId, secretToken);

  if (track.status === 'processing') {
    throw new AppError(
      'Waveform is not yet available. Track is still processing.',
      202,
      'BUSINESS_OPERATION_NOT_ALLOWED'
    );
  }

  if (track.status === 'failed') {
    throw new AppError('Track processing failed', 503, 'UPLOAD_PROCESSING_FAILED');
  }

  if (!track.waveform_url) {
    throw new AppError('Waveform file is missing', 500, 'WAVEFORM_URL_MISSING');
  }

  let peaks;

  try {
    // Waveform JSON is stored as a blob asset, so it must be downloaded and parsed before returning peaks.
    const waveformBuffer = await storageService.downloadBlobToBuffer(track.waveform_url);
    peaks = JSON.parse(waveformBuffer.toString('utf8'));
  } catch {
    throw new AppError('Failed to load waveform data', 500, 'WAVEFORM_READ_FAILED');
  }

  if (!Array.isArray(peaks)) {
    throw new AppError('Waveform data is invalid', 500, 'WAVEFORM_INVALID_DATA');
  }

  return {
    track_id: track.id,
    peaks,
  };
};

module.exports = {
  uploadTrack,
  getTrackById,
  updateTrackVisibility,
  getPrivateShareLink,
  getTrackWaveform,
  getMyTracks,
  deleteTrack,
  updateTrack,
  getTrackStream,
};

//
// TODO Add track upload limit validations based on subscription plan
//
