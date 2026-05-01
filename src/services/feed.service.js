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
  getUserLikedGenreTrendingIds,
  getArtistsToWatch: getArtistsToWatchModel,
  getDiscoverWithStations,
  getPersonalizedMixGenreCandidates,
  getTrendingMixGenreCandidates,
  getTopPreviewTracksByGenreIds,
  getFirstPreviewTracksByAlbumIds,
  getAlbumsFromFollowedArtists,
  getTopAlbums,
  getAllAlbums,
  findGenreById,
  findTracksByGenreId,
  findTracksByGenreIds,
  getStationByArtistId,
  getTracksByArtistId,
  getStationsPaginated,
  getArtistsToWatchPaginated,
  getActivityFeed: getActivityFeedModel,
  getDiscoveryFeed: getDiscoveryFeedModel,
  findTracksByGenreIdPaginated,
} = require('../models/feed.model');

const userModel = require('../models/user.model');
const playlistModel = require('../models/playlist.model');
const { findLikedMixesByUser: findLikedMixesByUserModel } = require('../models/playlist.model');
const playlistLikesService = require('./playlist-likes.service');
const stationModel = require('../models/station.model');
const AppError = require('../utils/app-error');
const { getOrSetCache, invalidateCache, invalidateCachePattern } = require('../utils/cache');
const db = require('../config/db');
const { findRelatedTracks } = require('../models/track.model');
const { getLikedAlbumIds } = require('../models/album-like.model');
const { getSavedStationArtistIds } = require('../models/station.model');
const { maskPlaybackUrlsForGeo } = require('../utils/geo-restrictions');

const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MIX_ID_REGEX =
  /^mix_genre_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

const MIX_TRACK_LIMIT = 30;
const DAILY_MIX_TITLE = 'Daily Drops';
const WEEKLY_MIX_TITLE = 'Weekly Wave';
const CURATED_MIX_LIMIT = 30;
const HOME_TRACK_LIMIT = 20;
const HOME_PREVIEW_LIMIT = 1;
const HOME_ARTISTS_LIMIT = 10;
const HOME_STATIONS_LIMIT = 10;
const HOME_MIX_LIMIT = 6;
const HOME_ALBUMS_LIMIT = 6;
const STATION_CARD_TRACK_LIMIT = 10;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const HOME_GLOBAL_CACHE_KEY = 'home:global';
const HOME_STATIONS_CACHE_KEY = 'home:stations';
const HOME_GLOBAL_CACHE_TTL_SECONDS = 300;
const HOME_STATIONS_CACHE_TTL_SECONDS = 300;
const HOME_USER_CACHE_TTL_SECONDS = 600;
const STATIONS_LIST_CACHE_TTL_SECONDS = 300;
const STATION_ENRICH_CACHE_TTL_SECONDS = 600;
const DISCOVERY_HOT_TTL_SECONDS = 120;
const DISCOVERY_MORE_TTL_SECONDS = 300;
const DISCOVERY_DAILY_MIX_TTL_SECONDS = 300;
const DISCOVERY_WEEKLY_MIX_TTL_SECONDS = 600;
const DISCOVERY_MIX_BY_ID_TTL_SECONDS = 10800; // 3 hours
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
function sanitizeTracks(tracks, countryCode = null) {
  if (!Array.isArray(tracks)) return [];

  return tracks.map((track) => {
    const rest = { ...track };
    delete rest.source_rank;
    delete rest.total_count;

    return maskPlaybackUrlsForGeo(
      {
        ...rest,
        cover_image: rest.cover_image ?? null,
        preview_url: rest.preview_url ?? null,
        genre_name: rest.genre_name ?? null,
        artist_name: rest.artist_name ?? null,
        stream_url: rest.stream_url ?? null,
        created_at:
          rest.created_at instanceof Date
            ? rest.created_at.toISOString()
            : (rest.created_at ?? null),
      },
      countryCode
    );
  });
}

function decorateTracksWithLikedState(tracks, likedTrackIds) {
  if (!Array.isArray(tracks)) return [];

  return tracks.map((track) => ({
    ...track,
    is_liked_by_me: likedTrackIds instanceof Set ? likedTrackIds.has(track.id) : false,
  }));
}

function decorateTrackWithLikedState(track, likedTrackIds) {
  if (!track) return null;

  return {
    ...track,
    is_liked_by_me: likedTrackIds instanceof Set ? likedTrackIds.has(track.id) : false,
  };
}

function buildStationImages(tracks, artistProfilePicture) {
  return {
    left: tracks[0]?.cover_image ?? null,
    center: artistProfilePicture ?? null,
    right: tracks[1]?.cover_image ?? null,
  };
}

function buildStationPayload(station, tracks) {
  const safeStation = station ?? null;
  const safeTracks = sanitizeTracks(tracks);

  if (!safeStation || safeTracks.length === 0) {
    return null;
  }

  const artistProfilePicture = safeStation.cover_image ?? null;

  return {
    id: safeStation.id,
    artist_id: safeStation.artist_id,
    artist_name: safeStation.artist_name,
    images: buildStationImages(safeTracks, artistProfilePicture),
    preview_track: safeTracks[0] ?? null,
    track_count: Number(safeStation.track_count) || safeTracks.length,
    is_saved: false,
  };
}

/* istanbul ignore next */
async function enrichStations(stations, viewerUserId = null) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return [];
  }

  const enrichedStations = await Promise.all(
    stations.map(async (station) => {
      if (!station || Number(station.track_count) <= 0) {
        return null;
      }

      const cacheKey = `station:${station.artist_id}`;

      const payload = await getOrSetCache(cacheKey, STATION_ENRICH_CACHE_TTL_SECONDS, async () => {
        const { items: tracks } = await getTracksByArtistId(
          station.artist_id,
          STATION_CARD_TRACK_LIMIT,
          0,
          null
        );

        return buildStationPayload(station, tracks);
      });

      if (payload) {
        return {
          ...payload,
          is_saved: viewerUserId
            ? await stationModel.isStationSaved(viewerUserId, station.artist_id)
            : false,
        };
      }

      return payload;
    })
  );

  const filteredStations = enrichedStations.filter(Boolean);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[CACHE] Stations cached (${filteredStations.length} items)`);
  }

  return filteredStations;
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

/* istanbul ignore next */
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

/* istanbul ignore next */
function buildMixedForYouPreviewMixes(genres, previewTracks, genreToPlaylistId = new Map()) {
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
        mix_id: genreToPlaylistId.get(genre.genre_id) ?? `mix_genre_${genre.genre_id}`,
        title: `${genre.genre_name} Mix`,
        cover_url: previewTrack.cover_image ?? null,
        preview_track: sanitized,
      };
    })
    .filter(Boolean);
}

/* istanbul ignore next */
function generateMixTitle(genres) {
  const names = (Array.isArray(genres) ? genres : []).map((g) => g.genre_name);

  if (names.includes('Electronic')) return 'Night Drive';
  if (names.includes('Hip-Hop & Rap')) return 'Energy Boost';
  if (names.includes('Lo-Fi')) return 'Chill Vibes';
  if (names.includes('Jazz')) return 'Late Night Jazz';

  return names.length > 1
    ? `${names[0]} & ${names[1]}`
    : names[0]
      ? `${names[0]} Mix`
      : 'Curated Mix';
}

/* istanbul ignore next */
async function buildMixedForYou(userId) {
  if (!userId) {
    const pool = await getTrendingMixGenreCandidates(15, null);
    const base = Array.isArray(pool) ? [...pool] : [];
    const shuffled = base.sort((a, b) => {
      const aScore = (a.rank_score ?? 0) + Math.random();
      const bScore = (b.rank_score ?? 0) + Math.random();
      return bScore - aScore;
    });
    const candidateGenres = shuffled;
    const used = new Set();
    const groupedGenres = [];

    for (let i = 0; i < candidateGenres.length && groupedGenres.length < HOME_MIX_LIMIT; i += 2) {
      const g1 = candidateGenres[i];
      const g2 = candidateGenres[i + 1];

      if (!g1 || used.has(g1.genre_id)) continue;

      const group = [g1];
      used.add(g1.genre_id);

      if (g2 && !used.has(g2.genre_id)) {
        group.push(g2);
        used.add(g2.genre_id);
      }

      groupedGenres.push(group);
    }

    const mixes = await Promise.all(
      groupedGenres.map(async (group) => {
        const tracks = await findTracksByGenreIds(
          group.map((g) => g.genre_id),
          MIX_TRACK_LIMIT,
          null
        );

        const safeTracks = sanitizeTracks(Array.isArray(tracks) ? tracks : []);
        const diverseTracks = enforceArtistDiversity(safeTracks, {
          maxPerArtist: 2,
          limit: MIX_TRACK_LIMIT,
        });

        return {
          mix_id: `mix_custom_${group.map((g) => g.genre_id).join('_')}`,
          title: generateMixTitle(group),
          cover_url: diverseTracks[0]?.cover_image ?? null,
          preview_track: diverseTracks[0] ?? null,
        };
      })
    );

    return mixes.filter((mix) => Boolean(mix.preview_track));
  }

  let candidateGenres = [];

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

  const genreIds = (Array.isArray(candidateGenres) ? candidateGenres : [])
    .map((g) => g.genre_id)
    .filter(Boolean)
    .slice(0, HOME_MIX_LIMIT);

  if (genreIds.length === 0) return [];

  const genrePlaylistRows = await Promise.all(
    candidateGenres.map((genre) =>
      playlistModel.findOrCreateGenreMixPlaylist(userId, genre.genre_id, `${genre.genre_name} Mix`)
    )
  );

  const genreToPlaylistId = new Map(
    genrePlaylistRows.filter(Boolean).map((row) => [row.genre_id, row.id])
  );

  // Batched top-1-per-genre query keeps this preview path fast and avoids N+1 queries.
  const previewTracks = await getTopPreviewTracksByGenreIds(genreIds, userId);
  return buildMixedForYouPreviewMixes(candidateGenres, previewTracks, genreToPlaylistId);
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

/* istanbul ignore next */
async function attachAlbumPreviewTracks(albums, userId) {
  const safeAlbums = Array.isArray(albums) ? albums : [];
  if (safeAlbums.length === 0) return [];

  const albumIds = safeAlbums.map((album) => album.id).filter(Boolean);
  if (albumIds.length === 0) {
    return safeAlbums.map((album) => ({ ...album, preview_track: null }));
  }

  const previewTracks = await getFirstPreviewTracksByAlbumIds(albumIds, userId);
  const previewByAlbumId = new Map(
    (Array.isArray(previewTracks) ? previewTracks : []).map((track) => [track.album_id, track])
  );

  if (process.env.NODE_ENV === 'development') {
    for (const album of safeAlbums) {
      const preview = previewByAlbumId.get(album.id);
      if (preview && preview.album_order !== undefined) {
        console.log(
          `[PREVIEW CHECK] Album ${album.id} "${album.name}" → preview: "${preview.title}" position: ${preview.album_order}`
        );
      }
    }
  }

  return safeAlbums.map((album) => {
    const rawPreviewTrack = previewByAlbumId.get(album.id) || null;
    const safePreviewTrack = rawPreviewTrack ? sanitizeTracks([rawPreviewTrack])[0] : null;

    if (safePreviewTrack) {
      delete safePreviewTrack.album_id;
      delete safePreviewTrack.album_order;
    }

    return {
      ...album,
      preview_track: safePreviewTrack,
    };
  });
}

async function buildHomeAlbumsForYou(userId) {
  const followedResult = await getAlbumsFromFollowedArtists(userId, HOME_ALBUMS_LIMIT, 0);
  if ((followedResult.items?.length ?? 0) > 0) {
    return attachAlbumPreviewTracks(followedResult.items, userId);
  }

  const fallbackResult = await getTopAlbums(HOME_ALBUMS_LIMIT, 0, userId);
  return attachAlbumPreviewTracks(fallbackResult.items, userId);
}

function buildDiscoveryTrendingByGenreCacheKey(genreId, limit) {
  return `discovery:genre:${genreId}:${limit}`;
}

function attachGenrePreviewTracks(genres, previewTracks) {
  const safeGenres = Array.isArray(genres) ? genres : [];
  const trackByGenre = new Map(
    (Array.isArray(previewTracks) ? previewTracks : []).map((track) => [track.genre_id, track])
  );

  const normalizeGenrePreviewTrack = (track) => {
    if (!track) return null;

    const [sanitized] = sanitizeTracks([track]);
    if (!sanitized) return null;

    // Strip query-only fields so preview_track matches the track payload shape exactly.
    const safeTrack = { ...sanitized };
    delete safeTrack.genre_id;
    delete safeTrack.genre_order;

    return safeTrack;
  };

  return safeGenres.map((genre) => ({
    ...genre,
    preview_track: normalizeGenrePreviewTrack(trackByGenre.get(genre.genre_id)),
  }));
}

function buildTrendingByGenrePayload(trendingByGenre) {
  const initialTab = trendingByGenre?.initial_tab
    ? {
        ...trendingByGenre.initial_tab,
        tracks: sanitizeTracks(trendingByGenre.initial_tab.tracks),
      }
    : null;

  return {
    genres: Array.isArray(trendingByGenre?.genres) ? trendingByGenre.genres : [],
    // Keep initial_tab tracks-only so lazy loading remains unchanged.
    initial_tab: initialTab ?? {
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

/* istanbul ignore next */
async function buildHomeGlobal() {
  const [trendingByGenre, artistsToWatch, discoverWithStations] = await Promise.all([
    getHomeTrendingByGenre(HOME_TRACK_LIMIT, null),
    getArtistsToWatchModel(HOME_ARTISTS_LIMIT, null),
    getDiscoverWithStations(HOME_STATIONS_LIMIT, null),
  ]);

  // One batched query for all genre previews avoids per-genre DB calls (no N+1)
  // while keeping the lazy-loaded initial tab untouched.
  const genreIds = (Array.isArray(trendingByGenre?.genres) ? trendingByGenre.genres : [])
    .map((genre) => genre.genre_id)
    .filter(Boolean);
  const genrePreviewTracks =
    genreIds.length > 0 ? await getTopPreviewTracksByGenreIds(genreIds, null) : [];
  const trendingWithGenrePreviews = {
    ...trendingByGenre,
    genres: attachGenrePreviewTracks(trendingByGenre?.genres, sanitizeTracks(genrePreviewTracks)),
  };

  const enrichedStations = await getOrSetCache(
    HOME_STATIONS_CACHE_KEY,
    HOME_STATIONS_CACHE_TTL_SECONDS,
    async () => {
      return enrichStations(discoverWithStations, null);
    }
  );

  return {
    trending_by_genre: buildTrendingByGenrePayload(trendingWithGenrePreviews),
    artists_to_watch: Array.isArray(artistsToWatch) ? artistsToWatch : [],
    discover_with_stations: enrichedStations,
  };
}

/* istanbul ignore next */
async function buildHomeUser(userId) {
  const [
    homeMoreOfWhatYouLike,
    previewDailyTracks,
    mixedForYou,
    weeklyPreviewTracks,
    albumsForYou,
    dailyPlaylist,
    weeklyPlaylist,
  ] = await Promise.all([
    getMoreOfWhatYouLikeModel(userId, HOME_TRACK_LIMIT, 0),
    getDailyTracks(HOME_PREVIEW_LIMIT, userId),
    buildMixedForYou(userId),
    getWeeklyTracks(userId, HOME_PREVIEW_LIMIT),
    buildHomeAlbumsForYou(userId),
    playlistModel.findOrCreateDailyMixPlaylist(userId),
    playlistModel.findOrCreateWeeklyMixPlaylist(userId),
  ]);

  const dailyPreviewTrack = sanitizeTracks(previewDailyTracks)[0] ?? null;
  const dailyPlaylistId = dailyPlaylist.id;
  const weeklyPlaylistId = weeklyPlaylist.id;
  const hotForYouPayload = await resolveHotForYou(userId, {
    moreOfWhatYouLike: homeMoreOfWhatYouLike,
    fallbackTrack: dailyPreviewTrack,
  });

  const hotTrack = hotForYouPayload.track;
  // Keep weekly preview strictly tied to weekly query output (LIMIT 1), no cross-section fallback.
  const weeklyPreviewTrack = sanitizeTracks(weeklyPreviewTracks)[0] ?? null;
  const moreOfWhatYouLikeTracks = Array.isArray(homeMoreOfWhatYouLike?.items)
    ? sanitizeTracks(homeMoreOfWhatYouLike.items)
    : [];

  return {
    hot_for_you: {
      track: hotTrack,
      reason: hotForYouPayload.reason,
      valid_until: hotForYouPayload.valid_until,
    },
    more_of_what_you_like: {
      tracks: moreOfWhatYouLikeTracks,
      source: homeMoreOfWhatYouLike?.source || 'trending_fallback',
    },
    albums_for_you: Array.isArray(albumsForYou) ? albumsForYou : [],
    mixed_for_you: Array.isArray(mixedForYou) ? mixedForYou.slice(0, HOME_MIX_LIMIT) : [],
    made_for_you: {
      daily_mix: buildCuratedMixSummary(
        dailyPlaylistId,
        DAILY_MIX_TITLE,
        'Fresh trending tracks updated daily.',
        CURATED_MIX_LIMIT,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        dailyPreviewTrack ?? hotTrack
      ),
      weekly_mix: buildCuratedMixSummary(
        weeklyPlaylistId,
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

/* istanbul ignore next */
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
    const curatedMixes = await getOrSetCache('home:curated:mixes', 600, async () => {
      return buildMixedForYou(null);
    });
    const hotForYouPayload = await getHotForYou();
    const likedTrackIds = new Set();

    return {
      curated: {
        mixes: (Array.isArray(curatedMixes) ? curatedMixes.slice(0, HOME_MIX_LIMIT) : []).map(
          (mix) => ({
            ...mix,
            preview_track: decorateTrackWithLikedState(mix.preview_track, likedTrackIds),
          })
        ),
      },

      hot_for_you: {
        track: decorateTrackWithLikedState(hotForYouPayload.track, likedTrackIds),
        reason: hotForYouPayload.reason,
        valid_until: hotForYouPayload.valid_until,
      },

      trending_by_genre: {
        genres: (globalData.trending_by_genre?.genres ?? []).map((genre) => ({
          ...genre,
          preview_track: decorateTrackWithLikedState(genre.preview_track, likedTrackIds),
          is_liked: false,
        })),
        initial_tab: globalData.trending_by_genre?.initial_tab
          ? {
              ...globalData.trending_by_genre.initial_tab,
              tracks: decorateTracksWithLikedState(
                globalData.trending_by_genre.initial_tab.tracks,
                likedTrackIds
              ),
            }
          : null,
      },

      artists_to_watch: Array.isArray(globalData.artists_to_watch)
        ? globalData.artists_to_watch
        : [],

      discover_with_stations: (globalData.discover_with_stations ?? []).map((station) => ({
        ...station,
        preview_track: decorateTrackWithLikedState(station.preview_track, likedTrackIds),
      })),

      more_of_what_you_like: null,
      albums_for_you: null,
      mixed_for_you: null,
      made_for_you: null,
    };
  }

  const userData = await getOrSetCache(
    buildHomeUserCacheKey(userId),
    HOME_USER_CACHE_TTL_SECONDS,
    () => buildHomeUser(userId)
  );

  let likedTrackIds = new Set();
  const allTrackIds = [
    userData.hot_for_you?.track?.id,
    ...(userData.more_of_what_you_like?.tracks ?? []).map((track) => track.id),
    ...(globalData.trending_by_genre?.initial_tab?.tracks ?? []).map((track) => track.id),
    ...(globalData.trending_by_genre?.genres ?? [])
      .map((genre) => genre.preview_track?.id)
      .filter(Boolean),
    ...(userData.mixed_for_you ?? []).map((mix) => mix.preview_track?.id).filter(Boolean),
    userData.made_for_you?.daily_mix?.preview_track?.id,
    userData.made_for_you?.weekly_mix?.preview_track?.id,
    ...(userData.albums_for_you ?? []).map((album) => album.preview_track?.id).filter(Boolean),
    ...(globalData.discover_with_stations ?? [])
      .map((station) => station.preview_track?.id)
      .filter(Boolean),
  ].filter(Boolean);
  const uniqueTrackIds = [...new Set(allTrackIds)].filter((id) => isUuid(id));

  if (uniqueTrackIds.length > 0) {
    const { rows } = await db.query(
      `
      SELECT track_id FROM track_likes
      WHERE user_id = $1
        AND track_id = ANY($2::uuid[])
      `,
      [userId, uniqueTrackIds]
    );
    likedTrackIds = new Set(rows.map((row) => row.track_id));
  }

  // One query looks up which curated/auto-generated mixes this user has liked,
  // keyed by playlist_id.
  const likedMixMap = await findLikedMixesByUserModel(userId);
  const likedGenreTrendingIds = await getUserLikedGenreTrendingIds(userId);

  // Attach is_liked_by_me to made_for_you
  const decoratedMadeForYou = userData.made_for_you
    ? {
        daily_mix: userData.made_for_you.daily_mix
          ? {
              ...userData.made_for_you.daily_mix,
              preview_track: decorateTrackWithLikedState(
                userData.made_for_you.daily_mix.preview_track,
                likedTrackIds
              ),
              is_liked_by_me: likedMixMap.has(userData.made_for_you.daily_mix.id),
            }
          : null,
        weekly_mix: userData.made_for_you.weekly_mix
          ? {
              ...userData.made_for_you.weekly_mix,
              preview_track: decorateTrackWithLikedState(
                userData.made_for_you.weekly_mix.preview_track,
                likedTrackIds
              ),
              is_liked_by_me: likedMixMap.has(userData.made_for_you.weekly_mix.id),
            }
          : null,
      }
    : null;

  const decoratedMixedForYou = Array.isArray(userData.mixed_for_you)
    ? userData.mixed_for_you.map((mix) => {
        const playlistId = isUuid(mix.mix_id) ? mix.mix_id : null;
        return {
          ...mix,
          preview_track: decorateTrackWithLikedState(mix.preview_track, likedTrackIds),
          is_liked_by_me: playlistId ? likedMixMap.has(playlistId) : false,
        };
      })
    : [];

  const basePayload = {
    hot_for_you: userData.hot_for_you
      ? {
          ...userData.hot_for_you,
          track: decorateTrackWithLikedState(userData.hot_for_you.track, likedTrackIds),
        }
      : null,
    trending_by_genre: {
      genres: (globalData.trending_by_genre?.genres ?? []).map((genre) => ({
        ...genre,
        preview_track: decorateTrackWithLikedState(genre.preview_track, likedTrackIds),
        is_liked: likedGenreTrendingIds.has(genre.genre_id),
      })),
      initial_tab: globalData.trending_by_genre?.initial_tab
        ? {
            ...globalData.trending_by_genre.initial_tab,
            tracks: decorateTracksWithLikedState(
              globalData.trending_by_genre.initial_tab.tracks,
              likedTrackIds
            ),
          }
        : null,
    },
    more_of_what_you_like: userData.more_of_what_you_like
      ? {
          ...userData.more_of_what_you_like,
          tracks: decorateTracksWithLikedState(
            userData.more_of_what_you_like.tracks,
            likedTrackIds
          ),
        }
      : null,
    albums_for_you: (userData.albums_for_you ?? []).map((album) => ({
      ...album,
      preview_track: decorateTrackWithLikedState(album.preview_track, likedTrackIds),
    })),
    mixed_for_you: decoratedMixedForYou,
    made_for_you: decoratedMadeForYou,
    artists_to_watch: Array.isArray(globalData.artists_to_watch) ? globalData.artists_to_watch : [],
    discover_with_stations: (globalData.discover_with_stations ?? []).map((station) => ({
      ...station,
      preview_track: decorateTrackWithLikedState(station.preview_track, likedTrackIds),
    })),
  };

  return decorateHomeItems(userId, basePayload);
}

// ─────────────────────────────────────────────────────────────
// Decorate all tracks, albums, and stations in Home response
// ─────────────────────────────────────────────────────────────
/* istanbul ignore next */
async function decorateHomeItems(userId, payload) {
  if (!userId || !payload) return payload;

  const albumIds = new Set();
  const artistIds = new Set();

  function collectIds(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(collectIds);
      return;
    }

    if (obj.id && obj.owner_name) albumIds.add(obj.id);
    else if (obj.id && obj.artist_id && obj.images) artistIds.add(obj.artist_id);

    Object.values(obj).forEach(collectIds);
  }

  collectIds(payload);

  const [likedAlbums, savedStations] = await Promise.all([
    getLikedAlbumIds(userId, Array.from(albumIds)),
    getSavedStationArtistIds(userId, Array.from(artistIds)),
  ]);

  function applyLikes(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(applyLikes);

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = applyLikes(value);
    }

    if (result.id && result.owner_name) {
      result.is_liked_by_me = likedAlbums.has(result.id);
    } else if (result.id && result.artist_id && result.images) {
      result.is_saved = savedStations.has(result.artist_id);
    }

    return result;
  }

  return applyLikes(payload);
}

// ─────────────────────────────────────────────────────────────
// getHotForYou (standalone endpoint)
// ─────────────────────────────────────────────────────────────

/* istanbul ignore next */
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

/* istanbul ignore next */
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
    const result = await fetchTrendingByGenre();
    const is_liked = await isGenreTrendingLiked(userId, genreId);
    return { ...result, is_liked };
  }

  const cacheKey = buildDiscoveryTrendingByGenreCacheKey(genreId, limit);
  const result = await getOrSetCache(cacheKey, DISCOVERY_GENRE_TTL_SECONDS, fetchTrendingByGenre);
  const is_liked = await isGenreTrendingLiked(userId, genreId);
  return { ...result, is_liked };
}

// ─────────────────────────────────────────────────────────────
// getMoreOfWhatYouLike
// ─────────────────────────────────────────────────────────────

/* istanbul ignore next */
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

/* istanbul ignore next */
async function getAlbumsForYou(userId, pagination) {
  await ensureUserExists(userId);

  const { limit, offset } = pagination;
  const cacheKey = buildDiscoveryAlbumsCacheKey(userId, limit, offset);

  return getOrSetCache(cacheKey, DISCOVERY_ALBUMS_TTL_SECONDS, async () => {
    // Level 1: Albums from followed artists (personalized)
    const followedResult = await getAlbumsFromFollowedArtists(userId, limit, offset);
    if ((followedResult.items?.length ?? 0) > 0) {
      const enrichedItems = await attachAlbumPreviewTracks(followedResult.items, userId);

      return {
        data: enrichedItems,
        source: 'followed_artists',
        pagination: { limit, offset, total: followedResult.total },
      };
    }

    // Level 2: Top albums globally (by likes)
    const topResult = await getTopAlbums(limit, offset, userId);
    if ((topResult.items?.length ?? 0) > 0) {
      const enrichedItems = await attachAlbumPreviewTracks(topResult.items, userId);

      return {
        data: enrichedItems,
        source: 'global_top',
        pagination: { limit, offset, total: topResult.total },
      };
    }

    // Level 3: All albums (ultimate fallback, ordered by newest)
    const fallbackResult = await getAllAlbums(limit, offset, userId);
    const enrichedItems = await attachAlbumPreviewTracks(fallbackResult.items, userId);

    return {
      data: enrichedItems,
      source: 'all_albums_fallback',
      pagination: { limit, offset, total: fallbackResult.total },
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Curated mixes
// ─────────────────────────────────────────────────────────────

/* istanbul ignore next */
async function getDailyMix(userId) {
  await ensureUserExists(userId);

  const cacheKey = buildDiscoveryDailyMixCacheKey(userId);

  return getOrSetCache(cacheKey, DISCOVERY_DAILY_MIX_TTL_SECONDS, async () => {
    const [tracks, dailyPlaylist] = await Promise.all([
      getDailyTracks(CURATED_MIX_LIMIT, userId),
      playlistModel.findOrCreateDailyMixPlaylist(userId),
    ]);

    return buildMixPayload(dailyPlaylist.id, DAILY_MIX_TITLE, tracks);
  });
}

/* istanbul ignore next */
async function getWeeklyMix(userId) {
  await ensureUserExists(userId);

  const cacheKey = buildDiscoveryWeeklyMixCacheKey(userId);

  return getOrSetCache(cacheKey, DISCOVERY_WEEKLY_MIX_TTL_SECONDS, async () => {
    const [weeklyTracks, weeklyPlaylist] = await Promise.all([
      getWeeklyTracks(userId, CURATED_MIX_LIMIT),
      playlistModel.findOrCreateWeeklyMixPlaylist(userId),
    ]);
    const hasPersonalizedResult = Array.isArray(weeklyTracks)
      ? weeklyTracks.some((t) => Number(t.source_rank) <= 5)
      : false;

    if (!hasPersonalizedResult) {
      const fallbackTracks = await getDailyTracks(CURATED_MIX_LIMIT, userId);
      return buildMixPayload(weeklyPlaylist.id, WEEKLY_MIX_TITLE, fallbackTracks);
    }

    return buildMixPayload(weeklyPlaylist.id, WEEKLY_MIX_TITLE, weeklyTracks);
  });
}

// ─────────────────────────────────────────────────────────────
// getMixById (genre mix)
// ─────────────────────────────────────────────────────────────

/* istanbul ignore next */
function parseGenreIdFromMixId(mixId) {
  if (isUuid(mixId)) {
    return null;
  }

  const match = MIX_ID_REGEX.exec(mixId || '');
  if (!match) {
    throw new AppError('Invalid mixId format.', 400, 'VALIDATION_FAILED');
  }
  return match[1];
}

/* istanbul ignore next */
async function getMixById(userId, mixId) {
  await ensureUserExists(userId);

  let resolvedMixId = mixId;
  let genreId = parseGenreIdFromMixId(mixId);
  let mixTitle = null;

  if (isUuid(mixId)) {
    const playlist = await playlistModel.findDynamicMixPlaylistById(mixId, userId);
    if (!playlist || playlist.type !== 'auto_generated' || !playlist.genre_id) {
      throw new AppError('Mix not found.', 404, 'RESOURCE_NOT_FOUND');
    }

    resolvedMixId = playlist.id;
    genreId = playlist.genre_id;
    mixTitle = playlist.name ?? null;
  }

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
      mix_id: resolvedMixId,
      title: mixTitle || `${genre.name} Mix`,
      cover_url: diverseTracks[0]?.cover_image ?? null,
      tracks: diverseTracks,
    };
  });
}

async function likeMix(userId, mixId) {
  await ensureUserExists(userId);

  if (!isUuid(mixId)) {
    throw new AppError('Invalid mixId format.', 400, 'VALIDATION_FAILED');
  }

  const playlist = await playlistModel.findDynamicMixPlaylistById(mixId, userId);
  if (!playlist) {
    throw new AppError('Mix not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const result = await playlistLikesService.likePlaylist(userId, mixId);
  await invalidateCache(`home:user:${userId}`);
  return result;
}

async function unlikeMix(userId, mixId) {
  await ensureUserExists(userId);

  if (!isUuid(mixId)) {
    throw new AppError('Invalid mixId format.', 400, 'VALIDATION_FAILED');
  }

  const { rowCount } = await db.query(
    `DELETE FROM playlist_likes WHERE user_id = $1 AND playlist_id = $2`,
    [userId, mixId]
  );

  // Seed row is intentionally preserved — only the like is removed.
  await invalidateCache(`home:user:${userId}`);
  return { unliked: rowCount > 0, playlist_id: mixId };
}

// ─────────────────────────────────────────────────────────────
// Genre Trending: like / unlike / is-liked
// ─────────────────────────────────────────────────────────────

async function likeGenreTrending(userId, genreId) {
  await ensureUserExists(userId);

  const genre = await findGenreById(genreId);
  if (!genre) throw new AppError('Genre not found.', 404, 'RESOURCE_NOT_FOUND');

  const { rows } = await db.query(
    `
    INSERT INTO playlists (name, type, user_id, genre_id, is_public, subtype)
    VALUES ($1, 'genre_trending', $2, $3, false, 'playlist')
    ON CONFLICT (user_id, type, genre_id)
      WHERE type = 'genre_trending' AND genre_id IS NOT NULL
    DO UPDATE SET updated_at = now()
    RETURNING id
    `,
    [`${genre.name} Trending`, userId, genreId]
  );

  const playlistId = rows[0].id;

  await db.query(
    `INSERT INTO playlist_likes (user_id, playlist_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, playlist_id) DO NOTHING`,
    [userId, playlistId]
  );

  await invalidateCache(`home:user:${userId}`);
  return { playlist_id: playlistId, genre_id: genreId, genre_name: genre.name };
}

async function unlikeGenreTrending(userId, genreId) {
  await ensureUserExists(userId);

  const { rows } = await db.query(
    `SELECT id FROM playlists
     WHERE user_id = $1 AND genre_id = $2 AND type = 'genre_trending'
     LIMIT 1`,
    [userId, genreId]
  );

  if (!rows[0]) return { unliked: false };

  await db.query(`DELETE FROM playlist_likes WHERE user_id = $1 AND playlist_id = $2`, [
    userId,
    rows[0].id,
  ]);

  // Seed row is preserved — only the like is removed.
  await invalidateCache(`home:user:${userId}`);
  return { unliked: true, playlist_id: rows[0].id };
}

/* istanbul ignore next */
async function isGenreTrendingLiked(userId, genreId) {
  if (!userId) return false;

  const { rows } = await db.query(
    `SELECT 1 FROM playlists p
     JOIN playlist_likes pl ON pl.playlist_id = p.id
     WHERE p.user_id = $1
       AND p.genre_id = $2
       AND p.type = 'genre_trending'
       AND pl.user_id = $1
     LIMIT 1`,
    [userId, genreId]
  );

  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────
// Stations
// ─────────────────────────────────────────────────────────────

/* istanbul ignore next */
async function listStations(pagination, userId = null) {
  const { limit, offset } = pagination;
  const cacheKey = `stations:list:${userId || 'guest'}:${limit}:${offset}`;

  return getOrSetCache(cacheKey, STATIONS_LIST_CACHE_TTL_SECONDS, async () => {
    const { items, total } = await getStationsPaginated(limit, offset, userId);
    const data = await enrichStations(items, userId);

    return {
      data,
      pagination: { limit, offset, total },
    };
  });
}

/* istanbul ignore next */
async function getStationTracks(artistId, pagination, userId = null) {
  const station = await getStationByArtistId(artistId, userId);
  if (!station) {
    throw new AppError('Station not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const enrichedStation = await enrichStations([station], userId);
  if (enrichedStation.length === 0) {
    throw new AppError('Station not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { limit, offset } = pagination;
  const { items, total } = await getTracksByArtistId(artistId, limit, offset, userId);

  return {
    station: enrichedStation[0],
    data: sanitizeTracks(items),
    pagination: { limit, offset, total },
  };
}

// ─────────────────────────────────────────────────────────────
// Artists to watch (standalone paginated endpoint)
// ─────────────────────────────────────────────────────────────

/* istanbul ignore next */
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

/* istanbul ignore next */
async function getActivityFeedService(userId, limit = 20, cursor = null) {
  await ensureUserExists(userId);

  // Optionally: build a cache key if you want caching
  //const cacheKey = `feed:activity:${userId}:${limit}:${cursor || 'null'}`;

  // For now, just call the model directly
  const { items, hasMore, nextCursor } = await getActivityFeedModel(userId, limit, cursor);

  return {
    data: items,
    hasMore,
    nextCursor,
  };
}

/* istanbul ignore next */
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
      comment_count: row.comment_count,
      cover_image: row.cover_image,
      preview_url: row.preview_url ?? row.stream_url ?? row.audio_url ?? null,
      audio_url: row.audio_url,
      stream_url: row.stream_url ?? row.audio_url ?? null,
      artist: {
        id: row.artist_id,
        username: row.artist_username,
        profile_picture: row.artist_profile_picture ?? null,
        is_following: row.is_following ?? false,
      },
    },
    reason: {
      type: row.reason_type,
      label: buildReasonLabel(row.reason_type, row.source_name),
      source_id: row.source_id,
    },
  }));

  return { data: shaped, hasMore, nextCursor };
}

function buildReasonLabel(type, sourceName) {
  switch (type) {
    case 'liked_by_you':
      return `Because you liked ${sourceName}`;
    case 'followed_artist':
      return `Because you follow ${sourceName}`;
    case 'played_by_you':
      return `Because you played ${sourceName}`;
    case 'new_release':
      return `New release by ${sourceName}`;
    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Track Radio & Related Tracks
// ─────────────────────────────────────────────────────────────

async function getRelatedTracks(trackId, userId, pagination, countryCode = null) {
  const { limit, offset } = pagination;

  // Fetch the reference track to get artist + genre
  const { rows: refRows } = await db.query(
    `SELECT t.id, t.user_id AS artist_id, t.genre_id,
            t.title, t.cover_image, t.duration,
            t.play_count, t.like_count,
            COALESCE(t.repost_count, 0) AS repost_count,
            t.audio_url AS stream_url, t.geo_restriction_type, t.geo_regions, t.created_at,
            u.display_name AS artist_name,
            g.name AS genre_name
     FROM   tracks t
     JOIN   users u ON u.id = t.user_id
     LEFT JOIN genres g ON g.id = t.genre_id
     WHERE  t.id = $1
       AND  t.is_public  = true
       AND  t.is_hidden  = false
       AND  t.status     = 'ready'
       AND  t.deleted_at IS NULL`,
    [trackId]
  );

  if (!refRows[0]) {
    throw new AppError('Track not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const ref = refRows[0];

  const { tracks, total } = await findRelatedTracks({
    trackId,
    userId: ref.artist_id, // artist of the reference track, not the viewer
    genreId: ref.genre_id,
    limit,
    offset,
  });

  return {
    reference_track: sanitizeTracks([ref], countryCode)[0],
    tracks: sanitizeTracks(tracks, countryCode),
    meta: { limit, offset, total },
  };
}

async function likeTrackRadio(userId, trackId) {
  await ensureUserExists(userId);

  // Validate track exists and is accessible
  const { rows: trackRows } = await db.query(
    `SELECT t.id, t.title, t.cover_image, u.display_name AS artist_name
     FROM tracks t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1
       AND t.is_public  = true
       AND t.is_hidden  = false
       AND t.status     = 'ready'
       AND t.deleted_at IS NULL
     LIMIT 1`,
    [trackId]
  );

  if (!trackRows[0]) {
    throw new AppError('Track not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const track = trackRows[0];
  const description = `Track radio based on ${track.title} by ${track.artist_name}`;

  // Upsert seed row — one track radio per user per seed track
  const { rows } = await db.query(
    `
    INSERT INTO playlists (name, description, cover_image, type, user_id, seed_track_id, is_public)
    VALUES ($1, $2, $3, 'track_radio', $4, $5, false)
    ON CONFLICT (user_id, type, seed_track_id)
      WHERE type = 'track_radio' AND seed_track_id IS NOT NULL
    DO UPDATE SET updated_at = now()
    RETURNING id
  `,
    [`${track.title} Radio`, description, track.cover_image, userId, trackId]
  );

  const playlistId = rows[0].id;

  // Idempotent like
  await db.query(
    `
    INSERT INTO playlist_likes (user_id, playlist_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, playlist_id) DO NOTHING
  `,
    [userId, playlistId]
  );

  await invalidateCache(`home:user:${userId}`);
  return {
    playlist_id: playlistId,
    seed_track_id: trackId,
    title: `${track.title} Radio`,
    description,
    cover_image: track.cover_image,
  };
}

async function unlikeTrackRadio(userId, trackId) {
  await ensureUserExists(userId);

  const { rows } = await db.query(
    `
    SELECT id FROM playlists
    WHERE user_id        = $1
      AND seed_track_id  = $2
      AND type           = 'track_radio'
    LIMIT 1
  `,
    [userId, trackId]
  );

  if (!rows[0]) {
    // Nothing to unlike — idempotent
    return { unliked: false };
  }

  await db.query(
    `
    DELETE FROM playlist_likes
    WHERE user_id = $1 AND playlist_id = $2
  `,
    [userId, rows[0].id]
  );

  // Keep the seed row
  await invalidateCache(`home:user:${userId}`);
  return { unliked: true, playlist_id: rows[0].id };
}

async function getTrackRadioTracks(userId, playlistId, pagination) {
  await ensureUserExists(userId);

  // Load the seed row
  const { rows } = await db.query(
    `
    SELECT id, name, description, cover_image, seed_track_id
    FROM playlists
    WHERE id      = $1
      AND user_id = $2
      AND type    = 'track_radio'
    LIMIT 1
  `,
    [playlistId, userId]
  );

  if (!rows[0]) {
    throw new AppError('Track radio not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const { seed_track_id, name, description, cover_image } = rows[0];

  // Reuse the related tracks service — same logic, same output
  const related = await getRelatedTracks(seed_track_id, userId, pagination);

  return {
    playlist_id: playlistId,
    title: name,
    description,
    cover_image,
    seed_track_id,
    ...related, // reference_track, tracks, meta
  };
}

module.exports = {
  getHome,
  getHotForYou,
  getTrendingByGenre,
  getMoreOfWhatYouLike,
  getAlbumsForYou,
  getDailyMix,
  getWeeklyMix,
  getMixById,
  likeMix,
  unlikeMix,
  likeGenreTrending,
  unlikeGenreTrending,
  isGenreTrendingLiked,
  parseGenreIdFromMixId,
  listStations,
  getStationTracks,
  getArtistsToWatch,
  getActivityFeedService,
  getDiscoveryFeedService,
  getRelatedTracks,
  likeTrackRadio,
  unlikeTrackRadio,
  getTrackRadioTracks,
  __testables: {
    sanitizeTracks,
    decorateTracksWithLikedState,
    decorateTrackWithLikedState,
    buildStationImages,
    buildStationPayload,
    enrichStations,
    buildMixPayload,
    enforceArtistDiversity,
    buildMixedForYouPreviewMixes,
    generateMixTitle,
    attachAlbumPreviewTracks,
    buildHomeAlbumsForYou,
    attachGenrePreviewTracks,
    buildTrendingByGenrePayload,
    resolveHotForYou,
    buildMixedForYou,
    buildHomeGlobal,
    buildHomeUser,
    decorateHomeItems,
  },
};
