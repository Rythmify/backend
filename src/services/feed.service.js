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
  getArtistsToWatch: getArtistsToWatchModel,
  getDiscoverWithStations,
  getPersonalizedMixGenreCandidates,
  getTrendingMixGenreCandidates,
  getTopPreviewTracksByGenreIds,
  getAlbumsFromFollowedArtists,
  getTopAlbums,
  findGenreById,
  findTracksByGenreId,
  getStationByArtistId,
  getTracksByArtistId,
  getStationsPaginated,
  getArtistsToWatchPaginated,
} = require('../models/feed.model');

const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

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

/**
 * Removes internal ranking fields that must never be exposed to clients.
 * Also normalises nullable fields to explicit null.
 */
function sanitizeTracks(tracks) {
  if (!Array.isArray(tracks)) return [];

  return tracks.map((track) => {
    const { source_rank, total_count, ...rest } = track;   // strip both internal columns
    return {
      ...rest,
      cover_image: rest.cover_image ?? null,
      genre_name: rest.genre_name ?? null,
      artist_name: rest.artist_name ?? null,
      stream_url: rest.stream_url ?? null,
    };
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

// ─────────────────────────────────────────────────────────────
// Mixed For You helpers
// ─────────────────────────────────────────────────────────────

function buildMixedForYouPreviewMixes(genres, previewTracks) {
  const safeGenres = Array.isArray(genres) ? genres : [];
  const trackByGenreId = new Map(
    (Array.isArray(previewTracks) ? previewTracks : []).map((track) => [track.genre_id, track])
  );

  return safeGenres
    .map((genre) => {
      const previewTrack = trackByGenreId.get(genre.genre_id);
      if (!previewTrack) return null;

      const sanitized = sanitizeTracks([previewTrack])[0];

      return {
        mix_id: `mix_genre_${genre.genre_id}`,
        title: `${genre.genre_name} Mix`,
        cover_url: previewTrack.cover_image ?? null,
        preview_track: sanitized,
      };
    })
    .filter(Boolean);
}

async function buildMixedForYou(userId) {
  const candidateGenres = userId
    ? await getPersonalizedMixGenreCandidates(userId, HOME_MIX_LIMIT)
    : await getTrendingMixGenreCandidates(HOME_MIX_LIMIT);

  const genreIds = (Array.isArray(candidateGenres) ? candidateGenres : [])
    .map((g) => g.genre_id)
    .filter(Boolean)
    .slice(0, HOME_MIX_LIMIT);

  if (genreIds.length === 0) return [];

  const previewTracks = await getTopPreviewTracksByGenreIds(genreIds);
  return buildMixedForYouPreviewMixes(candidateGenres, previewTracks);
}

// ─────────────────────────────────────────────────────────────
// Curated mix summary (card shown on home page)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// getHome
// ─────────────────────────────────────────────────────────────

async function getHome(userId) {
  if (userId) {
    await ensureUserExists(userId);
  }

  // Run all independent queries in parallel — zero serial waterfalls
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
    getArtistsToWatchModel(HOME_ARTISTS_LIMIT),
    getDiscoverWithStations(HOME_STATIONS_LIMIT),
  ]);

  const safePreviewDailyTracks = sanitizeTracks(previewDailyTracks);
  const safeTrendingFallbackTracks = sanitizeTracks(trendingFallbackTracks);
  const hotTrack = safePreviewDailyTracks[0] ?? safeTrendingFallbackTracks[0] ?? null;

  if (!hotTrack) {
    throw new AppError('No discovery tracks available.', 404, 'RESOURCE_NOT_FOUND');
  }

  // more_of_what_you_like — personalized or trending fallback
  const homeMoreOfWhatYouLike = userId
    ? await getMoreOfWhatYouLikeModel(userId, HOME_TRACK_LIMIT, 0)
    : { items: safeTrendingFallbackTracks, source: 'trending_fallback', total: safeTrendingFallbackTracks.length };

  // Weekly mix preview — only fetch for authenticated users
  let weeklyPreviewTrack = hotTrack;
  if (userId) {
    const weeklyPreviewTracks = await getWeeklyTracks(userId, HOME_PREVIEW_LIMIT);
    const weeklyHasPersonalized = Array.isArray(weeklyPreviewTracks)
      ? weeklyPreviewTracks.some((t) => Number(t.source_rank) <= 5)
      : false;

    weeklyPreviewTrack = weeklyHasPersonalized
      ? (sanitizeTracks(weeklyPreviewTracks)[0] ?? hotTrack)
      : hotTrack;
  }

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
      // FIX: reason should reflect personalization intent, not always 'global trending'
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
      tracks: Array.isArray(homeMoreOfWhatYouLike.items)
        ? sanitizeTracks(homeMoreOfWhatYouLike.items)
        : [],
      source: homeMoreOfWhatYouLike.source || 'trending_fallback',
    },
    mixed_for_you: Array.isArray(mixedForYou) ? mixedForYou.slice(0, HOME_MIX_LIMIT) : [],
    made_for_you: madeForYou,
    artists_to_watch: Array.isArray(artistsToWatch) ? artistsToWatch : [],
    discover_with_stations: Array.isArray(discoverWithStations) ? discoverWithStations : [],
  };
}

// ─────────────────────────────────────────────────────────────
// getHotForYou (standalone endpoint)
// ─────────────────────────────────────────────────────────────

async function getHotForYou() {
  const tracks = await getDailyTracks(1);
  const safe = sanitizeTracks(tracks);
  const track = safe[0] ?? null;

  if (!track) {
    throw new AppError('No featured track available.', 404, 'RESOURCE_NOT_FOUND');
  }

  return {
    track,
    reason: null,
    valid_until: getEndOfUtcDayIso(),
  };
}

// ─────────────────────────────────────────────────────────────
// getTrendingByGenre (lazy-load tab)
// ─────────────────────────────────────────────────────────────

async function getTrendingByGenre(genreId, pagination) {
  const genre = await findGenreById(genreId);
  if (!genre) {
    throw new AppError('Genre not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { limit, offset } = pagination;
  const { rows: tracks, total } = await findTracksByGenreIdPaginated(genreId, limit, offset);

  return {
    genre_id: genre.id,
    genre_name: genre.name,
    tracks: sanitizeTracks(tracks),
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// getMoreOfWhatYouLike
// ─────────────────────────────────────────────────────────────

async function getMoreOfWhatYouLike(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const { items, total, source } = await getMoreOfWhatYouLikeModel(userId, limit, offset);

  return {
    data: sanitizeTracks(items),
    source,
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// getAlbumsForYou
// ─────────────────────────────────────────────────────────────

async function getAlbumsForYou(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;

  const followedResult = await getAlbumsFromFollowedArtists(userId, limit, offset);
  if ((followedResult.items?.length ?? 0) > 0) {
    return {
      data: followedResult.items,
      source: 'followed_artists',
      pagination: { limit, offset, total: followedResult.total },
    };
  }

  const fallbackResult = await getTopAlbums(limit, offset);
  return {
    data: fallbackResult.items,
    source: 'global_fallback',
    pagination: { limit, offset, total: fallbackResult.total },
  };
}

// ─────────────────────────────────────────────────────────────
// Curated mixes
// ─────────────────────────────────────────────────────────────

async function getDailyMix(userId) {
  await ensureUserExists(userId);

  const tracks = await getDailyTracks(CURATED_MIX_LIMIT);
  return buildMixPayload(DAILY_MIX_ID, DAILY_MIX_TITLE, tracks);
}

async function getWeeklyMix(userId) {
  await ensureUserExists(userId);

  const weeklyTracks = await getWeeklyTracks(userId, CURATED_MIX_LIMIT);
  const hasPersonalizedResult = Array.isArray(weeklyTracks)
    ? weeklyTracks.some((t) => Number(t.source_rank) <= 5)
    : false;

  if (!hasPersonalizedResult) {
    const fallbackTracks = await getDailyTracks(CURATED_MIX_LIMIT);
    return buildMixPayload(WEEKLY_MIX_ID, WEEKLY_MIX_TITLE, fallbackTracks);
  }

  return buildMixPayload(WEEKLY_MIX_ID, WEEKLY_MIX_TITLE, weeklyTracks);
}

// ─────────────────────────────────────────────────────────────
// getMixById (genre mix)
// ─────────────────────────────────────────────────────────────

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
  const safeTracks = sanitizeTracks(Array.isArray(tracks) ? tracks : []);

  return {
    mix_id: mixId,
    title: `${genre.name} Mix`,
    cover_url: safeTracks[0]?.cover_image ?? null,
    tracks: safeTracks,
  };
}

// ─────────────────────────────────────────────────────────────
// Stations
// ─────────────────────────────────────────────────────────────

async function listStations(pagination) {
  const { limit, offset } = pagination;
  const { items, total } = await getStationsPaginated(limit, offset);

  return {
    data: items,
    pagination: { limit, offset, total },
  };
}

async function getStationTracks(artistId, pagination) {
  const station = await getStationByArtistId(artistId);
  if (!station) {
    throw new AppError('Station not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { limit, offset } = pagination;
  const { items, total } = await getTracksByArtistId(artistId, limit, offset);

  return {
    station,
    data: sanitizeTracks(items),
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// Artists to watch (standalone paginated endpoint)
// ─────────────────────────────────────────────────────────────

async function getArtistsToWatch(pagination) {
  const { limit, offset } = pagination;
  const { items, total } = await getArtistsToWatchPaginated(limit, offset);

  return {
    data: items,
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// Internal re-export shim for model functions not yet in model
// (findTracksByGenreIdPaginated is a new model function added below)
// ─────────────────────────────────────────────────────────────

const { findTracksByGenreIdPaginated } = require('../models/feed.model');

module.exports = {
  getHome,
  getHotForYou,
  getTrendingByGenre,
  getMoreOfWhatYouLike,
  getAlbumsForYou,
  getDailyMix,
  getWeeklyMix,
  getMixById,
  listStations,
  getStationTracks,
  getArtistsToWatch,
};