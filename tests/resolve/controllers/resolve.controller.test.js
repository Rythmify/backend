// ============================================================
// tests/resolve.controller.unit.test.js
// ============================================================
const { resolve } = require('../../../src/controllers/resolve.controller');
const resolveService = require('../../../src/services/resolve.service');

jest.mock('../../../src/services/resolve.service');

// ── Helpers ──────────────────────────────────────────────────

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const mkReq = ({ query = {} } = {}) => ({ query });

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════
// resolve — input validation
// ══════════════════════════════════════════════════════════════
describe('resolve — validation', () => {
  it('returns 400 when url query param is missing', async () => {
    const req = mkReq({ query: {} });
    const res = mkRes();

    await resolve(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      })
    );
    expect(resolveService.resolve).not.toHaveBeenCalled();
  });

  it('returns 400 when url is an empty string', async () => {
    const req = mkReq({ query: { url: '   ' } });
    const res = mkRes();

    await resolve(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      })
    );
    expect(resolveService.resolve).not.toHaveBeenCalled();
  });

  it('includes field detail pointing to url param', async () => {
    const req = mkReq({ query: {} });
    const res = mkRes();

    await resolve(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'url' })])
    );
  });

  it('returns 400 when url is not a valid URL', async () => {
    const req = mkReq({ query: { url: 'not-a-url' } });
    const res = mkRes();

    await resolve(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      })
    );
    expect(resolveService.resolve).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// resolve — success path
// ══════════════════════════════════════════════════════════════
describe('resolve — success', () => {
  it('calls service with parsed pathname and returns 200', async () => {
    const req = mkReq({ query: { url: 'https://example.com/tracks/abc123' } });
    const res = mkRes();
    resolveService.resolve.mockResolvedValue({ type: 'track', id: 'abc123' });

    await resolve(req, res);

    expect(resolveService.resolve).toHaveBeenCalledWith('/tracks/abc123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        type: 'track',
        id: 'abc123',
        permalink: 'https://example.com/tracks/abc123',
      },
    });
  });

  it('trims whitespace from the url before resolving', async () => {
    const req = mkReq({ query: { url: '  https://example.com/artists/xyz  ' } });
    const res = mkRes();
    resolveService.resolve.mockResolvedValue({ type: 'artist', id: 'xyz' });

    await resolve(req, res);

    expect(resolveService.resolve).toHaveBeenCalledWith('/artists/xyz');
    const body = res.json.mock.calls[0][0];
    expect(body.data.permalink).toBe('https://example.com/artists/xyz');
  });

  it('echoes the original (trimmed) permalink in the response', async () => {
    const url = 'https://example.com/playlists/p1';
    const req = mkReq({ query: { url } });
    const res = mkRes();
    resolveService.resolve.mockResolvedValue({ type: 'playlist', id: 'p1' });

    await resolve(req, res);

    expect(res.json.mock.calls[0][0].data.permalink).toBe(url);
  });
});

// ══════════════════════════════════════════════════════════════
// resolve — not found
// ══════════════════════════════════════════════════════════════
describe('resolve — not found', () => {
  it('returns 404 when service returns null', async () => {
    const req = mkReq({ query: { url: 'https://example.com/unknown/path' } });
    const res = mkRes();
    resolveService.resolve.mockResolvedValue(null);

    await resolve(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// resolve — server errors
// ══════════════════════════════════════════════════════════════
describe('resolve — server errors', () => {
  it('returns 500 when service throws', async () => {
    const req = mkReq({ query: { url: 'https://example.com/tracks/t1' } });
    const res = mkRes();
    resolveService.resolve.mockRejectedValue(new Error('db fail'));

    await resolve(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }),
      })
    );
  });
});
