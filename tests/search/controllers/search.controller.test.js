// ============================================================
// tests/search.controller.unit.test.js
// ============================================================
const { search, suggestions } = require('../../../src/controllers/search.controller');
const searchService = require('../../../src/services/search.service');

jest.mock('../../../src/services/search.service');

// ── Helpers ──────────────────────────────────────────────────

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const mkReq = ({ query = {}, user = null } = {}) => ({ query, user });

const serviceOk = (overrides = {}) =>
  searchService.search.mockResolvedValue({
    data: [],
    pagination: { total: 0 },
    filters: null,
    ...overrides,
  });

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════
// search — query validation
// ══════════════════════════════════════════════════════════════
describe('search — query validation', () => {
  it('returns 400 when q is missing', async () => {
    const req = mkReq({ query: {} });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      })
    );
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 when q is an empty/whitespace string', async () => {
    const req = mkReq({ query: { q: '   ' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'q' })])
    );
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid type value', async () => {
    const req = mkReq({ query: { q: 'test', type: 'bananas' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'type' })])
    );
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid sort value', async () => {
    const req = mkReq({ query: { q: 'test', sort: 'random' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'sort' })])
    );
  });
});

// ══════════════════════════════════════════════════════════════
// search — time_range filter validation
// ══════════════════════════════════════════════════════════════
describe('search — time_range filter', () => {
  it('returns 400 when time_range is used without type=tracks', async () => {
    const req = mkReq({ query: { q: 'test', type: 'albums', time_range: 'past_day' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'time_range' })])
    );
  });

  it('returns 400 for an invalid time_range value on type=tracks', async () => {
    const req = mkReq({ query: { q: 'test', type: 'tracks', time_range: 'past_decade' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'time_range' })])
    );
  });

  it('accepts a valid time_range on type=tracks', async () => {
    const req = mkReq({ query: { q: 'test', type: 'tracks', time_range: 'past_week' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ time_range: 'past_week' })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// search — duration filter validation
// ══════════════════════════════════════════════════════════════
describe('search — duration filter', () => {
  it('returns 400 when duration is used without type=tracks', async () => {
    const req = mkReq({ query: { q: 'test', type: 'users', duration: 'short' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'duration' })])
    );
  });

  it('returns 400 for an invalid duration value on type=tracks', async () => {
    const req = mkReq({ query: { q: 'test', type: 'tracks', duration: 'epic' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'duration' })])
    );
  });

  it('accepts all valid duration values on type=tracks', async () => {
    for (const duration of ['short', 'medium', 'long', 'extra']) {
      const req = mkReq({ query: { q: 'test', type: 'tracks', duration } });
      const res = mkRes();
      serviceOk();

      await search(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      jest.clearAllMocks();
    }
  });
});

// ══════════════════════════════════════════════════════════════
// search — tag / location filter validation
// ══════════════════════════════════════════════════════════════
describe('search — tag and location filters', () => {
  it('returns 400 when tag filter is used with type=users', async () => {
    const req = mkReq({ query: { q: 'test', type: 'users', tag: 'jazz' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'tag' })])
    );
  });

  it('returns 400 when location filter is used with type != users', async () => {
    const req = mkReq({ query: { q: 'test', type: 'tracks', location: 'Cairo' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'location' })])
    );
  });

  it('allows location filter with type=users', async () => {
    const req = mkReq({ query: { q: 'test', type: 'users', location: 'Cairo' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Cairo' })
    );
  });

  it('allows tag filter with type=tracks', async () => {
    const req = mkReq({ query: { q: 'test', type: 'tracks', tag: 'indie' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'indie' })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// search — everything type
// ══════════════════════════════════════════════════════════════
describe('search — type=everything', () => {
  it('calls searchEverything and returns 200', async () => {
    const req = mkReq({ query: { q: 'test', type: 'everything' } });
    const res = mkRes();
    searchService.searchEverything.mockResolvedValue({
      data: [],
      pagination: {},
      filters: null,
    });

    await search(req, res);

    expect(searchService.searchEverything).toHaveBeenCalledWith({
      q: 'test',
      sort: 'relevance',
      currentUserId: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 when sort is not relevance or newest for type=everything', async () => {
    const req = mkReq({ query: { q: 'test', type: 'everything', sort: 'plays' } });
    const res = mkRes();

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'sort' })])
    );
    expect(searchService.searchEverything).not.toHaveBeenCalled();
  });

  it('passes currentUserId from req.user.sub when authenticated', async () => {
    const req = mkReq({ query: { q: 'jazz', type: 'everything' }, user: { sub: 'u7' } });
    const res = mkRes();
    searchService.searchEverything.mockResolvedValue({ data: [], pagination: {}, filters: null });

    await search(req, res);

    expect(searchService.searchEverything).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: 'u7' })
    );
  });

  it('returns 500 when searchEverything throws', async () => {
    const req = mkReq({ query: { q: 'test', type: 'everything' } });
    const res = mkRes();
    searchService.searchEverything.mockRejectedValue(new Error('fail'));

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ══════════════════════════════════════════════════════════════
// search — success path
// ══════════════════════════════════════════════════════════════
describe('search — success', () => {
  it('calls service with trimmed q, parsed limit/offset and returns 200', async () => {
    const req = mkReq({ query: { q: '  jazz  ', type: 'tracks', limit: '10', offset: '5' } });
    const res = mkRes();
    serviceOk({ data: [{ id: 't1' }], pagination: { total: 1 }, filters: {} });

    await search(req, res);

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'jazz', limit: 10, offset: 5 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: 't1' }],
      pagination: { total: 1 },
      filters: {},
    });
  });

  it('clamps limit to 100 and offset to 0 minimum', async () => {
    const req = mkReq({ query: { q: 'rock', limit: '9999', offset: '-5' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, offset: 0 })
    );
  });

  it('defaults sort to relevance when not provided', async () => {
    const req = mkReq({ query: { q: 'pop' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'relevance' })
    );
  });

  it('passes currentUserId from req.user.sub when authenticated', async () => {
    const req = mkReq({ query: { q: 'jazz' }, user: { sub: 'u42' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: 'u42' })
    );
  });

  it('passes currentUserId as null when not authenticated', async () => {
    const req = mkReq({ query: { q: 'jazz' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: null })
    );
  });

  it('passes undefined for optional filters when not provided', async () => {
    const req = mkReq({ query: { q: 'test', type: 'tracks' } });
    const res = mkRes();
    serviceOk();

    await search(req, res);

    const callArg = searchService.search.mock.calls[0][0];
    expect(callArg.time_range).toBeUndefined();
    expect(callArg.duration).toBeUndefined();
    expect(callArg.tag).toBeUndefined();
    expect(callArg.location).toBeUndefined();
  });

  it('returns 500 when service throws', async () => {
    const req = mkReq({ query: { q: 'test' } });
    const res = mkRes();
    searchService.search.mockRejectedValue(new Error('db error'));

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ══════════════════════════════════════════════════════════════
// suggestions — validation
// ══════════════════════════════════════════════════════════════
describe('suggestions — validation', () => {
  it('returns 400 when q is missing', async () => {
    const req = mkReq({ query: {} });
    const res = mkRes();

    await suggestions(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'q' })])
    );
    expect(searchService.getSuggestions).not.toHaveBeenCalled();
  });

  it('returns 400 when q is empty/whitespace', async () => {
    const req = mkReq({ query: { q: '  ' } });
    const res = mkRes();

    await suggestions(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(searchService.getSuggestions).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// suggestions — success path
// ══════════════════════════════════════════════════════════════
describe('suggestions — success', () => {
  it('calls service with trimmed q and default limit of 5', async () => {
    const req = mkReq({ query: { q: '  rock  ' } });
    const res = mkRes();
    searchService.getSuggestions.mockResolvedValue([{ label: 'rock music' }]);

    await suggestions(req, res);

    expect(searchService.getSuggestions).toHaveBeenCalledWith({
      q: 'rock',
      limit: 5,
      userId: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [{ label: 'rock music' }] });
  });

  it('clamps limit to 10', async () => {
    const req = mkReq({ query: { q: 'jazz', limit: '999' } });
    const res = mkRes();
    searchService.getSuggestions.mockResolvedValue([]);

    await suggestions(req, res);

    expect(searchService.getSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    );
  });

  it('clamps limit to 1 minimum', async () => {
    const req = mkReq({ query: { q: 'jazz', limit: '-5' } });
    const res = mkRes();
    searchService.getSuggestions.mockResolvedValue([]);

    await suggestions(req, res);

    expect(searchService.getSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    );
  });

  it('passes userId from req.user.sub when authenticated', async () => {
    const req = mkReq({ query: { q: 'pop' }, user: { sub: 'u55' } });
    const res = mkRes();
    searchService.getSuggestions.mockResolvedValue([]);

    await suggestions(req, res);

    expect(searchService.getSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u55' })
    );
  });

  it('returns 500 when service throws', async () => {
    const req = mkReq({ query: { q: 'test' } });
    const res = mkRes();
    searchService.getSuggestions.mockRejectedValue(new Error('fail'));

    await suggestions(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
