jest.mock('../../../src/models/feed.model', () => ({
  getMoreOfWhatYouLike: jest.fn(),
  getDailyTracks: jest.fn(),
  isFollowingArtist: jest.fn(),
  getWeeklyTracks: jest.fn(),
  getHomeTrendingByGenre: jest.fn(),
  getUserLikedGenreTrendingIds: jest.fn(),
  getArtistsToWatch: jest.fn(),
  getDiscoverWithStations: jest.fn(),
  getPersonalizedMixGenreCandidates: jest.fn(),
  getTrendingMixGenreCandidates: jest.fn(),
  getTopPreviewTracksByGenreIds: jest.fn(),
  getFirstPreviewTracksByAlbumIds: jest.fn(),
  getAlbumsFromFollowedArtists: jest.fn(),
  getTopAlbums: jest.fn(),
  getAllAlbums: jest.fn(),
  findGenreById: jest.fn(),
  findTracksByGenreId: jest.fn(),
  findTracksByGenreIds: jest.fn(),
  getStationByArtistId: jest.fn(),
  getTracksByArtistId: jest.fn(),
  getStationsPaginated: jest.fn(),
  getArtistsToWatchPaginated: jest.fn(),
  getActivityFeed: jest.fn(),
  getDiscoveryFeed: jest.fn(),
  findTracksByGenreIdPaginated: jest.fn(),
}));

jest.mock('../../../src/models/user.model', () => ({ findById: jest.fn() }));

jest.mock('../../../src/models/playlist.model', () => ({
  findOrCreateDailyMixPlaylist: jest.fn(),
  findOrCreateWeeklyMixPlaylist: jest.fn(),
  findOrCreateGenreMixPlaylist: jest.fn(),
  findDynamicMixPlaylistById: jest.fn(),
  findLikedMixesByUser: jest.fn(),
}));

jest.mock('../../../src/services/playlist-likes.service', () => ({ likePlaylist: jest.fn() }));

jest.mock('../../../src/models/station.model', () => ({
  isStationSaved: jest.fn(),
  getSavedStationArtistIds: jest.fn(),
}));

jest.mock('../../../src/utils/cache', () => ({
  getOrSetCache: jest.fn(),
  invalidateCache: jest.fn(),
  invalidateCachePattern: jest.fn(),
}));

jest.mock('../../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../../src/models/track.model', () => ({ findRelatedTracks: jest.fn() }));
jest.mock('../../../src/models/album-like.model', () => ({ getLikedAlbumIds: jest.fn() }));

const feedService = require('../../../src/services/feed.service');
const feedModel = require('../../../src/models/feed.model');
const userModel = require('../../../src/models/user.model');
const playlistModel = require('../../../src/models/playlist.model');
const playlistLikesService = require('../../../src/services/playlist-likes.service');
const cache = require('../../../src/utils/cache');
const db = require('../../../src/config/db');
const trackModel = require('../../../src/models/track.model');
const albumLikeModel = require('../../../src/models/album-like.model');
const stationModel = require('../../../src/models/station.model');
const testables = feedService.__testables;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const GENRE_UUID = '22222222-2222-2222-2222-222222222222';

const mockUserExists = () => {
  userModel.findById.mockResolvedValue({ id: 'u-1' });
};

describe('Feed - Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserExists();
    cache.getOrSetCache.mockImplementation(async (_key, _ttl, cb) => cb());
    playlistModel.findLikedMixesByUser.mockResolvedValue(new Map());
    feedModel.getUserLikedGenreTrendingIds.mockResolvedValue(new Set());
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('parseGenreIdFromMixId handles uuid, prefixed id and invalid format', () => {
    expect(feedService.parseGenreIdFromMixId(VALID_UUID)).toBeNull();
    expect(feedService.parseGenreIdFromMixId(`mix_genre_${GENRE_UUID}`)).toBe(GENRE_UUID);
    expect(() => feedService.parseGenreIdFromMixId('bad')).toThrow('Invalid mixId format.');
  });

  it('helper sanitizers and decorators cover null/default branches', () => {
    expect(testables.sanitizeTracks(null)).toEqual([]);
    expect(
      testables.sanitizeTracks([
        {
          id: 't1',
          cover_image: undefined,
          preview_url: undefined,
          genre_name: undefined,
          artist_name: undefined,
          stream_url: undefined,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          source_rank: 1,
          total_count: 2,
        },
        {
          id: 't2',
          created_at: '2026-01-02',
        },
      ])
    ).toEqual([
      {
        id: 't1',
        cover_image: null,
        preview_url: null,
        genre_name: null,
        artist_name: null,
        stream_url: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        cover_image: null,
        preview_url: null,
        genre_name: null,
        artist_name: null,
        stream_url: null,
        created_at: '2026-01-02',
      },
    ]);

    expect(testables.decorateTracksWithLikedState(null, new Set())).toEqual([]);
    expect(testables.decorateTracksWithLikedState([{ id: 't1' }], null)[0].is_liked_by_me).toBe(false);
    expect(testables.decorateTracksWithLikedState([{ id: 't1' }], new Set(['t1']))[0].is_liked_by_me).toBe(
      true
    );

    expect(testables.decorateTrackWithLikedState(null, new Set())).toBeNull();
    expect(testables.decorateTrackWithLikedState({ id: 't1' }, null).is_liked_by_me).toBe(false);
    expect(testables.decorateTrackWithLikedState({ id: 't1' }, new Set(['t1'])).is_liked_by_me).toBe(
      true
    );
  });

  it('station and mix helpers cover empty, fallback, and diversity branches', async () => {
    expect(testables.buildStationImages([], null)).toEqual({ left: null, center: null, right: null });
    expect(testables.buildStationPayload(null, [])).toBeNull();
    expect(testables.buildStationPayload({ id: 's1' }, [])).toBeNull();

    const payload = testables.buildStationPayload(
      { id: 's1', artist_id: 'a1', artist_name: 'Artist', cover_image: null, track_count: 0 },
      [{ id: 't1', cover_image: 'c1', created_at: '2026-01-01' }]
    );
    expect(payload.track_count).toBe(1);
    expect(payload.preview_track.id).toBe('t1');

    expect(testables.buildMixPayload('mix-1', 'Mix', []).cover_url).toBeNull();

    const diverse = testables.enforceArtistDiversity(
      [
        { id: 't1', user_id: 'a1' },
        { id: 't2', user_id: 'a1' },
        { id: 't3', user_id: 'a1' },
        { id: 't4', user_id: 'a2' },
      ],
      { maxPerArtist: 2, limit: 3 }
    );
    expect(diverse.map((t) => t.id)).toEqual(['t1', 't2', 't4']);
  });

  it('mixed-for-you and genre helpers cover fallback ids and null preview branches', () => {
    expect(testables.generateMixTitle([{ genre_name: 'Electronic' }])).toBe('Night Drive');
    expect(testables.generateMixTitle([{ genre_name: 'Hip-Hop & Rap' }])).toBe('Energy Boost');
    expect(testables.generateMixTitle([{ genre_name: 'Lo-Fi' }])).toBe('Chill Vibes');
    expect(testables.generateMixTitle([{ genre_name: 'Jazz' }])).toBe('Late Night Jazz');
    expect(testables.generateMixTitle([{ genre_name: 'Pop' }, { genre_name: 'Rock' }])).toBe('Pop & Rock');
    expect(testables.generateMixTitle([{ genre_name: 'Pop' }])).toBe('Pop Mix');
    expect(testables.generateMixTitle([])).toBe('Curated Mix');

    const mixes = testables.buildMixedForYouPreviewMixes(
      [
        { genre_id: 'g1', genre_name: 'Pop' },
        { genre_id: 'g2', genre_name: 'Rock' },
      ],
      [{ genre_id: 'g1', id: 't1', cover_image: 'c1', created_at: '2026-01-01' }],
      new Map([['g1', 'playlist-g1']])
    );
    expect(mixes).toHaveLength(1);
    expect(mixes[0].mix_id).toBe('playlist-g1');

    const attachedGenres = testables.attachGenrePreviewTracks(
      [{ genre_id: 'g1' }, { genre_id: 'g2' }],
      [{ genre_id: 'g1', id: 't1', genre_order: 1, created_at: '2026-01-01' }]
    );
    expect(attachedGenres[0].preview_track.genre_id).toBeUndefined();
    expect(attachedGenres[1].preview_track).toBeNull();

    const trendingFallback = testables.buildTrendingByGenrePayload(null);
    expect(trendingFallback.genres).toEqual([]);
    expect(trendingFallback.initial_tab.genre_id).toBe('00000000-0000-0000-0000-000000000000');
    expect(
      testables.buildTrendingByGenrePayload({
        genres: null,
        initial_tab: { tracks: [{ id: 't1', created_at: '2026-01-01' }] },
      }).initial_tab.tracks[0].id
    ).toBe('t1');
  });

  it('album preview helpers cover empty ids, dev logging, and top fallback', async () => {
    expect(await testables.attachAlbumPreviewTracks(null, 'u-1')).toEqual([]);
    expect(await testables.attachAlbumPreviewTracks([{ name: 'No Id' }], 'u-1')).toEqual([
      { name: 'No Id', preview_track: null },
    ]);

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      feedModel.getFirstPreviewTracksByAlbumIds.mockResolvedValueOnce([
        {
          album_id: 'a1',
          album_order: 1,
          id: 't1',
          title: 'Track 1',
          created_at: '2026-01-01',
        },
      ]);
      const attached = await testables.attachAlbumPreviewTracks([{ id: 'a1', name: 'Album 1' }], 'u-1');
      expect(attached[0].preview_track.id).toBe('t1');
      expect(attached[0].preview_track.album_id).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    }

    feedModel.getAlbumsFromFollowedArtists.mockResolvedValueOnce({ items: [], total: 0 });
    feedModel.getTopAlbums.mockResolvedValueOnce({ items: [{ id: 'a2', name: 'Album 2' }], total: 1 });
    feedModel.getFirstPreviewTracksByAlbumIds.mockResolvedValueOnce([]);
    const homeAlbums = await testables.buildHomeAlbumsForYou('u-1');
    expect(homeAlbums[0].id).toBe('a2');
  });

  it('resolveHotForYou and decorateHomeItems cover fallback and null payload branches', async () => {
    feedModel.isFollowingArtist.mockResolvedValueOnce(false);
    const recent = await testables.resolveHotForYou('u-1', {
      moreOfWhatYouLike: { items: [{ id: 't1', user_id: 'artist-1', created_at: '2026-01-01' }] },
    });
    expect(recent.reason).toBe('based_on_recent_plays');

    const global = await testables.resolveHotForYou(null, { fallbackTrack: { id: 't2' } });
    expect(global.reason).toBe('global_trending');

    await expect(testables.resolveHotForYou(null, {})).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    expect(await testables.decorateHomeItems(null, { ok: true })).toEqual({ ok: true });
    expect(await testables.decorateHomeItems('u-1', null)).toBeNull();

    albumLikeModel.getLikedAlbumIds.mockResolvedValueOnce(new Set(['album-1']));
    stationModel.getSavedStationArtistIds.mockResolvedValueOnce(new Set(['artist-1']));
    const decorated = await testables.decorateHomeItems('u-1', {
      albums_for_you: [{ id: 'album-1', owner_name: 'Artist' }],
      discover_with_stations: [{ id: 'station-1', artist_id: 'artist-1', images: {} }],
    });
    expect(decorated.albums_for_you[0].is_liked_by_me).toBe(true);
    expect(decorated.discover_with_stations[0].is_saved).toBe(true);
  });

  it('buildMixedForYou guest branch handles missing genres, duplicate ids, and preview filtering', async () => {
    const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValue([
      { genre_id: null, genre_name: 'Invalid', rank_score: 5 },
      { genre_id: 'g1', genre_name: 'Pop', rank_score: null },
      { genre_id: 'g1', genre_name: 'Pop Dup', rank_score: 1 },
      { genre_id: 'g2', genre_name: 'Rock', rank_score: 2 },
    ]);
    feedModel.findTracksByGenreIds
      .mockResolvedValueOnce([
        { id: 't1', user_id: 'a1', cover_image: 'c1', created_at: '2026-01-01' },
        { id: 't2', user_id: 'a1', cover_image: 'c2', created_at: '2026-01-01' },
        { id: 't3', user_id: 'a1', cover_image: 'c3', created_at: '2026-01-01' },
      ])
      .mockResolvedValueOnce([]);

    const mixes = await testables.buildMixedForYou(null);

    expect(mixes).toHaveLength(1);
    expect(mixes[0].preview_track.id).toBe('t1');
    mathSpy.mockRestore();
  });

  it('buildMixedForYou user branch handles empty candidates and playlist-backed mixes', async () => {
    feedModel.getPersonalizedMixGenreCandidates.mockResolvedValueOnce(null);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValueOnce(null);
    await expect(testables.buildMixedForYou('u-1')).resolves.toEqual([]);

    feedModel.getPersonalizedMixGenreCandidates.mockResolvedValueOnce([
      { genre_id: 'g1', genre_name: 'Pop' },
      { genre_id: 'g1', genre_name: 'Dup' },
      { genre_id: null, genre_name: 'Bad' },
    ]);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValueOnce([
      { genre_id: 'g2', genre_name: 'Rock' },
    ]);
    playlistModel.findOrCreateGenreMixPlaylist
      .mockResolvedValueOnce({ id: 'playlist-1', genre_id: 'g1' })
      .mockResolvedValueOnce({ id: 'playlist-2', genre_id: 'g2' });
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValueOnce([
      { genre_id: 'g1', id: 't1', cover_image: 'c1', created_at: '2026-01-01' },
      { genre_id: 'g2', id: 't2', cover_image: 'c2', created_at: '2026-01-01' },
    ]);

    const mixes = await testables.buildMixedForYou('u-1');
    expect(mixes.map((mix) => mix.mix_id)).toEqual(['playlist-1', 'playlist-2']);
  });

  it('buildHomeGlobal and buildHomeUser cover nullish source branches', async () => {
    feedModel.getHomeTrendingByGenre.mockResolvedValueOnce({ genres: null, initial_tab: null });
    feedModel.getArtistsToWatch.mockResolvedValueOnce(null);
    feedModel.getDiscoverWithStations.mockResolvedValueOnce([]);
    const global = await testables.buildHomeGlobal();
    expect(global.trending_by_genre.initial_tab.genre_name).toBe('Unknown');
    expect(global.artists_to_watch).toEqual([]);

    feedModel.getMoreOfWhatYouLike.mockResolvedValueOnce({});
    feedModel.getDailyTracks.mockResolvedValueOnce([{ id: 'daily-track', user_id: 'artist-1' }]);
    feedModel.getWeeklyTracks.mockResolvedValueOnce([]);
    feedModel.getAlbumsFromFollowedArtists.mockResolvedValueOnce({ items: [], total: 0 });
    feedModel.getTopAlbums.mockResolvedValueOnce({ items: [], total: 0 });
    playlistModel.findOrCreateDailyMixPlaylist.mockResolvedValueOnce({ id: 'daily-1' });
    playlistModel.findOrCreateWeeklyMixPlaylist.mockResolvedValueOnce({ id: 'weekly-1' });
    feedModel.getTrendingMixGenreCandidates.mockResolvedValueOnce([]);
    feedModel.getPersonalizedMixGenreCandidates.mockResolvedValueOnce([]);

    const built = await testables.buildHomeUser('u-1');
    expect(built.more_of_what_you_like.source).toBe('trending_fallback');
    expect(built.albums_for_you).toEqual([]);
    expect(built.mixed_for_you).toEqual([]);
    expect(built.made_for_you.daily_mix.preview_track.id).toBe('daily-track');
  });

  it('getHome user branch covers empty liked ids and null optional sections', async () => {
    cache.getOrSetCache
      .mockResolvedValueOnce({
        trending_by_genre: { genres: [], initial_tab: null },
        artists_to_watch: null,
        discover_with_stations: null,
      })
      .mockResolvedValueOnce({
        hot_for_you: null,
        more_of_what_you_like: null,
        albums_for_you: null,
        mixed_for_you: null,
        made_for_you: null,
      });

    const out = await feedService.getHome('u-branchy');
    expect(out.hot_for_you).toBeNull();
    expect(out.more_of_what_you_like).toBeNull();
    expect(out.albums_for_you).toEqual([]);
    expect(out.mixed_for_you).toEqual([]);
    expect(out.made_for_you).toBeNull();
    expect(out.artists_to_watch).toEqual([]);
  });

  it('getHome for guest returns non-auth sections and defaults', async () => {
    feedModel.getHomeTrendingByGenre.mockResolvedValue({ genres: [], initial_tab: null });
    feedModel.getArtistsToWatch.mockResolvedValue(null);
    feedModel.getDiscoverWithStations.mockResolvedValue([]);
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([]);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValue([]);
    feedModel.getDailyTracks.mockResolvedValue([{ id: VALID_UUID, user_id: 'artist-1' }]);

    const out = await feedService.getHome(null);

    expect(out.more_of_what_you_like).toBeNull();
    expect(out.albums_for_you).toBeNull();
    expect(out.mixed_for_you).toBeNull();
    expect(out.made_for_you).toBeNull();
    expect(out.artists_to_watch).toEqual([]);
    expect(out.hot_for_you.reason).toBe('global_trending');
  });

  it('getHome for guest covers curated mixes and station enrichment', async () => {
    feedModel.getHomeTrendingByGenre.mockResolvedValue({
      genres: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }],
      initial_tab: { genre_id: GENRE_UUID, genre_name: 'Pop', tracks: [{ id: VALID_UUID }] },
    });
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([
      { genre_id: GENRE_UUID, id: VALID_UUID, cover_image: 'c1' },
    ]);
    feedModel.getArtistsToWatch.mockResolvedValue([{ id: 'artist-watch-1' }]);
    feedModel.getDiscoverWithStations.mockResolvedValue([
      {
        id: 'station-1',
        artist_id: 'artist-1',
        artist_name: 'Artist 1',
        cover_image: 'artist-1.jpg',
        track_count: 1,
      },
    ]);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValue([
      { genre_id: GENRE_UUID, genre_name: 'Pop', rank_score: 10 },
      { genre_id: '44444444-4444-4444-4444-444444444444', genre_name: 'Rock', rank_score: 9 },
    ]);
    feedModel.findTracksByGenreIds.mockResolvedValue([
      {
        id: VALID_UUID,
        title: 'Song 1',
        cover_image: 'song-1.jpg',
        user_id: 'artist-1',
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        title: 'Song 2',
        cover_image: 'song-2.jpg',
        user_id: 'artist-2',
      },
    ]);
    feedModel.getTracksByArtistId.mockResolvedValue({
      items: [
        {
          id: 'station-track-1',
          cover_image: 'station-track.jpg',
        },
      ],
      total: 1,
    });
    stationModel.isStationSaved.mockResolvedValue(true);

    const out = await feedService.getHome(null);

    expect(out.curated.mixes.length).toBeGreaterThan(0);
    expect(out.trending_by_genre.genres[0].preview_track.id).toBe(VALID_UUID);
    expect(out.discover_with_stations[0].is_saved).toBe(false);
  });

  it('getHome for guest drops stations without previewable tracks', async () => {
    feedModel.getHomeTrendingByGenre.mockResolvedValue({ genres: [], initial_tab: null });
    feedModel.getArtistsToWatch.mockResolvedValue([]);
    feedModel.getDiscoverWithStations.mockResolvedValue([
      {
        id: 'station-empty',
        artist_id: 'artist-empty',
        artist_name: 'Artist Empty',
        cover_image: null,
        track_count: 1,
      },
    ]);
    feedModel.getTracksByArtistId.mockResolvedValue({ items: [], total: 0 });
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([]);

    const out = await feedService.getHome(null);

    expect(out.discover_with_stations).toEqual([]);
    expect(feedModel.getTracksByArtistId).toHaveBeenCalledWith('artist-empty', 10, 0, null);
  });

  it('getHome for guest logs station caching in development', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      feedModel.getHomeTrendingByGenre.mockResolvedValue({ genres: [], initial_tab: null });
      feedModel.getArtistsToWatch.mockResolvedValue([]);
      feedModel.getDiscoverWithStations.mockResolvedValue([
        {
          id: 'station-1',
          artist_id: 'artist-1',
          artist_name: 'Artist 1',
          cover_image: 'artist.jpg',
          track_count: 1,
        },
      ]);
      feedModel.getTracksByArtistId.mockResolvedValue({
        items: [{ id: 'station-track-1', cover_image: 'track.jpg', user_id: 'artist-1' }],
        total: 1,
      });
      feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([]);

      const out = await feedService.getHome(null);

      expect(out.discover_with_stations[0].id).toBe('station-1');
      expect(consoleSpy).toHaveBeenCalledWith('[CACHE] Stations cached (1 items)');
    } finally {
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('getHome for user throws when user does not exist', async () => {
    userModel.findById.mockResolvedValueOnce(null);

    await expect(feedService.getHome('u-missing')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('getHome for user decorates liked tracks and mix likes', async () => {
    const trackId = VALID_UUID;
    const mixPlaylistId = '33333333-3333-3333-3333-333333333333';

    feedModel.getHomeTrendingByGenre.mockResolvedValue({
      genres: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }],
      initial_tab: { genre_id: GENRE_UUID, genre_name: 'Pop', tracks: [{ id: trackId }] },
    });
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([
      { genre_id: GENRE_UUID, id: trackId },
    ]);
    feedModel.getArtistsToWatch.mockResolvedValue([{ id: 'a1' }]);
    feedModel.getDiscoverWithStations.mockResolvedValue([]);
    feedModel.getMoreOfWhatYouLike.mockResolvedValue({ items: [{ id: trackId, user_id: 'a2' }] });
    feedModel.getDailyTracks.mockResolvedValue([{ id: trackId, user_id: 'a2' }]);
    feedModel.getWeeklyTracks.mockResolvedValue([{ id: trackId, source_rank: 1, user_id: 'a2' }]);
    feedModel.getAlbumsFromFollowedArtists.mockResolvedValue({ items: [], total: 0 });
    feedModel.getTopAlbums.mockResolvedValue({ items: [], total: 0 });
    feedModel.getPersonalizedMixGenreCandidates.mockResolvedValue([
      { genre_id: GENRE_UUID, genre_name: 'Pop' },
    ]);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValue([]);
    playlistModel.findOrCreateGenreMixPlaylist.mockResolvedValue({
      genre_id: GENRE_UUID,
      id: mixPlaylistId,
    });
    playlistModel.findOrCreateDailyMixPlaylist.mockResolvedValue({ id: 'daily-playlist' });
    playlistModel.findOrCreateWeeklyMixPlaylist.mockResolvedValue({ id: 'weekly-playlist' });
    playlistModel.findLikedMixesByUser.mockResolvedValue(new Map([[mixPlaylistId, true]]));
    feedModel.getUserLikedGenreTrendingIds.mockResolvedValue(new Set([GENRE_UUID]));
    albumLikeModel.getLikedAlbumIds.mockResolvedValue(new Set(['album-1']));
    stationModel.getSavedStationArtistIds.mockResolvedValue(new Set(['artist-1']));
    db.query.mockResolvedValueOnce({ rows: [{ track_id: trackId }] });

    const out = await feedService.getHome('u-1');

    expect(out.hot_for_you.track.is_liked_by_me).toBe(true);
    expect(out.trending_by_genre.genres[0].is_liked).toBe(true);
    expect(out.mixed_for_you[0].is_liked_by_me).toBe(true);
    expect(out.discover_with_stations).toEqual(expect.any(Array));
    expect(db.query).toHaveBeenCalled();
  });

  it('getHome for user decorates album likes and saved stations', async () => {
    feedModel.getHomeTrendingByGenre.mockResolvedValue({ genres: [], initial_tab: null });
    feedModel.getArtistsToWatch.mockResolvedValue([]);
    feedModel.getDiscoverWithStations.mockResolvedValue([
      {
        id: 'station-1',
        artist_id: 'artist-1',
        artist_name: 'Artist 1',
        cover_image: 'artist-1.jpg',
        track_count: 1,
      },
    ]);
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([]);
    feedModel.getMoreOfWhatYouLike.mockResolvedValue({
      items: [{ id: VALID_UUID, user_id: 'a2' }],
    });
    feedModel.getDailyTracks.mockResolvedValue([{ id: VALID_UUID, user_id: 'a2' }]);
    feedModel.getWeeklyTracks.mockResolvedValue([
      { id: VALID_UUID, source_rank: 1, user_id: 'a2' },
    ]);
    feedModel.getAlbumsFromFollowedArtists.mockResolvedValue({
      items: [
        {
          id: 'album-1',
          name: 'Album 1',
          cover_image: 'album-1.jpg',
          owner_id: 'artist-1',
          owner_name: 'Artist 1',
          track_count: 2,
          like_count: 10,
          created_at: '2026-01-01',
        },
      ],
      total: 1,
    });
    feedModel.getFirstPreviewTracksByAlbumIds.mockResolvedValue([
      {
        album_id: 'album-1',
        album_order: 1,
        id: 'album-track-1',
        title: 'Album Track 1',
        cover_image: 'album-track.jpg',
      },
    ]);
    feedModel.getPersonalizedMixGenreCandidates.mockResolvedValue([]);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValue([]);
    playlistModel.findOrCreateDailyMixPlaylist.mockResolvedValue({ id: 'daily-playlist' });
    playlistModel.findOrCreateWeeklyMixPlaylist.mockResolvedValue({ id: 'weekly-playlist' });
    playlistModel.findLikedMixesByUser.mockResolvedValue(new Map());
    feedModel.getUserLikedGenreTrendingIds.mockResolvedValue(new Set());
    albumLikeModel.getLikedAlbumIds.mockResolvedValue(new Set(['album-1']));
    stationModel.getSavedStationArtistIds.mockResolvedValue(new Set(['artist-1']));
    stationModel.isStationSaved.mockResolvedValue(true);

    const out = await feedService.getHome('u-1');

    expect(out.albums_for_you[0].is_liked_by_me).toBe(true);
    expect(out.discover_with_stations[0].is_saved).toBe(true);
  });

  it('getHome for user fills the mixed-for-you fallback loop from trending genres', async () => {
    feedModel.getHomeTrendingByGenre.mockResolvedValue({ genres: [], initial_tab: null });
    feedModel.getArtistsToWatch.mockResolvedValue([]);
    feedModel.getDiscoverWithStations.mockResolvedValue([]);
    feedModel.getMoreOfWhatYouLike.mockResolvedValue({ items: [{ id: VALID_UUID, user_id: 'a1' }] });
    feedModel.getDailyTracks.mockResolvedValue([{ id: VALID_UUID, user_id: 'a1' }]);
    feedModel.getWeeklyTracks.mockResolvedValue([{ id: VALID_UUID, source_rank: 1, user_id: 'a1' }]);
    feedModel.getAlbumsFromFollowedArtists.mockResolvedValue({ items: [], total: 0 });
    feedModel.getTopAlbums.mockResolvedValue({ items: [], total: 0 });
    feedModel.getAllAlbums.mockResolvedValue({ items: [], total: 0 });
    feedModel.getPersonalizedMixGenreCandidates.mockResolvedValue([
      { genre_id: '11111111-1111-1111-1111-111111111110', genre_name: 'Genre 1' },
      { genre_id: '11111111-1111-1111-1111-111111111111', genre_name: 'Genre 2' },
      { genre_id: '11111111-1111-1111-1111-111111111112', genre_name: 'Genre 3' },
      { genre_id: '11111111-1111-1111-1111-111111111113', genre_name: 'Genre 4' },
    ]);
    feedModel.getTrendingMixGenreCandidates.mockResolvedValue([
      { genre_id: '11111111-1111-1111-1111-111111111114', genre_name: 'Genre 5' },
      { genre_id: '11111111-1111-1111-1111-111111111115', genre_name: 'Genre 6' },
      { genre_id: '11111111-1111-1111-1111-111111111116', genre_name: 'Genre 7' },
      { genre_id: '11111111-1111-1111-1111-111111111117', genre_name: 'Genre 8' },
    ]);
    feedModel.getTopPreviewTracksByGenreIds.mockResolvedValue([
      { genre_id: '11111111-1111-1111-1111-111111111110', id: 'g1', cover_image: 'c1', user_id: 'a1' },
      { genre_id: '11111111-1111-1111-1111-111111111111', id: 'g2', cover_image: 'c2', user_id: 'a1' },
      { genre_id: '11111111-1111-1111-1111-111111111112', id: 'g3', cover_image: 'c3', user_id: 'a1' },
      { genre_id: '11111111-1111-1111-1111-111111111113', id: 'g4', cover_image: 'c4', user_id: 'a1' },
      { genre_id: '11111111-1111-1111-1111-111111111114', id: 'g5', cover_image: 'c5', user_id: 'a1' },
      { genre_id: '11111111-1111-1111-1111-111111111115', id: 'g6', cover_image: 'c6', user_id: 'a1' },
    ]);
    playlistModel.findOrCreateGenreMixPlaylist.mockImplementation(async (_userId, genreId) => ({
      genre_id: genreId,
      id: `playlist-${genreId}`,
    }));
    playlistModel.findOrCreateDailyMixPlaylist.mockResolvedValue({ id: 'daily-playlist' });
    playlistModel.findOrCreateWeeklyMixPlaylist.mockResolvedValue({ id: 'weekly-playlist' });
    playlistModel.findLikedMixesByUser.mockResolvedValue(new Map());

    const out = await feedService.getHome('u-1');

    expect(out.mixed_for_you).toHaveLength(6);
    expect(playlistModel.findOrCreateGenreMixPlaylist).toHaveBeenCalledTimes(6);
  });

  it('getAlbumsForYou returns null preview tracks when albums have no ids', async () => {
    feedModel.getAlbumsFromFollowedArtists.mockResolvedValue({
      items: [{ name: 'Album Without Id' }],
      total: 1,
    });
    feedModel.getTopAlbums.mockResolvedValue({ items: [], total: 0 });
    feedModel.getAllAlbums.mockResolvedValue({ items: [], total: 0 });

    const out = await feedService.getAlbumsForYou('u-1', { limit: 5, offset: 0 });

    expect(out.source).toBe('followed_artists');
    expect(out.data[0].preview_track).toBeNull();
    expect(feedModel.getFirstPreviewTracksByAlbumIds).not.toHaveBeenCalled();
  });

  it('getAlbumsForYou logs album preview checks in development', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      feedModel.getAlbumsFromFollowedArtists.mockResolvedValue({
        items: [
          {
            id: 'album-1',
            name: 'Album 1',
          },
        ],
        total: 1,
      });
      feedModel.getFirstPreviewTracksByAlbumIds.mockResolvedValue([
        {
          album_id: 'album-1',
          album_order: 1,
          id: 'album-track-1',
          title: 'Album Track 1',
          cover_image: 'album-track.jpg',
        },
      ]);
      feedModel.getTopAlbums.mockResolvedValue({ items: [], total: 0 });
      feedModel.getAllAlbums.mockResolvedValue({ items: [], total: 0 });

      const out = await feedService.getAlbumsForYou('u-1', { limit: 5, offset: 0 });

      expect(out.data[0].preview_track.id).toBe('album-track-1');
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('getHotForYou resolves personalized reason from follow relationship', async () => {
    feedModel.getMoreOfWhatYouLike.mockResolvedValue({
      items: [{ id: 't1', user_id: 'artist-1' }],
    });
    feedModel.getDailyTracks.mockResolvedValue([{ id: 'fallback-1' }]);
    feedModel.isFollowingArtist.mockResolvedValue(true);

    const out = await feedService.getHotForYou('u-1');

    expect(out.reason).toBe('based_on_followed_artists');
    expect(out.track.id).toBe('t1');
  });

  it('getHotForYou resolves global trending when guest and fallback exists', async () => {
    feedModel.getDailyTracks.mockResolvedValue([{ id: 'fallback-1' }]);

    const out = await feedService.getHotForYou(null);

    expect(out.reason).toBe('global_trending');
    expect(out.track.id).toBe('fallback-1');
  });

  it('getHotForYou throws when no personalized or fallback track is available', async () => {
    feedModel.getDailyTracks.mockResolvedValue([]);
    feedModel.getMoreOfWhatYouLike.mockResolvedValue({ items: [] });

    await expect(feedService.getHotForYou('u-1')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('getTrendingByGenre uses cache path for guest first page', async () => {
    feedModel.findGenreById.mockResolvedValue({ id: GENRE_UUID, name: 'Ambient' });
    feedModel.findTracksByGenreIdPaginated.mockResolvedValue({ rows: [{ id: 't1' }], total: 1 });

    const out = await feedService.getTrendingByGenre(GENRE_UUID, { limit: 10, offset: 0 }, null);

    expect(cache.getOrSetCache).toHaveBeenCalled();
    expect(out.is_liked).toBe(false);
    expect(out.genre_name).toBe('Ambient');
  });

  it('getMixById throws when uuid playlist type is invalid', async () => {
    playlistModel.findDynamicMixPlaylistById.mockResolvedValue({ id: VALID_UUID, type: 'regular' });

    await expect(feedService.getMixById('u-1', VALID_UUID)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('getDiscoveryFeedService maps all reason labels including default empty', async () => {
    feedModel.getDiscoveryFeed.mockResolvedValue({
      items: [
        {
          track_id: 't1',
          title: 'T1',
          duration: 1,
          play_count: 0,
          like_count: 0,
          cover_image: null,
          preview_url: null,
          stream_url: null,
          audio_url: null,
          artist_id: 'a1',
          artist_username: 'a1',
          artist_profile_picture: null,
          reason_type: 'liked_by_you',
          source_name: 'Song 1',
          source_id: 's1',
        },
        {
          track_id: 't2',
          title: 'T2',
          duration: 1,
          play_count: 0,
          like_count: 0,
          cover_image: null,
          preview_url: null,
          stream_url: null,
          audio_url: null,
          artist_id: 'a2',
          artist_username: 'a2',
          artist_profile_picture: null,
          reason_type: 'followed_artist',
          source_name: 'artist2',
          source_id: 'a2',
        },
        {
          track_id: 't3',
          title: 'T3',
          duration: 1,
          play_count: 0,
          like_count: 0,
          cover_image: null,
          preview_url: null,
          stream_url: null,
          audio_url: null,
          artist_id: 'a3',
          artist_username: 'a3',
          artist_profile_picture: null,
          reason_type: 'played_by_you',
          source_name: 'Song 3',
          source_id: 's3',
        },
        {
          track_id: 't4',
          title: 'T4',
          duration: 1,
          play_count: 0,
          like_count: 0,
          cover_image: null,
          preview_url: null,
          stream_url: null,
          audio_url: null,
          artist_id: 'a4',
          artist_username: 'a4',
          artist_profile_picture: null,
          reason_type: 'unknown_reason',
          source_name: 'X',
          source_id: 'x1',
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const out = await feedService.getDiscoveryFeedService('u-1', 20, null);
    expect(out.data[0].reason.label).toBe('Because you liked Song 1');
    expect(out.data[1].reason.label).toBe('Because you follow artist2');
    expect(out.data[2].reason.label).toBe('Because you played Song 3');
    expect(out.data[3].reason.label).toBe('');
  });

  it('getTrendingByGenre throws when genre not found', async () => {
    feedModel.findGenreById.mockResolvedValue(null);

    await expect(
      feedService.getTrendingByGenre(GENRE_UUID, { limit: 10, offset: 0 }, null)
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('getTrendingByGenre returns non-cached branch with is_liked for user', async () => {
    feedModel.findGenreById.mockResolvedValue({ id: GENRE_UUID, name: 'Pop' });
    feedModel.findTracksByGenreIdPaginated.mockResolvedValue({
      rows: [{ id: 't1', source_rank: 1 }],
      total: 1,
    });
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

    const out = await feedService.getTrendingByGenre(GENRE_UUID, { limit: 10, offset: 1 }, 'u-1');

    expect(out.genre_id).toBe(GENRE_UUID);
    expect(out.pagination).toEqual({ limit: 10, offset: 1, total: 1 });
    expect(out.is_liked).toBe(true);
  });

  it('getMoreOfWhatYouLike validates user and returns sanitized paginated payload', async () => {
    feedModel.getMoreOfWhatYouLike.mockResolvedValue({
      items: [{ id: 't1', source_rank: 2, total_count: 4 }],
      total: 4,
      source: 'personalized',
    });

    const out = await feedService.getMoreOfWhatYouLike('u-1', { limit: 2, offset: 0 });

    expect(feedModel.getMoreOfWhatYouLike).toHaveBeenCalledWith('u-1', 2, 0);
    expect(out.source).toBe('personalized');
    expect(out.pagination).toEqual({ limit: 2, offset: 0, total: 4 });
    expect(out.data[0].source_rank).toBeUndefined();
  });

  it('getAlbumsForYou chooses followed -> top -> fallback sources', async () => {
    feedModel.getAlbumsFromFollowedArtists.mockResolvedValueOnce({
      items: [{ id: 'a1', name: 'A1' }],
      total: 1,
    });
    feedModel.getFirstPreviewTracksByAlbumIds.mockResolvedValue([]);

    const a = await feedService.getAlbumsForYou('u-1', { limit: 5, offset: 0 });
    expect(a.source).toBe('followed_artists');

    feedModel.getAlbumsFromFollowedArtists.mockResolvedValueOnce({ items: [], total: 0 });
    feedModel.getTopAlbums.mockResolvedValueOnce({ items: [{ id: 'a2', name: 'A2' }], total: 1 });
    const b = await feedService.getAlbumsForYou('u-1', { limit: 5, offset: 0 });
    expect(b.source).toBe('global_top');

    feedModel.getAlbumsFromFollowedArtists.mockResolvedValueOnce({ items: [], total: 0 });
    feedModel.getTopAlbums.mockResolvedValueOnce({ items: [], total: 0 });
    feedModel.getAllAlbums.mockResolvedValueOnce({ items: [{ id: 'a3', name: 'A3' }], total: 1 });
    const c = await feedService.getAlbumsForYou('u-1', { limit: 5, offset: 0 });
    expect(c.source).toBe('all_albums_fallback');
  });

  it('getDailyMix returns curated payload', async () => {
    feedModel.getDailyTracks.mockResolvedValue([{ id: 't1', cover_image: 'x' }]);
    playlistModel.findOrCreateDailyMixPlaylist.mockResolvedValue({ id: 'daily-id' });

    const out = await feedService.getDailyMix('u-1');

    expect(out.mix_id).toBe('daily-id');
    expect(out.title).toBe('Daily Drops');
    expect(out.tracks).toHaveLength(1);
  });

  it('getWeeklyMix falls back to daily when no personalized source', async () => {
    feedModel.getWeeklyTracks.mockResolvedValue([{ id: 't1', source_rank: 6 }]);
    feedModel.getDailyTracks.mockResolvedValue([{ id: 't2', cover_image: 'x' }]);
    playlistModel.findOrCreateWeeklyMixPlaylist.mockResolvedValue({ id: 'weekly-id' });

    const out = await feedService.getWeeklyMix('u-1');

    expect(out.mix_id).toBe('weekly-id');
    expect(out.tracks[0].id).toBe('t2');
  });

  it('getWeeklyMix keeps weekly tracks when personalized signals exist', async () => {
    feedModel.getWeeklyTracks.mockResolvedValue([{ id: 't1', source_rank: 2 }]);
    feedModel.getDailyTracks.mockResolvedValue([{ id: 't2' }]);
    playlistModel.findOrCreateWeeklyMixPlaylist.mockResolvedValue({ id: 'weekly-id' });

    const out = await feedService.getWeeklyMix('u-1');
    expect(out.tracks[0].id).toBe('t1');
  });

  it('getMixById supports legacy mix key and uuid lookup', async () => {
    feedModel.findGenreById.mockResolvedValue({ id: GENRE_UUID, name: 'House' });
    feedModel.findTracksByGenreId.mockResolvedValue([{ id: 't1', user_id: 'a1' }]);

    const out1 = await feedService.getMixById('u-1', `mix_genre_${GENRE_UUID}`);
    expect(out1.title).toBe('House Mix');

    playlistModel.findDynamicMixPlaylistById.mockResolvedValue({
      id: VALID_UUID,
      type: 'auto_generated',
      genre_id: GENRE_UUID,
      name: 'My Mix',
    });
    const out2 = await feedService.getMixById('u-1', VALID_UUID);
    expect(out2.mix_id).toBe(VALID_UUID);
    expect(out2.title).toBe('My Mix');
  });

  it('getMixById prunes duplicate artist tracks and stops at the artist diversity limit', async () => {
    feedModel.findGenreById.mockResolvedValue({ id: GENRE_UUID, name: 'House' });
    const tracks = [
      { id: 'artist-1-track-1', user_id: 'artist-1', cover_image: 'c1' },
      { id: 'artist-1-track-2', user_id: 'artist-1', cover_image: 'c2' },
      { id: 'artist-1-track-3', user_id: 'artist-1', cover_image: 'c3' },
    ];

    for (let artistIndex = 2; artistIndex <= 15; artistIndex += 1) {
      tracks.push(
        { id: `artist-${artistIndex}-track-1`, user_id: `artist-${artistIndex}`, cover_image: `c${artistIndex}a` },
        { id: `artist-${artistIndex}-track-2`, user_id: `artist-${artistIndex}`, cover_image: `c${artistIndex}b` }
      );
    }

    feedModel.findTracksByGenreId.mockResolvedValue(tracks);

    const out = await feedService.getMixById('u-1', `mix_genre_${GENRE_UUID}`);

    expect(out.tracks).toHaveLength(30);
    expect(out.tracks.filter((track) => track.user_id === 'artist-1')).toHaveLength(2);
    expect(out.tracks[out.tracks.length - 1].user_id).toBe('artist-15');
  });

  it('getMixById throws when resolved genre does not exist', async () => {
    feedModel.findGenreById.mockResolvedValueOnce(null);
    await expect(feedService.getMixById('u-1', `mix_genre_${GENRE_UUID}`)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('likeMix validates input and delegates like service', async () => {
    await expect(feedService.likeMix('u-1', 'bad')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    playlistModel.findDynamicMixPlaylistById.mockResolvedValueOnce(null);
    await expect(feedService.likeMix('u-1', VALID_UUID)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    playlistModel.findDynamicMixPlaylistById.mockResolvedValueOnce({ id: VALID_UUID });
    playlistLikesService.likePlaylist.mockResolvedValue({ isNew: true });

    const out = await feedService.likeMix('u-1', VALID_UUID);
    expect(playlistLikesService.likePlaylist).toHaveBeenCalledWith('u-1', VALID_UUID);
    expect(out).toEqual({ isNew: true });
  });

  it('unlikeMix returns unliked based on deleted rows', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });
    await expect(feedService.unlikeMix('u-1', VALID_UUID)).resolves.toEqual({
      unliked: true,
      playlist_id: VALID_UUID,
    });

    db.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(feedService.unlikeMix('u-1', VALID_UUID)).resolves.toEqual({
      unliked: false,
      playlist_id: VALID_UUID,
    });
  });

  it('unlikeMix validates uuid format', async () => {
    await expect(feedService.unlikeMix('u-1', 'bad-id')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
    });
  });

  it('likeGenreTrending and unlikeGenreTrending handle idempotency', async () => {
    feedModel.findGenreById.mockResolvedValue({ id: GENRE_UUID, name: 'Jazz' });
    db.query.mockResolvedValueOnce({ rows: [{ id: 'playlist-jazz' }] }).mockResolvedValueOnce({});

    const likeOut = await feedService.likeGenreTrending('u-1', GENRE_UUID);
    expect(likeOut).toEqual({
      playlist_id: 'playlist-jazz',
      genre_id: GENRE_UUID,
      genre_name: 'Jazz',
    });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(feedService.unlikeGenreTrending('u-1', GENRE_UUID)).resolves.toEqual({
      unliked: false,
    });

    db.query.mockResolvedValueOnce({ rows: [{ id: 'playlist-jazz' }] }).mockResolvedValueOnce({});
    await expect(feedService.unlikeGenreTrending('u-1', GENRE_UUID)).resolves.toEqual({
      unliked: true,
      playlist_id: 'playlist-jazz',
    });
  });

  it('likeGenreTrending throws when genre does not exist', async () => {
    feedModel.findGenreById.mockResolvedValueOnce(null);
    await expect(feedService.likeGenreTrending('u-1', GENRE_UUID)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('isGenreTrendingLiked returns false without user and true when row exists', async () => {
    await expect(feedService.isGenreTrendingLiked(null, GENRE_UUID)).resolves.toBe(false);
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    await expect(feedService.isGenreTrendingLiked('u-1', GENRE_UUID)).resolves.toBe(true);
  });

  it('listStations and getArtistsToWatch return paginated response', async () => {
    feedModel.getStationsPaginated.mockResolvedValue({
      items: [{ artist_id: VALID_UUID, track_count: 1, artist_name: 'A', id: 's1' }],
      total: 1,
    });
    feedModel.getTracksByArtistId.mockResolvedValue({
      items: [{ id: 't1', cover_image: 'x' }],
      total: 1,
    });

    const stationsOut = await feedService.listStations({ limit: 10, offset: 0 }, null);
    expect(stationsOut.pagination.total).toBe(1);

    feedModel.getArtistsToWatchPaginated.mockResolvedValue({ items: [{ id: 'a1' }], total: 1 });
    const artistsOut = await feedService.getArtistsToWatch({ limit: 10, offset: 0 }, 'u-1');
    expect(artistsOut).toEqual({
      data: [{ id: 'a1' }],
      pagination: { limit: 10, offset: 0, total: 1 },
    });
  });

  it('getStationTracks throws when station missing and returns data when present', async () => {
    feedModel.getStationByArtistId.mockResolvedValueOnce(null);
    await expect(
      feedService.getStationTracks(VALID_UUID, { limit: 2, offset: 0 }, null)
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    feedModel.getStationByArtistId.mockResolvedValueOnce({
      id: 's1',
      artist_id: VALID_UUID,
      artist_name: 'Artist',
      cover_image: null,
      track_count: 1,
    });
    feedModel.getTracksByArtistId.mockResolvedValueOnce({ items: [{ id: 't1' }], total: 1 });

    const out = await feedService.getStationTracks(VALID_UUID, { limit: 2, offset: 0 }, null);
    expect(out.pagination.total).toBe(1);
    expect(out.station.artist_id).toBe(VALID_UUID);
  });

  it('getStationTracks throws when station exists but cannot be enriched', async () => {
    feedModel.getStationByArtistId.mockResolvedValueOnce({
      id: 's1',
      artist_id: VALID_UUID,
      artist_name: 'Artist',
      cover_image: null,
      track_count: 0,
    });

    await expect(
      feedService.getStationTracks(VALID_UUID, { limit: 2, offset: 0 }, null)
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('getStationTracks decorates saved state for authenticated viewer', async () => {
    feedModel.getStationByArtistId.mockResolvedValueOnce({
      id: 's1',
      artist_id: VALID_UUID,
      artist_name: 'Artist',
      cover_image: 'artist.jpg',
      track_count: 1,
    });
    feedModel.getTracksByArtistId.mockResolvedValueOnce({
      items: [{ id: 't1', cover_image: 'track.jpg', user_id: VALID_UUID }],
      total: 1,
    });
    stationModel.isStationSaved.mockResolvedValueOnce(true);

    const out = await feedService.getStationTracks(VALID_UUID, { limit: 2, offset: 0 }, 'u-1');

    expect(out.station.is_saved).toBe(true);
    expect(out.station.preview_track.id).toBe('t1');
  });

  it('getActivityFeedService and getDiscoveryFeedService shape items', async () => {
    feedModel.getActivityFeed.mockResolvedValue({
      items: [{ id: 'x' }],
      hasMore: false,
      nextCursor: null,
    });
    const a = await feedService.getActivityFeedService('u-1', 20, null);
    expect(a.data).toEqual([{ id: 'x' }]);

    feedModel.getDiscoveryFeed.mockResolvedValue({
      items: [
        {
          track_id: 't1',
          title: 'T',
          duration: 100,
          play_count: 2,
          like_count: 3,
          cover_image: null,
          preview_url: null,
          stream_url: 's.mp3',
          audio_url: 'a.mp3',
          artist_id: 'ar1',
          artist_username: 'art',
          artist_profile_picture: null,
          reason_type: 'new_release',
          source_name: 'art',
          source_id: 'ar1',
        },
      ],
      hasMore: true,
      nextCursor: 'next',
    });

    const d = await feedService.getDiscoveryFeedService('u-1', 20, null);
    expect(d.data[0].reason.label).toBe('New release by art');
    expect(d.hasMore).toBe(true);
  });

  it('getActivityFeedService throws when user does not exist', async () => {
    userModel.findById.mockResolvedValueOnce(null);
    await expect(feedService.getActivityFeedService('ghost-user', 20, null)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('getRelatedTracks throws when reference track not found and returns shaped payload', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      feedService.getRelatedTracks(VALID_UUID, 'u-1', { limit: 5, offset: 0 })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    db.query.mockResolvedValueOnce({
      rows: [{ id: VALID_UUID, artist_id: 'a1', genre_id: GENRE_UUID, title: 'R' }],
    });
    trackModel.findRelatedTracks.mockResolvedValue({ tracks: [{ id: 't2' }], total: 1 });

    const out = await feedService.getRelatedTracks(VALID_UUID, 'u-1', { limit: 5, offset: 0 });
    expect(out.meta).toEqual({ limit: 5, offset: 0, total: 1 });
    expect(out.reference_track.id).toBe(VALID_UUID);
  });

  it('likeTrackRadio, unlikeTrackRadio and getTrackRadioTracks handle all major branches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(feedService.likeTrackRadio('u-1', VALID_UUID)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    db.query
      .mockResolvedValueOnce({
        rows: [{ id: VALID_UUID, title: 'Song', cover_image: 'c', artist_name: 'A' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'radio-1' }] })
      .mockResolvedValueOnce({});
    const likeOut = await feedService.likeTrackRadio('u-1', VALID_UUID);
    expect(likeOut.playlist_id).toBe('radio-1');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(feedService.unlikeTrackRadio('u-1', VALID_UUID)).resolves.toEqual({
      unliked: false,
    });

    db.query.mockResolvedValueOnce({ rows: [{ id: 'radio-1' }] }).mockResolvedValueOnce({});
    await expect(feedService.unlikeTrackRadio('u-1', VALID_UUID)).resolves.toEqual({
      unliked: true,
      playlist_id: 'radio-1',
    });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      feedService.getTrackRadioTracks('u-1', 'radio-1', { limit: 2, offset: 0 })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('getTrackRadioTracks returns playlist metadata and related tracks', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'radio-1',
            name: 'Song Radio',
            description: 'desc',
            cover_image: 'c',
            seed_track_id: VALID_UUID,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, artist_id: 'a1', genre_id: GENRE_UUID }] });

    trackModel.findRelatedTracks.mockResolvedValue({ tracks: [{ id: 't2' }], total: 1 });

    const out = await feedService.getTrackRadioTracks('u-1', 'radio-1', { limit: 2, offset: 0 });
    expect(out.playlist_id).toBe('radio-1');
    expect(out.seed_track_id).toBe(VALID_UUID);
    expect(out.tracks).toHaveLength(1);
  });
  it('parseGenreIdFromMixId returns null for uuid explicitly', () => {
  expect(feedService.parseGenreIdFromMixId(VALID_UUID)).toBeNull();
});

it('getMoreOfWhatYouLike handles empty items', async () => {
  feedModel.getMoreOfWhatYouLike.mockResolvedValue({
    items: [],
    total: 0,
    source: 'fallback',
  });

  const out = await feedService.getMoreOfWhatYouLike('u-1', { limit: 10, offset: 0 });

  expect(out.data).toEqual([]);
  expect(out.pagination.total).toBe(0);
});

it('getDailyMix throws when user not found', async () => {
  userModel.findById.mockResolvedValueOnce(null);

  await expect(feedService.getDailyMix('bad-user')).rejects.toMatchObject({
    code: 'RESOURCE_NOT_FOUND',
  });
});

it('getWeeklyMix throws when user not found', async () => {
  userModel.findById.mockResolvedValueOnce(null);

  await expect(feedService.getWeeklyMix('bad-user')).rejects.toMatchObject({
    code: 'RESOURCE_NOT_FOUND',
  });
});

it('listStations returns empty when no stations', async () => {
  feedModel.getStationsPaginated.mockResolvedValue({ items: [], total: 0 });

  const out = await feedService.listStations({ limit: 10, offset: 0 }, null);

  expect(out.data).toEqual([]);
  expect(out.pagination.total).toBe(0);
});

it('getArtistsToWatch handles empty result', async () => {
  feedModel.getArtistsToWatchPaginated.mockResolvedValue({ items: [], total: 0 });

  const out = await feedService.getArtistsToWatch({ limit: 10, offset: 0 }, null);

  expect(out.data).toEqual([]);
});

it('decorateHomeItems returns payload unchanged when no userId', async () => {
  const payload = { test: true };

  const result = await testables.decorateHomeItems(null, payload);

  expect(result).toEqual(payload);
});

it('getHotForYou throws when no personalized and no fallback', async () => {
  feedModel.getDailyTracks.mockResolvedValue([]);
  feedModel.getMoreOfWhatYouLike.mockResolvedValue({ items: [] });

  await expect(feedService.getHotForYou('u-1')).rejects.toMatchObject({
    code: 'RESOURCE_NOT_FOUND',
  });
});

it('getDiscoveryFeedService covers new_release reason label', async () => {
  feedModel.getDiscoveryFeed.mockResolvedValue({
    items: [
      {
        track_id: 't1',
        title: 'T1',
        duration: 1,
        play_count: 0,
        like_count: 0,
        cover_image: null,
        preview_url: null,
        stream_url: null,
        audio_url: null,
        artist_id: 'a1',
        artist_username: 'artist',
        artist_profile_picture: null,
        reason_type: 'new_release',
        source_name: 'Artist X',
        source_id: 'a1',
      },
    ],
    hasMore: false,
    nextCursor: null,
  });

  const out = await feedService.getDiscoveryFeedService('u-1');

  expect(out.data[0].reason.label).toBe('New release by Artist X');
});
});
