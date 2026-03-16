// ============================================================
// services/tracks.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const AppError = require('../utils/app-error.js');
const tracksModel = require('../models/track.model.js');
const storageService = require('./storage.service.js');

const toBool = (v, d) => {
  if (v === undefined || v === null || v === '') return d;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
};

const parseArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch { return []; }
};

const clean = (v) => (v === undefined || v === null || v === '' ? null : v);

const uploadTrack = async ({ user, audioFile, coverImageFile, body }) => {
  const userId = user?.user_id || user?.id || user?.sub;
  if (!userId) throw new AppError('Authenticated user not found', 401, 'AUTH_TOKEN_INVALID');

  const tagIds = parseArray(body.tags || body.tag_ids);
  if (tagIds.length > 10) {
    throw new AppError('Maximum 10 tags allowed', 400, 'VALIDATION_FAILED');
  }

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
    geo_restriction_type: clean(body.geo_restriction_type) || 'worldwide',
    geo_regions: parseArray(body.geo_regions || '[]'),

    user_id: userId,
  };

  const createdTrack = await tracksModel.createTrack(trackData);


  if (tagIds.length) {
    await tracksModel.addTrackTags(createdTrack.id, tagIds);
  }

  // until docs/DB are aligned, make owner the first artist
  await tracksModel.addTrackArtists(createdTrack.id, [userId]);

  return createdTrack;
};

module.exports = { uploadTrack };
