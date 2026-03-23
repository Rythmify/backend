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

const GEO_RESTRICTION_TYPES = ['worldwide', 'exclusive_regions', 'blocked_regions'];

const looksLikeDbId = (value) =>
  typeof value === 'string' && value.includes('-');

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

const toBool = (v, d) => {
  if (v === undefined || v === null || v === '') return d;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
};

const parseArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
};

const clean = (v) => (v === undefined || v === null || v === '' ? null : v);

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

  const rows = await tagModel.findByNames(tagNames);
  const foundNames = new Set(rows.map((row) => row.name.toLowerCase()));
  const missing = tagNames.filter((name) => !foundNames.has(name));

  if (missing.length) {
    throw new AppError(`Unknown tag(s): ${missing.join(', ')}`, 400, 'VALIDATION_FAILED');
  }

  const idByName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  return {
    tagNames,
    tagIds: tagNames.map((name) => idByName.get(name)),
  };
};

const hydrateTagNamesByIds = async (tagIds) => {
  const ids = (tagIds || []).map(String);

  if (!ids.length) {
    return [];
  }

  const rows = await tagModel.findByIds(ids);
  const nameById = new Map(rows.map((row) => [String(row.id), row.name]));

  return ids.map((id) => nameById.get(id)).filter(Boolean);
};

const mapTrackTagsToNames = async (track) => {
  if (!track || !Array.isArray(track.tags)) {
    return track;
  }

  if (!track.tags.length) {
    return { ...track, tags: [] };
  }

  const hasAnyDbIds = track.tags.some((tag) => looksLikeDbId(tag));

  if (!hasAnyDbIds) {
    return track;
  }

  const resolvedTags = await hydrateTagNamesByIds(
    track.tags.filter((tag) => looksLikeDbId(tag))
  );

  const resolvedIdTags = track.tags.filter((tag) => looksLikeDbId(tag));
  const nameById = new Map(
    resolvedIdTags.map((id, index) => [String(id), resolvedTags[index]])
  );

  return {
    ...track,
    tags: track.tags.map((tag) => nameById.get(String(tag)) || tag),
  };
};

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

  const trackData = {
    title: body.title.trim(),
    description: clean(body.description),
    genre_id: genreId,
    cover_image: coverImageUrl,
    audio_url: uploadedAudio.url,
    file_size: audioFile.size,
    status: 'processing',
    is_public: toBool(body.is_public, true),

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

  return {
    ...createdTrack,
    tags: resolvedTags?.tagNames || [],
  };
};

const getTrackById = async (trackId, requesterUserId = null) => {
  const track = await tracksModel.findTrackByIdWithDetails(trackId);

  if (!track) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  const isOwner = requesterUserId === track.user_id;

  if (track.is_hidden && !isOwner) {
    throw new AppError('Track not found', 404, 'TRACK_NOT_FOUND');
  }

  if (!track.is_public && !isOwner) {
    throw new AppError('This track is private', 403, 'RESOURCE_PRIVATE');
  }

  return mapTrackTagsToNames(track);
};

const updateTrackVisibility = async (trackId, userId, isPublic) => {
  if (typeof isPublic !== 'boolean') {
    throw new AppError('is_public must be a boolean', 400, 'VALIDATION_ERROR');
  }

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

  const updatedTrack = await tracksModel.updateTrackVisibility(trackId, isPublic);

  return {
    track_id: updatedTrack.id,
    is_public: updatedTrack.is_public,
  };
};

const getMyTracks = async (userId, query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const status = query.status ?? null;
  const allowedStatuses = ['processing', 'ready', 'failed'];

  if (status && !allowedStatuses.includes(status)) {
    throw new AppError('Invalid track status', 400, 'VALIDATION_ERROR');
  }

  const { items, total } = await tracksModel.findMyTracks(userId, {
    limit,
    offset,
    status,
  });

  return {
    items: await mapTrackListTagsToNames(items),
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  };
};

const deleteTrack = async (trackId, userId) => {
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

const updateTrack = async ({ trackId, userId, payload, coverImageFile }) => {
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
    throw new AppError('No valid fields provided for update', 400, 'VALIDATION_ERROR');
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
    updateData.is_public = toBool(payload.is_public, track.is_public);
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

const getTrackStream = async (trackId, requesterUserId = null) => {
  const track = await getTrackById(trackId, requesterUserId);

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

module.exports = {
  uploadTrack,
  getTrackById,
  updateTrackVisibility,
  getMyTracks,
  deleteTrack,
  updateTrack,
  getTrackStream,
};

//
// TODO Add track upload limit validations based on subscription plan
//