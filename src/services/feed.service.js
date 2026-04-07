// ============================================================
// services/feed.service.js
// Owner : Omar Hamza (BE-5)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const {
  getMoreOfWhatYouLike: getMoreOfWhatYouLikeModel,
  getDailyTracks,
  getWeeklyTracks,
  getHomeTrendingByGenre,
  getArtistsToWatch,
  getDiscoverWithStations,
  getPersonalizedMixGenreCandidates,
  getTrendingMixGenreCandidates,
  getTopPreviewTracksByGenreIds,
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
const DAILY_MIX_ID = 'daily_drops';
const WEEKLY_MIX_ID = 'weekly_wave';
const DAILY_MIX_TITLE = 'Daily Drops';
const WEEKLY_MIX_TITLE = 'Weekly Wave';
const CURATED_MIX_LIMIT = 30;
const HOME_TRACK_LIMIT = 20;
const HOME_PREVIEW_LIMIT = 1;
const HOME_ARTISTS_LIMIT = 10;
const HOME_STATIONS_LIMIT = 10;
const HOME_MIX_LIMIT = 6;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

async function ensureUserExists(userId) {
  const user = await userModel.findById(userId);

  if (!user) {
    throw new AppError('User not found.', 404, 'RESOURCE_NOT_FOUND');
  }
}

function getEndOfUtcDayIso() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return end.toISOString();
}

function buildCuratedMixSummary(id, label, description, trackCount, refreshDate, previewTrack) {
  const safePreviewTrack = previewTrack ?? null;

  return {
    id,
    label,
    description,
    track_count: trackCount,
    refreshes_at: refreshDate.toISOString(),
    preview_track: safePreviewTrack,
    cover_url: safePreviewTrack?.cover_image ?? null,
  };
}

function buildMixedForYouPreviewMixes(genres, previewTracks) {
  const safeGenres = Array.isArray(genres) ? genres : [];
  const trackByGenreId = new Map(
    (Array.isArray(previewTracks) ? previewTracks : []).map((track) => [track.genre_id, track])
  );

  return safeGenres
    .map((genre) => {
      const previewTrack = trackByGenreId.get(genre.genre_id);
      if (!previewTrack) {
        return null;
      }

      return {
        mix_id: `mix_genre_${genre.genre_id}`,
        title: `${genre.genre_name} Mix`,
        cover_url: previewTrack.cover_image ?? null,
        preview_track: previewTrack,
      };
    })
    .filter(Boolean);
}

async function buildMixedForYou(userId) {
  const candidateGenres = userId
    ? await getPersonalizedMixGenreCandidates(userId, HOME_MIX_LIMIT)
    : await getTrendingMixGenreCandidates(HOME_MIX_LIMIT);

  const genreIds = (Array.isArray(candidateGenres) ? candidateGenres : [])
    .map((genre) => genre.genre_id)
    .filter(Boolean)
    .slice(0, HOME_MIX_LIMIT);

  const previewTracks = await getTopPreviewTracksByGenreIds(genreIds);
  return buildMixedForYouPreviewMixes(candidateGenres, previewTracks);
}

async function getHome(userId) {
  if (userId) {
    await ensureUserExists(userId);
  }

  const [
    previewDailyTracks,
    trendingFallbackTracks,
    trendingByGenre,
    mixedForYou,
    artistsToWatch,
    discoverWithStations,
  ] = await Promise.all([
    getDailyTracks(HOME_PREVIEW_LIMIT),
    getDailyTracks(HOME_TRACK_LIMIT),
    getHomeTrendingByGenre(HOME_TRACK_LIMIT),
    buildMixedForYou(userId),
    getArtistsToWatch(HOME_ARTISTS_LIMIT),
    getDiscoverWithStations(HOME_STATIONS_LIMIT),
  ]);

  const safePreviewDailyTracks = sanitizeTracks(previewDailyTracks);
  const safeTrendingFallbackTracks = sanitizeTracks(trendingFallbackTracks);
  const hotTrack = safePreviewDailyTracks[0] ?? safeTrendingFallbackTracks[0] ?? null;

  if (!hotTrack) {
    throw new AppError('No discovery tracks available.', 404, 'RESOURCE_NOT_FOUND');
  }

  const homeMoreOfWhatYouLike = userId
    ? await getMoreOfWhatYouLikeModel(userId, HOME_TRACK_LIMIT, 0)
    : {
        items: safeTrendingFallbackTracks,
        source: 'trending_fallback',
      };

  const weeklyPreviewTracks = userId ? await getWeeklyTracks(userId, HOME_PREVIEW_LIMIT) : [];
  const weeklyHasPersonalized = Array.isArray(weeklyPreviewTracks)
    ? weeklyPreviewTracks.some((track) => Number(track.source_rank) <= 5)
    : false;

  const weeklyPreviewTrack = weeklyHasPersonalized
    ? (sanitizeTracks(weeklyPreviewTracks)[0] ?? null)
    : hotTrack;
  const dailyPreviewTrack = safePreviewDailyTracks[0] ?? hotTrack;

  const madeForYou = userId
    ? {
        daily_mix: buildCuratedMixSummary(
          DAILY_MIX_ID,
          DAILY_MIX_TITLE,
          'Fresh trending tracks updated daily.',
          CURATED_MIX_LIMIT,
          new Date(Date.now() + 24 * 60 * 60 * 1000),
          dailyPreviewTrack
        ),
        weekly_mix: buildCuratedMixSummary(
          WEEKLY_MIX_ID,
          WEEKLY_MIX_TITLE,
          'Personalized tracks based on follows and genre signals.',
          CURATED_MIX_LIMIT,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          weeklyPreviewTrack
        ),
      }
    : null;

  return {
    hot_for_you: {
      track: hotTrack,
      reason: userId ? 'global trending' : null,
      valid_until: getEndOfUtcDayIso(),
    },
    trending_by_genre: {
      genres: Array.isArray(trendingByGenre.genres) ? trendingByGenre.genres : [],
      initial_tab: trendingByGenre.initial_tab ?? {
        genre_id: ZERO_UUID,
        genre_name: 'Unknown',
        tracks: [],
      },
    },
    more_of_what_you_like: {
      tracks: Array.isArray(homeMoreOfWhatYouLike.items) ? homeMoreOfWhatYouLike.items : [],
      source: homeMoreOfWhatYouLike.source || 'trending_fallback',
    },
    mixed_for_you: Array.isArray(mixedForYou) ? mixedForYou.slice(0, HOME_MIX_LIMIT) : [],
    made_for_you: madeForYou,
    artists_to_watch: Array.isArray(artistsToWatch) ? artistsToWatch : [],
    discover_with_stations: Array.isArray(discoverWithStations) ? discoverWithStations : [],
  };
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

function sanitizeTracks(tracks) {
  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks.map((track) => {
    const normalizedTrack = { ...track };
    delete normalizedTrack.source_rank;
    return normalizedTrack;
  });
}

function buildMixPayload(mixId, title, tracks) {
  const safeTracks = sanitizeTracks(tracks);

  return {
    mix_id: mixId,
    title,
    cover_url: safeTracks[0]?.cover_image ?? null,
    tracks: safeTracks,
  };
}

async function getDailyMix(userId) {
  await ensureUserExists(userId);

  const tracks = await getDailyTracks(CURATED_MIX_LIMIT);
  return buildMixPayload(DAILY_MIX_ID, DAILY_MIX_TITLE, tracks);
}

async function getWeeklyMix(userId) {
  await ensureUserExists(userId);

  const weeklyTracks = await getWeeklyTracks(userId, CURATED_MIX_LIMIT);
  const hasPersonalizedResult = Array.isArray(weeklyTracks)
    ? weeklyTracks.some((track) => Number(track.source_rank) <= 5)
    : false;

  if (!hasPersonalizedResult) {
    const fallbackTracks = await getDailyTracks(CURATED_MIX_LIMIT);
    return buildMixPayload(WEEKLY_MIX_ID, WEEKLY_MIX_TITLE, fallbackTracks);
  }

  return buildMixPayload(WEEKLY_MIX_ID, WEEKLY_MIX_TITLE, weeklyTracks);
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
  getHome,
  getMoreOfWhatYouLike,
  getAlbumsForYou,
  getDailyMix,
  getWeeklyMix,
  getMixById,
};
