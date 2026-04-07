// ============================================================
// services/feed.service.js
// Owner : Omar Hamza (BE-5)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const {
  getMoreOfWhatYouLike: getMoreOfWhatYouLikeModel,
  getAlbumsFromFollowedArtists,
  getTopAlbums,
  findGenreById,
  findTracksByGenreId,
} = require('../models/feed.model');

const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

const MIX_ID_REGEX =
  /^mix_genre_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/;
const MIX_TRACK_LIMIT = 30;

async function ensureUserExists(userId) {
  const user = await userModel.findById(userId);

  if (!user) {
    throw new AppError('User not found.', 404, 'RESOURCE_NOT_FOUND');
  }
}

async function getMoreOfWhatYouLike(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;

  const { items, total, source } = await getMoreOfWhatYouLikeModel(userId, limit, offset);

  return {
    data: items,
    source,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}

async function getAlbumsForYou(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;

  const followedResult = await getAlbumsFromFollowedArtists(userId, limit, offset);
  if ((followedResult.items?.length ?? 0) > 0) {
    return {
      data: Array.isArray(followedResult.items) ? followedResult.items : [],
      source: 'followed_artists',
      pagination: {
        limit,
        offset,
        total: followedResult.total,
      },
    };
  }

  const fallbackResult = await getTopAlbums(limit, offset);
  return {
    data: Array.isArray(fallbackResult.items) ? fallbackResult.items : [],
    source: 'global_fallback',
    pagination: {
      limit,
      offset,
      total: fallbackResult.total,
    },
  };
}

function parseGenreIdFromMixId(mixId) {
  const match = MIX_ID_REGEX.exec(mixId || '');
  if (!match) {
    throw new AppError('Invalid mixId format.', 400, 'VALIDATION_FAILED');
  }

  return match[1];
}

async function getMixById(userId, mixId) {
  await ensureUserExists(userId);

  const genreId = parseGenreIdFromMixId(mixId);
  const genre = await findGenreById(genreId);

  if (!genre) {
    throw new AppError('Mix not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const tracks = await findTracksByGenreId(genreId, MIX_TRACK_LIMIT);
  const safeTracks = Array.isArray(tracks) ? tracks : [];

  return {
    mix_id: mixId,
    title: `${genre.name} Mix`,
    cover_url: safeTracks[0]?.cover_image ?? null,
    tracks: safeTracks,
  };
}

module.exports = {
  getMoreOfWhatYouLike,
  getAlbumsForYou,
  getMixById,
};
