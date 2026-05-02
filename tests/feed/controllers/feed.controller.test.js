const controller = require('../../../src/controllers/feed.controller');
const feedService = require('../../../src/services/feed.service');

jest.mock('../../../src/services/feed.service', () => ({
  getHome: jest.fn(),
  getHotForYou: jest.fn(),
  getTrendingByGenre: jest.fn(),
  getArtistsToWatch: jest.fn(),
  getMoreOfWhatYouLike: jest.fn(),
  getAlbumsForYou: jest.fn(),
  getDailyMix: jest.fn(),
  getWeeklyMix: jest.fn(),
  getMixById: jest.fn(),
  likeMix: jest.fn(),
  unlikeMix: jest.fn(),
  likeGenreTrending: jest.fn(),
  unlikeGenreTrending: jest.fn(),
  listStations: jest.fn(),
  getStationTracks: jest.fn(),
  getDiscoveryFeedService: jest.fn(),
  getActivityFeedService: jest.fn(),
  getRelatedTracks: jest.fn(),
  likeTrackRadio: jest.fn(),
  unlikeTrackRadio: jest.fn(),
  getTrackRadioTracks: jest.fn(),
}));

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

const mkReq = ({ userId = 'u-1', params = {}, query = {}, body = {}, user } = {}) => ({
  user: user !== undefined ? user : userId ? { sub: userId } : undefined,
  params,
  query,
  body,
});

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('Feed - Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getHome returns 200 and payload', async () => {
    const req = mkReq();
    const res = mkRes();
    feedService.getHome.mockResolvedValue({ key: 'value' });

    await controller.getHome(req, res);

    expect(feedService.getHome).toHaveBeenCalledWith('u-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { key: 'value' },
      message: 'Home page data fetched successfully.',
    });
  });

  it('getHome passes null for guest user', async () => {
    const req = mkReq({ userId: null });
    const res = mkRes();
    feedService.getHome.mockResolvedValue({ guest: true });

    await controller.getHome(req, res);
    expect(feedService.getHome).toHaveBeenCalledWith(null);
  });

  it('getHotForYou supports guest user', async () => {
    const req = mkReq({ userId: null });
    const res = mkRes();
    feedService.getHotForYou.mockResolvedValue({ track: { id: 't1' } });

    await controller.getHotForYou(req, res);

    expect(feedService.getHotForYou).toHaveBeenCalledWith(null);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTrendingByGenre validates uuid', async () => {
    await expect(
      controller.getTrendingByGenre(mkReq({ params: { genre_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
  });

  it('getTrendingByGenre clamps pagination and responds', async () => {
    const req = mkReq({
      params: { genre_id: VALID_UUID },
      query: { limit: '999', offset: '-2' },
    });
    const res = mkRes();
    feedService.getTrendingByGenre.mockResolvedValue({ tracks: [] });

    await controller.getTrendingByGenre(req, res);

    expect(feedService.getTrendingByGenre).toHaveBeenCalledWith(
      VALID_UUID,
      { limit: 50, offset: 0 },
      'u-1'
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTrendingByGenre passes null user for guests', async () => {
    const req = mkReq({ userId: null, params: { genre_id: VALID_UUID }, query: {} });
    const res = mkRes();
    feedService.getTrendingByGenre.mockResolvedValue({ tracks: [] });

    await controller.getTrendingByGenre(req, res);
    expect(feedService.getTrendingByGenre).toHaveBeenCalledWith(VALID_UUID, { limit: 20, offset: 0 }, null);
  });

  it('getMoreOfWhatYouLike requires auth', async () => {
    await expect(
      controller.getMoreOfWhatYouLike(mkReq({ userId: null }), mkRes())
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
      statusCode: 401,
    });
  });

  it('getMoreOfWhatYouLike returns service payload', async () => {
    const req = mkReq({ query: { limit: '7', offset: '2' } });
    const res = mkRes();
    feedService.getMoreOfWhatYouLike.mockResolvedValue({
      data: [{ id: 't1' }],
      source: 'personalized',
      pagination: { limit: 7, offset: 2, total: 10 },
    });

    await controller.getMoreOfWhatYouLike(req, res);

    expect(feedService.getMoreOfWhatYouLike).toHaveBeenCalledWith('u-1', { limit: 7, offset: 2 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getAlbumsForYou clamps with albums config', async () => {
    const req = mkReq({ query: { limit: '200', offset: '-5' } });
    const res = mkRes();
    feedService.getAlbumsForYou.mockResolvedValue({
      data: [],
      source: 'global_top',
      pagination: { limit: 20, offset: 0, total: 0 },
    });

    await controller.getAlbumsForYou(req, res);

    expect(feedService.getAlbumsForYou).toHaveBeenCalledWith('u-1', { limit: 20, offset: 0 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getAlbumsForYou requires auth', async () => {
    await expect(
      controller.getAlbumsForYou(mkReq({ userId: null }), mkRes())
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
      statusCode: 401,
    });
  });

  it('getDailyMix/getWeeklyMix/getMixById require auth', async () => {
    await expect(controller.getDailyMix(mkReq({ userId: null }), mkRes())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
    });
    await expect(controller.getWeeklyMix(mkReq({ userId: null }), mkRes())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
    });
    await expect(
      controller.getMixById(mkReq({ userId: null, params: { mixId: VALID_UUID } }), mkRes())
    ).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });
  });

  it('getDailyMix/getWeeklyMix/getMixById return 200', async () => {
    const res1 = mkRes();
    feedService.getDailyMix.mockResolvedValue({ mix_id: 'd' });
    await controller.getDailyMix(mkReq(), res1);
    expect(res1.status).toHaveBeenCalledWith(200);

    const res2 = mkRes();
    feedService.getWeeklyMix.mockResolvedValue({ mix_id: 'w' });
    await controller.getWeeklyMix(mkReq(), res2);
    expect(res2.status).toHaveBeenCalledWith(200);

    const res3 = mkRes();
    feedService.getMixById.mockResolvedValue({ mix_id: 'm' });
    await controller.getMixById(mkReq({ params: { mixId: VALID_UUID } }), res3);
    expect(feedService.getMixById).toHaveBeenCalledWith('u-1', VALID_UUID);
    expect(res3.status).toHaveBeenCalledWith(200);
  });

  it('likeMix returns 201 for new like', async () => {
    const res = mkRes();
    feedService.likeMix.mockResolvedValue({
      isNew: true,
      likeId: 'l1',
      userId: 'u-1',
      playlistId: VALID_UUID,
      createdAt: '2026-01-01',
    });

    await controller.likeMix(mkReq({ params: { mixId: VALID_UUID } }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Mix liked successfully.' })
    );
  });

  it('likeMix requires auth', async () => {
    await expect(
      controller.likeMix(mkReq({ userId: null, params: { mixId: VALID_UUID } }), mkRes())
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
      statusCode: 401,
    });
  });

  it('likeMix returns 200 for existing like', async () => {
    const res = mkRes();
    feedService.likeMix.mockResolvedValue({
      isNew: false,
      likeId: 'l1',
      userId: 'u-1',
      playlistId: VALID_UUID,
      createdAt: '2026-01-01',
    });

    await controller.likeMix(mkReq({ params: { mixId: VALID_UUID } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Mix already liked.' })
    );
  });

  it('unlikeMix requires auth and returns success payload', async () => {
    await expect(controller.unlikeMix(mkReq({ userId: null }), mkRes())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
    });

    const res = mkRes();
    feedService.unlikeMix.mockResolvedValue({ unliked: true, playlist_id: VALID_UUID });
    await controller.unlikeMix(mkReq({ params: { mixId: VALID_UUID } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { unliked: true, playlist_id: VALID_UUID },
      message: 'Mix unliked.',
    });
  });

  it('likeGenreTrending/unlikeGenreTrending validate auth and uuid', async () => {
    await expect(
      controller.likeGenreTrending(
        mkReq({ userId: null, params: { genre_id: VALID_UUID } }),
        mkRes()
      )
    ).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });

    await expect(
      controller.likeGenreTrending(mkReq({ params: { genre_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(
      controller.unlikeGenreTrending(mkReq({ params: { genre_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(
      controller.unlikeGenreTrending(
        mkReq({ userId: null, params: { genre_id: VALID_UUID } }),
        mkRes()
      )
    ).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });
  });

  it('likeGenreTrending/unlikeGenreTrending return 200', async () => {
    const res1 = mkRes();
    feedService.likeGenreTrending.mockResolvedValue({ playlist_id: 'p1' });
    await controller.likeGenreTrending(mkReq({ params: { genre_id: VALID_UUID } }), res1);
    expect(res1.status).toHaveBeenCalledWith(200);

    const res2 = mkRes();
    feedService.unlikeGenreTrending.mockResolvedValue({ unliked: true });
    await controller.unlikeGenreTrending(mkReq({ params: { genre_id: VALID_UUID } }), res2);
    expect(res2.status).toHaveBeenCalledWith(200);
  });

  it('listStations and getArtistsToWatch apply pagination defaults', async () => {
    const res1 = mkRes();
    feedService.listStations.mockResolvedValue({
      data: [],
      pagination: { limit: 10, offset: 0, total: 0 },
    });
    await controller.listStations(mkReq({ userId: null, query: {} }), res1);
    expect(feedService.listStations).toHaveBeenCalledWith({ limit: 10, offset: 0 }, null);

    const res2 = mkRes();
    feedService.getArtistsToWatch.mockResolvedValue({
      data: [],
      pagination: { limit: 10, offset: 0, total: 0 },
    });
    await controller.getArtistsToWatch(mkReq({ query: { limit: '0' } }), res2);
    expect(feedService.getArtistsToWatch).toHaveBeenCalledWith({ limit: 1, offset: 0 }, 'u-1');
  });

  it('getStationTracks validates artist_id and responds', async () => {
    await expect(
      controller.getStationTracks(mkReq({ params: { artist_id: 'invalid' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });

    const res = mkRes();
    feedService.getStationTracks.mockResolvedValue({
      station: { id: 's1' },
      data: [],
      pagination: { limit: 50, offset: 0, total: 0 },
    });

    await controller.getStationTracks(
      mkReq({ params: { artist_id: VALID_UUID }, query: { limit: '999', offset: '-9' } }),
      res
    );

    expect(feedService.getStationTracks).toHaveBeenCalledWith(
      VALID_UUID,
      { limit: 100, offset: 0 },
      'u-1'
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getStationTracks and getArtistsToWatch support guest user ids', async () => {
    const res1 = mkRes();
    feedService.getStationTracks.mockResolvedValue({
      station: { id: 's1' },
      data: [],
      pagination: { limit: 50, offset: 0, total: 0 },
    });
    await controller.getStationTracks(mkReq({ userId: null, params: { artist_id: VALID_UUID } }), res1);
    expect(feedService.getStationTracks).toHaveBeenCalledWith(VALID_UUID, { limit: 50, offset: 0 }, null);

    const res2 = mkRes();
    feedService.getArtistsToWatch.mockResolvedValue({
      data: [],
      pagination: { limit: 10, offset: 0, total: 0 },
    });
    await controller.getArtistsToWatch(mkReq({ userId: null, query: {} }), res2);
    expect(feedService.getArtistsToWatch).toHaveBeenCalledWith({ limit: 10, offset: 0 }, null);
  });

  it('getActivityFeedController requires auth and returns paged response', async () => {
    await expect(
      controller.getActivityFeedController(mkReq({ userId: null }), mkRes())
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
    });

    const req = mkReq({ query: { limit: '15', cursor: 'abc' } });
    const res = mkRes();
    feedService.getActivityFeedService.mockResolvedValue({
      data: [{ id: '1' }],
      hasMore: true,
      nextCursor: 'n',
    });

    await controller.getActivityFeedController(req, res);

    expect(feedService.getActivityFeedService).toHaveBeenCalledWith('u-1', 15, 'abc');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getActivityFeedController and unlikeTrackRadio cover default/invalid branches', async () => {
    const req = mkReq({ query: { limit: 'bad' } });
    const res = mkRes();
    feedService.getActivityFeedService.mockResolvedValue({
      data: [],
      hasMore: false,
      nextCursor: null,
    });

    await controller.getActivityFeedController(req, res);
    expect(feedService.getActivityFeedService).toHaveBeenCalledWith('u-1', 20, null);

    await expect(
      controller.unlikeTrackRadio(mkReq({ params: { track_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('getDiscoveryFeedController requires auth and uses default limit/cursor', async () => {
    await expect(
      controller.getDiscoveryFeedController(mkReq({ userId: null }), mkRes())
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_MISSING',
    });

    const req = mkReq({ query: {} });
    const res = mkRes();
    feedService.getDiscoveryFeedService.mockResolvedValue({
      data: [],
      hasMore: false,
      nextCursor: null,
    });

    await controller.getDiscoveryFeedController(req, res);

    expect(feedService.getDiscoveryFeedService).toHaveBeenCalledWith('u-1', 20, null);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getRelatedTracks validates id and returns success', async () => {
    await expect(
      controller.getRelatedTracks(mkReq({ params: { track_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const res = mkRes();
    feedService.getRelatedTracks.mockResolvedValue({ tracks: [], meta: {} });

    await controller.getRelatedTracks(
      mkReq({ params: { track_id: VALID_UUID }, userId: null, query: { limit: '2', offset: '3' } }),
      res
    );

    expect(feedService.getRelatedTracks).toHaveBeenCalledWith(VALID_UUID, null, {
      limit: 2,
      offset: 3,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('track radio endpoints validate auth + ids and return status codes', async () => {
    await expect(controller.likeTrackRadio(mkReq({ userId: null }), mkRes())).rejects.toMatchObject(
      {
        code: 'AUTH_TOKEN_MISSING',
      }
    );

    await expect(
      controller.likeTrackRadio(mkReq({ params: { track_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const likeRes = mkRes();
    feedService.likeTrackRadio.mockResolvedValue({ playlist_id: 'p1' });
    await controller.likeTrackRadio(mkReq({ params: { track_id: VALID_UUID } }), likeRes);
    expect(likeRes.status).toHaveBeenCalledWith(201);

    const unlikeRes = mkRes();
    feedService.unlikeTrackRadio.mockResolvedValue({ unliked: true });
    await controller.unlikeTrackRadio(mkReq({ params: { track_id: VALID_UUID } }), unlikeRes);
    expect(unlikeRes.status).toHaveBeenCalledWith(200);

    await expect(
      controller.unlikeTrackRadio(
        mkReq({ userId: null, params: { track_id: VALID_UUID } }),
        mkRes()
      )
    ).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });

    await expect(
      controller.getTrackRadioTracks(mkReq({ params: { playlist_id: 'bad' } }), mkRes())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(
      controller.getTrackRadioTracks(
        mkReq({ userId: null, params: { playlist_id: VALID_UUID } }),
        mkRes()
      )
    ).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });

    const tracksRes = mkRes();
    feedService.getTrackRadioTracks.mockResolvedValue({ playlist_id: 'p1', tracks: [] });
    await controller.getTrackRadioTracks(
      mkReq({ params: { playlist_id: VALID_UUID }, query: { limit: '0' } }),
      tracksRes
    );
    expect(feedService.getTrackRadioTracks).toHaveBeenCalledWith('u-1', VALID_UUID, {
      limit: 1,
      offset: 0,
    });
    expect(tracksRes.status).toHaveBeenCalledWith(200);
  });

  it('bubbles rejected promises from service', async () => {
    const req = mkReq();
    const res = mkRes();
    feedService.getHome.mockRejectedValue(new Error('service down'));

    await expect(controller.getHome(req, res)).rejects.toThrow('service down');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('parsePagination handles NaN values (defaults)', async () => {
  const req = mkReq({
    params: { genre_id: VALID_UUID },
    query: { limit: 'abc', offset: 'xyz' },
  });
  const res = mkRes();
  feedService.getTrendingByGenre.mockResolvedValue({});

  await controller.getTrendingByGenre(req, res);

  expect(feedService.getTrendingByGenre).toHaveBeenCalledWith(
    VALID_UUID,
    { limit: 20, offset: 0 },
    'u-1'
  );
});

it('getHotForYou returns full response body', async () => {
  const req = mkReq();
  const res = mkRes();

  feedService.getHotForYou.mockResolvedValue({ id: 't1' });

  await controller.getHotForYou(req, res);

  expect(res.json).toHaveBeenCalledWith({
    data: { id: 't1' },
    message: 'Hot for you track fetched successfully.',
  });
});

it('getDiscoveryFeedController handles custom limit and cursor', async () => {
  const req = mkReq({ query: { limit: '5', cursor: 'abc' } });
  const res = mkRes();

  feedService.getDiscoveryFeedService.mockResolvedValue({
    data: [],
    hasMore: false,
    nextCursor: null,
  });

  await controller.getDiscoveryFeedController(req, res);

  expect(feedService.getDiscoveryFeedService).toHaveBeenCalledWith('u-1', 5, 'abc');
});

it('getActivityFeedController handles null cursor explicitly', async () => {
  const req = mkReq({ query: {} });
  const res = mkRes();

  feedService.getActivityFeedService.mockResolvedValue({
    data: [],
    hasMore: false,
    nextCursor: null,
  });

  await controller.getActivityFeedController(req, res);

  expect(feedService.getActivityFeedService).toHaveBeenCalledWith('u-1', 20, null);
});

it('getRelatedTracks works with authenticated user', async () => {
  const req = mkReq({
    params: { track_id: VALID_UUID },
    query: {},
  });
  const res = mkRes();

  feedService.getRelatedTracks.mockResolvedValue({ tracks: [] });

  await controller.getRelatedTracks(req, res);

  expect(feedService.getRelatedTracks).toHaveBeenCalledWith(
    VALID_UUID,
    'u-1',
    { limit: 20, offset: 0 }
  );
});

it('getTrackRadioTracks uses default pagination when no query', async () => {
  const req = mkReq({
    params: { playlist_id: VALID_UUID },
    query: {},
  });
  const res = mkRes();

  feedService.getTrackRadioTracks.mockResolvedValue({});

  await controller.getTrackRadioTracks(req, res);

  expect(feedService.getTrackRadioTracks).toHaveBeenCalledWith(
    'u-1',
    VALID_UUID,
    { limit: 20, offset: 0 }
  );
});

it('getArtistsToWatch clamps to max limit', async () => {
  const req = mkReq({ query: { limit: '999' } });
  const res = mkRes();

  feedService.getArtistsToWatch.mockResolvedValue({
    data: [],
    pagination: {},
  });

  await controller.getArtistsToWatch(req, res);

  expect(feedService.getArtistsToWatch).toHaveBeenCalledWith(
    { limit: 20, offset: 0 },
    'u-1'
  );
});

it('getStationTracks uses default pagination when no query', async () => {
  const req = mkReq({
    params: { artist_id: VALID_UUID },
    query: {},
  });
  const res = mkRes();

  feedService.getStationTracks.mockResolvedValue({
    station: {},
    data: [],
    pagination: {},
  });

  await controller.getStationTracks(req, res);

  expect(feedService.getStationTracks).toHaveBeenCalledWith(
    VALID_UUID,
    { limit: 50, offset: 0 },
    'u-1'
  );
});

});
