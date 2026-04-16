// ============================================================
// services/feed.service.js
// Owner : Omar Hamza (BE-5)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const {
  getMoreOfWhatYouLike: getMoreOfWhatYouLikeModel,
  getDailyTracks,
  isFollowingArtist,
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
  getActivityFeed: getActivityFeedModel,
  getDiscoveryFeed: getDiscoveryFeedModel,
} = require('../models/feed.model');

const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');
const { getOrSetCache } = require('../utils/cache');

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MIX_ID_REGEX =
  /^mix_genre_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

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
const HOME_GLOBAL_CACHE_KEY = 'home:global';
const HOME_GLOBAL_CACHE_TTL_SECONDS = 300;
const HOME_USER_CACHE_TTL_SECONDS = 600;
const DISCOVERY_HOT_TTL_SECONDS = 120;
const DISCOVERY_MORE_TTL_SECONDS = 300;
const DISCOVERY_DAILY_MIX_TTL_SECONDS = 300;
const DISCOVERY_WEEKLY_MIX_TTL_SECONDS = 600;
const DISCOVERY_MIX_BY_ID_TTL_SECONDS = 600;
const DISCOVERY_ALBUMS_TTL_SECONDS = 300;
const DISCOVERY_GENRE_TTL_SECONDS = 300;

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
    const rest = { ...track };
    delete rest.source_rank;
    delete rest.total_count;

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

function enforceArtistDiversity(tracks, { maxPerArtist = 2, limit = MIX_TRACK_LIMIT } = {}) {
  const input = Array.isArray(tracks) ? tracks : [];
  const selected = [];
  const perArtist = new Map();

  for (const track of input) {
    const artistId = track.user_id;
    const currentCount = perArtist.get(artistId) || 0;
    if (currentCount >= maxPerArtist) {
      continue;
    }

    selected.push(track);
    perArtist.set(artistId, currentCount + 1);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
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
  let candidateGenres = [];

  if (userId) {
    const [personalizedGenres, trendingGenres] = await Promise.all([
      getPersonalizedMixGenreCandidates(userId, HOME_MIX_LIMIT),
      getTrendingMixGenreCandidates(HOME_MIX_LIMIT, userId),
    ]);

    const merged = [];
    const seen = new Set();

    for (const genre of Array.isArray(personalizedGenres) ? personalizedGenres : []) {
      if (!genre?.genre_id || seen.has(genre.genre_id)) continue;
      merged.push(genre);
      seen.add(genre.genre_id);
      if (merged.length >= HOME_MIX_LIMIT) break;
    }

    if (merged.length < HOME_MIX_LIMIT) {
      for (const genre of Array.isArray(trendingGenres) ? trendingGenres : []) {
        if (!genre?.genre_id || seen.has(genre.genre_id)) continue;
        merged.push(genre);
        seen.add(genre.genre_id);
        if (merged.length >= HOME_MIX_LIMIT) break;
      }
    }

    candidateGenres = merged;
  } else {
    candidateGenres = await getTrendingMixGenreCandidates(HOME_MIX_LIMIT, null);
  }

  const genreIds = (Array.isArray(candidateGenres) ? candidateGenres : [])
    .map((g) => g.genre_id)
    .filter(Boolean)
    .slice(0, HOME_MIX_LIMIT);

  if (genreIds.length === 0) return [];

  const previewTracks = await getTopPreviewTracksByGenreIds(genreIds, userId);
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

function buildHomeUserCacheKey(userId) {
  return `home:user:${userId}`;
}

function buildDiscoveryHotCacheKey(userId) {
  return `discovery:hot:${userId || 'guest'}`;
}

function buildDiscoveryMoreCacheKey(userId, limit, offset) {
  return `discovery:more:${userId}:${limit}:${offset}`;
}

function buildDiscoveryDailyMixCacheKey(userId) {
  return `discovery:daily_mix:${userId}`;
}

function buildDiscoveryWeeklyMixCacheKey(userId) {
  return `discovery:weekly_mix:${userId}`;
}

function buildDiscoveryMixByIdCacheKey(mixId, userId) {
  return `discovery:mix:${mixId}:${userId}`;
}

function buildDiscoveryAlbumsCacheKey(userId, limit, offset) {
  return `discovery:albums:${userId}:${limit}:${offset}`;
}

function buildDiscoveryTrendingByGenreCacheKey(genreId, limit) {
  return `discovery:genre:${genreId}:${limit}`;
}

function buildTrendingByGenrePayload(trendingByGenre) {
  return {
    genres: Array.isArray(trendingByGenre?.genres) ? trendingByGenre.genres : [],
    initial_tab: trendingByGenre?.initial_tab ?? {
      genre_id: ZERO_UUID,
      genre_name: 'Unknown',
      tracks: [],
    },
  };
}

async function resolveHotForYou(userId, { moreOfWhatYouLike, fallbackTrack } = {}) {
  const safeFallbackTrack = fallbackTrack ?? null;
  const personalizedTrack = sanitizeTracks(moreOfWhatYouLike?.items)[0] ?? null;

  if (userId && personalizedTrack) {
    const fromFollowedArtist = await isFollowingArtist(userId, personalizedTrack.user_id);
    return {
      track: personalizedTrack,
      reason: fromFollowedArtist ? 'based_on_followed_artists' : 'based_on_recent_plays',
      valid_until: getEndOfUtcDayIso(),
    };
  }

  if (safeFallbackTrack) {
    return {
      track: safeFallbackTrack,
      reason: 'global_trending',
      valid_until: getEndOfUtcDayIso(),
    };
  }

  throw new AppError('No featured track available.', 404, 'RESOURCE_NOT_FOUND');
}

async function buildHomeGlobal() {
  const [trendingByGenre, artistsToWatch, discoverWithStations] = await Promise.all([
    getHomeTrendingByGenre(HOME_TRACK_LIMIT, null),
    getArtistsToWatchModel(HOME_ARTISTS_LIMIT, null),
    getDiscoverWithStations(HOME_STATIONS_LIMIT, null),
  ]);

  return {
    trending_by_genre: buildTrendingByGenrePayload(trendingByGenre),
    artists_to_watch: Array.isArray(artistsToWatch) ? artistsToWatch : [],
    discover_with_stations: Array.isArray(discoverWithStations) ? discoverWithStations : [],
  };
}

async function buildHomeUser(userId) {
  const [homeMoreOfWhatYouLike, previewDailyTracks, mixedForYou, weeklyPreviewTracks] =
    await Promise.all([
      getMoreOfWhatYouLikeModel(userId, HOME_TRACK_LIMIT, 0),
      getDailyTracks(HOME_PREVIEW_LIMIT, userId),
      buildMixedForYou(userId),
      getWeeklyTracks(userId, HOME_PREVIEW_LIMIT),
    ]);

  const dailyPreviewTrack = sanitizeTracks(previewDailyTracks)[0] ?? null;
  const hotForYouPayload = await resolveHotForYou(userId, {
    moreOfWhatYouLike: homeMoreOfWhatYouLike,
    fallbackTrack: dailyPreviewTrack,
  });

  const hotTrack = hotForYouPayload.track;

  const weeklyHasPersonalized = Array.isArray(weeklyPreviewTracks)
    ? weeklyPreviewTracks.some((t) => Number(t.source_rank) <= 5)
    : false;

  const weeklyPreviewTrack = weeklyHasPersonalized
    ? (sanitizeTracks(weeklyPreviewTracks)[0] ?? hotTrack)
    : hotTrack;

  return {
    hot_for_you: {
      track: hotTrack,
      reason: hotForYouPayload.reason,
      valid_until: hotForYouPayload.valid_until,
    },
    more_of_what_you_like: {
      tracks: Array.isArray(homeMoreOfWhatYouLike?.items)
        ? sanitizeTracks(homeMoreOfWhatYouLike.items)
        : [],
      source: homeMoreOfWhatYouLike?.source || 'trending_fallback',
    },
    mixed_for_you: Array.isArray(mixedForYou) ? mixedForYou.slice(0, HOME_MIX_LIMIT) : [],
    made_for_you: {
      daily_mix: buildCuratedMixSummary(
        DAILY_MIX_ID,
        DAILY_MIX_TITLE,
        'Fresh trending tracks updated daily.',
        CURATED_MIX_LIMIT,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        dailyPreviewTrack ?? hotTrack
      ),
      weekly_mix: buildCuratedMixSummary(
        WEEKLY_MIX_ID,
        WEEKLY_MIX_TITLE,
        'Personalized tracks based on follows and genre signals.',
        CURATED_MIX_LIMIT,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        weeklyPreviewTrack
      ),
    },
  };
}

// ─────────────────────────────────────────────────────────────
// getHome
// ─────────────────────────────────────────────────────────────

async function getHome(userId) {
  if (userId) {
    await ensureUserExists(userId);
  }

  const globalData = await getOrSetCache(
    HOME_GLOBAL_CACHE_KEY,
    HOME_GLOBAL_CACHE_TTL_SECONDS,
    buildHomeGlobal
  );

  if (!userId) {
    const hotForYouPayload = await getHotForYou();

    return {
      hot_for_you: {
        track: hotForYouPayload.track,
        reason: hotForYouPayload.reason,
        valid_until: hotForYouPayload.valid_until,
      },
      trending_by_genre: buildTrendingByGenrePayload(globalData.trending_by_genre),
      more_of_what_you_like: null,
      mixed_for_you: null,
      made_for_you: null,
      artists_to_watch: Array.isArray(globalData.artists_to_watch)
        ? globalData.artists_to_watch
        : [],
      discover_with_stations: Array.isArray(globalData.discover_with_stations)
        ? globalData.discover_with_stations
        : [],
    };
  }

  const userData = await getOrSetCache(
    buildHomeUserCacheKey(userId),
    HOME_USER_CACHE_TTL_SECONDS,
    () => buildHomeUser(userId)
  );

  return {
    hot_for_you: userData.hot_for_you,
    trending_by_genre: buildTrendingByGenrePayload(globalData.trending_by_genre),
    more_of_what_you_like: userData.more_of_what_you_like,
    mixed_for_you: userData.mixed_for_you,
    made_for_you: userData.made_for_you,
    artists_to_watch: Array.isArray(globalData.artists_to_watch) ? globalData.artists_to_watch : [],
    discover_with_stations: Array.isArray(globalData.discover_with_stations)
      ? globalData.discover_with_stations
      : [],
  };
}

// ─────────────────────────────────────────────────────────────
// getHotForYou (standalone endpoint)
// ─────────────────────────────────────────────────────────────

async function getHotForYou(userId = null) {
  const cacheKey = buildDiscoveryHotCacheKey(userId);

  return getOrSetCache(cacheKey, DISCOVERY_HOT_TTL_SECONDS, async () => {
    if (userId) {
      const [moreOfWhatYouLike, tracks] = await Promise.all([
        getMoreOfWhatYouLikeModel(userId, 1, 0),
        getDailyTracks(HOME_PREVIEW_LIMIT, userId),
      ]);
      const fallbackTrack = sanitizeTracks(tracks)[0] ?? null;
      return resolveHotForYou(userId, { moreOfWhatYouLike, fallbackTrack });
    }

    const tracks = await getDailyTracks(HOME_PREVIEW_LIMIT, null);
    const fallbackTrack = sanitizeTracks(tracks)[0] ?? null;
    return resolveHotForYou(null, { fallbackTrack });
  });
}

// ─────────────────────────────────────────────────────────────
// getTrendingByGenre (lazy-load tab)
// ─────────────────────────────────────────────────────────────

async function getTrendingByGenre(genreId, pagination, userId = null) {
  const genre = await findGenreById(genreId);
  if (!genre) {
    throw new AppError('Genre not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { limit, offset } = pagination;
  const fetchTrendingByGenre = async () => {
    const { rows: tracks, total } = await findTracksByGenreIdPaginated(
      genreId,
      limit,
      offset,
      userId
    );

    return {
      genre_id: genre.id,
      genre_name: genre.name,
      tracks: sanitizeTracks(tracks),
      pagination: { limit, offset, total },
    };
  };

  // Only cache first page for anonymous requests to avoid cross-user personalization leaks.
  const shouldUseCache = offset === 0 && !userId;
  if (!shouldUseCache) {
    return fetchTrendingByGenre();
  }

  const cacheKey = buildDiscoveryTrendingByGenreCacheKey(genreId, limit);
  return getOrSetCache(cacheKey, DISCOVERY_GENRE_TTL_SECONDS, fetchTrendingByGenre);
}

// ─────────────────────────────────────────────────────────────
// getMoreOfWhatYouLike
// ─────────────────────────────────────────────────────────────

async function getMoreOfWhatYouLike(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const cacheKey = buildDiscoveryMoreCacheKey(userId, limit, offset);

  return getOrSetCache(cacheKey, DISCOVERY_MORE_TTL_SECONDS, async () => {
    const { items, total, source } = await getMoreOfWhatYouLikeModel(userId, limit, offset);

    return {
      data: sanitizeTracks(items),
      source,
      pagination: { limit, offset, total },
    };
  });
}

// ─────────────────────────────────────────────────────────────
// getAlbumsForYou
// ─────────────────────────────────────────────────────────────

async function getAlbumsForYou(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const cacheKey = buildDiscoveryAlbumsCacheKey(userId, limit, offset);

  return getOrSetCache(cacheKey, DISCOVERY_ALBUMS_TTL_SECONDS, async () => {
    const followedResult = await getAlbumsFromFollowedArtists(userId, limit, offset);
    if ((followedResult.items?.length ?? 0) > 0) {
      return {
        data: followedResult.items,
        source: 'followed_artists',
        pagination: { limit, offset, total: followedResult.total },
      };
    }

    const fallbackResult = await getTopAlbums(limit, offset, userId);
    return {
      data: fallbackResult.items,
      source: 'global_fallback',
      pagination: { limit, offset, total: fallbackResult.total },
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Curated mixes
// ─────────────────────────────────────────────────────────────

async function getDailyMix(userId) {
  await ensureUserExists(userId);

  const cacheKey = buildDiscoveryDailyMixCacheKey(userId);

  return getOrSetCache(cacheKey, DISCOVERY_DAILY_MIX_TTL_SECONDS, async () => {
    const tracks = await getDailyTracks(CURATED_MIX_LIMIT, userId);
    return buildMixPayload(DAILY_MIX_ID, DAILY_MIX_TITLE, tracks);
  });
}

async function getWeeklyMix(userId) {
  await ensureUserExists(userId);

  const cacheKey = buildDiscoveryWeeklyMixCacheKey(userId);

  return getOrSetCache(cacheKey, DISCOVERY_WEEKLY_MIX_TTL_SECONDS, async () => {
    const weeklyTracks = await getWeeklyTracks(userId, CURATED_MIX_LIMIT);
    const hasPersonalizedResult = Array.isArray(weeklyTracks)
      ? weeklyTracks.some((t) => Number(t.source_rank) <= 5)
      : false;

    if (!hasPersonalizedResult) {
      const fallbackTracks = await getDailyTracks(CURATED_MIX_LIMIT, userId);
      return buildMixPayload(WEEKLY_MIX_ID, WEEKLY_MIX_TITLE, fallbackTracks);
    }

    return buildMixPayload(WEEKLY_MIX_ID, WEEKLY_MIX_TITLE, weeklyTracks);
  });
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
  const cacheKey = buildDiscoveryMixByIdCacheKey(mixId, userId);

  return getOrSetCache(cacheKey, DISCOVERY_MIX_BY_ID_TTL_SECONDS, async () => {
    const genre = await findGenreById(genreId);

    if (!genre) {
      throw new AppError('Mix not found.', 404, 'RESOURCE_NOT_FOUND');
    }

    const tracks = await findTracksByGenreId(genreId, MIX_TRACK_LIMIT, userId);
    const safeTracks = sanitizeTracks(Array.isArray(tracks) ? tracks : []);
    const diverseTracks = enforceArtistDiversity(safeTracks, {
      maxPerArtist: 2,
      limit: MIX_TRACK_LIMIT,
    });

    return {
      mix_id: mixId,
      title: `${genre.name} Mix`,
      cover_url: diverseTracks[0]?.cover_image ?? null,
      tracks: diverseTracks,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Stations
// ─────────────────────────────────────────────────────────────

async function listStations(pagination, userId = null) {
  const { limit, offset } = pagination;
  const { items, total } = await getStationsPaginated(limit, offset, userId);

  return {
    data: items,
    pagination: { limit, offset, total },
  };
}

async function getStationTracks(artistId, pagination, userId = null) {
  const station = await getStationByArtistId(artistId, userId);
  if (!station) {
    throw new AppError('Station not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { limit, offset } = pagination;
  const { items, total } = await getTracksByArtistId(artistId, limit, offset, userId);

  return {
    station,
    data: sanitizeTracks(items),
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// Artists to watch (standalone paginated endpoint)
// ─────────────────────────────────────────────────────────────

async function getArtistsToWatch(pagination, userId = null) {
  const { limit, offset } = pagination;
  const { items, total } = await getArtistsToWatchPaginated(limit, offset, userId);

  return {
    data: items,
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// getActivityFeed (user feed endpoint)
// ─────────────────────────────────────────────────────────────

async function getActivityFeedService(userId, limit = 20, cursor = null) {
  await ensureUserExists(userId);

  // Optionally: build a cache key if you want caching
  //const cacheKey = `feed:activity:${userId}:${limit}:${cursor || 'null'}`;

  // For now, just call the model directly
  const { items, hasMore } = await getActivityFeedModel(userId, limit, cursor);

  return {
    data: items,
    hasMore,
    pagination: { limit, cursor },
  };
}

async function getDiscoveryFeedService(userId, limit = 20, cursor = null) {
  await ensureUserExists(userId);

  const { items, hasMore, nextCursor } = await getDiscoveryFeedModel(userId, limit, cursor);

  const shaped = items.map((row) => ({
    id: row.track_id,
    track: {
      id: row.track_id,
      title: row.title,
      duration: row.duration,
      play_count: row.play_count,
      like_count: row.like_count,
      cover_image: row.cover_image,
      audio_url: row.audio_url,
      stream_url: row.stream_url,
      artist: {
        id: row.artist_id,
        username: row.artist_username,
      },
    },
    reason: {
      type: row.reason_type,
      label: buildReasonLabel(row.reason_type, row.artist_username),
      source_id: row.source_id,
    },
  }));

  return { data: shaped, hasMore, nextCursor };
}

function buildReasonLabel(type, artistUsername) {
  switch (type) {
    case 'liked_by_you':
      return 'Because you liked a similar track';
    case 'followed_artist':
      return `Because you follow ${artistUsername}`;
    case 'played_by_you':
      return 'Because you played something similar';
    case 'new_release':
      return `New release by ${artistUsername}`;
    default:
      return '';
  }
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
  getActivityFeedService,
  getDiscoveryFeedService,
};
