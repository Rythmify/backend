// ============================================================
// tests/genres.controller.unit.test.js
// ============================================================
const controller = require('../src/controllers/genres.controller');
const genresService = require('../src/services/genres.service');
const api = require('../src/utils/api-response');

jest.mock('../src/services/genres.service');
jest.mock('../src/utils/api-response', () => ({
  success: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────

const mkRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const mkReq = ({ params = {}, query = {}, user = null } = {}) => ({
  params,
  query,
  user,
});

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════
// getAllGenres
// ══════════════════════════════════════════════════════════════
describe('getAllGenres', () => {
  it('calls service with default pagination when no query params', async () => {
    const req = mkReq({ query: {} });
    const res = mkRes();
    genresService.getAllGenres.mockResolvedValue({ data: [], pagination: {} });

    await controller.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(api.success).toHaveBeenCalledWith(res, [], 'Genres fetched successfully', 200, {});
  });

  it('parses valid limit and offset from query', async () => {
    const req = mkReq({ query: { limit: '10', offset: '5' } });
    const res = mkRes();
    genresService.getAllGenres.mockResolvedValue({ data: [{ id: 1 }], pagination: { total: 1 } });

    await controller.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalledWith({ limit: 10, offset: 5 });
  });

  it('clamps limit to a maximum of 100', async () => {
    const req = mkReq({ query: { limit: '9999' } });
    const res = mkRes();
    genresService.getAllGenres.mockResolvedValue({ data: [], pagination: {} });

    await controller.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('clamps limit to a minimum of 1', async () => {
    const req = mkReq({ query: { limit: '-5' } });
    const res = mkRes();
    genresService.getAllGenres.mockResolvedValue({ data: [], pagination: {} });

    await controller.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('clamps offset to 0 when negative', async () => {
    const req = mkReq({ query: { offset: '-10' } });
    const res = mkRes();
    genresService.getAllGenres.mockResolvedValue({ data: [], pagination: {} });

    await controller.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('falls back to defaults for non-numeric query params', async () => {
    const req = mkReq({ query: { limit: 'abc', offset: 'xyz' } });
    const res = mkRes();
    genresService.getAllGenres.mockResolvedValue({ data: [], pagination: {} });

    await controller.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it('bubbles service errors', async () => {
    const req = mkReq({ query: {} });
    const res = mkRes();
    genresService.getAllGenres.mockRejectedValue(new Error('db fail'));

    await expect(controller.getAllGenres(req, res)).rejects.toThrow('db fail');
  });
});

// ══════════════════════════════════════════════════════════════
// getGenrePage
// ══════════════════════════════════════════════════════════════
describe('getGenrePage', () => {
  it('calls service with default limits and no user', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenrePage.mockResolvedValue({ genre: { id: 'g1' } });

    await controller.getGenrePage(req, res);

    expect(genresService.getGenrePage).toHaveBeenCalledWith({
      genreId: 'g1',
      tracksLimit: 12,
      artistsLimit: 12,
      playlistsLimit: 4,
      albumsLimit: 4,
      currentUserId: null,
    });
  });

  it('passes currentUserId from req.user when authenticated', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {}, user: { id: 'u99' } });
    const res = mkRes();
    genresService.getGenrePage.mockResolvedValue({});

    await controller.getGenrePage(req, res);

    expect(genresService.getGenrePage).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: 'u99' })
    );
  });

  it('clamps tracksLimit to 50', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { tracks_limit: '200' } });
    const res = mkRes();
    genresService.getGenrePage.mockResolvedValue({});

    await controller.getGenrePage(req, res);

    expect(genresService.getGenrePage).toHaveBeenCalledWith(
      expect.objectContaining({ tracksLimit: 50 })
    );
  });

  it('clamps artistsLimit to 20', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { artists_limit: '999' } });
    const res = mkRes();
    genresService.getGenrePage.mockResolvedValue({});

    await controller.getGenrePage(req, res);

    expect(genresService.getGenrePage).toHaveBeenCalledWith(
      expect.objectContaining({ artistsLimit: 20 })
    );
  });

  it('returns success with the data from service', async () => {
    const pageData = { genre: { id: 'g1', name: 'Rock' }, tracks: [] };
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenrePage.mockResolvedValue(pageData);

    await controller.getGenrePage(req, res);

    expect(api.success).toHaveBeenCalledWith(res, pageData, 'Genre page data fetched successfully.');
  });

  it('bubbles service errors', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenrePage.mockRejectedValue(new Error('not found'));

    await expect(controller.getGenrePage(req, res)).rejects.toThrow('not found');
  });
});

// ══════════════════════════════════════════════════════════════
// getGenreTracks
// ══════════════════════════════════════════════════════════════
describe('getGenreTracks', () => {
  it('calls service with defaults and returns success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreTracks.mockResolvedValue({ tracks: [], pagination: { total: 0 } });

    await controller.getGenreTracks(req, res);

    expect(genresService.getGenreTracks).toHaveBeenCalledWith({
      genreId: 'g1',
      limit: 20,
      offset: 0,
      sort: 'newest',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { tracks: [] },
      'Tracks fetched successfully.',
      200,
      { total: 0 }
    );
  });

  it('accepts sort=popular', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { sort: 'popular' } });
    const res = mkRes();
    genresService.getGenreTracks.mockResolvedValue({ tracks: [], pagination: {} });

    await controller.getGenreTracks(req, res);

    expect(genresService.getGenreTracks).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'popular' })
    );
  });

  it('falls back to newest for invalid sort value', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { sort: 'invalid' } });
    const res = mkRes();
    genresService.getGenreTracks.mockResolvedValue({ tracks: [], pagination: {} });

    await controller.getGenreTracks(req, res);

    expect(genresService.getGenreTracks).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'newest' })
    );
  });

  it('clamps limit to 50', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { limit: '500' } });
    const res = mkRes();
    genresService.getGenreTracks.mockResolvedValue({ tracks: [], pagination: {} });

    await controller.getGenreTracks(req, res);

    expect(genresService.getGenreTracks).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  it('clamps offset to 0 when negative', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { offset: '-100' } });
    const res = mkRes();
    genresService.getGenreTracks.mockResolvedValue({ tracks: [], pagination: {} });

    await controller.getGenreTracks(req, res);

    expect(genresService.getGenreTracks).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0 })
    );
  });

  it('strips pagination key from the data passed to success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreTracks.mockResolvedValue({
      tracks: [{ id: 't1' }],
      pagination: { total: 1 },
    });

    await controller.getGenreTracks(req, res);

    const dataArg = api.success.mock.calls[0][1];
    expect(dataArg).not.toHaveProperty('pagination');
    expect(dataArg).toHaveProperty('tracks');
  });
});

// ══════════════════════════════════════════════════════════════
// getGenreAlbums
// ══════════════════════════════════════════════════════════════
describe('getGenreAlbums', () => {
  it('calls service with defaults and returns success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreAlbums.mockResolvedValue({ albums: [], pagination: { total: 0 } });

    await controller.getGenreAlbums(req, res);

    expect(genresService.getGenreAlbums).toHaveBeenCalledWith({
      genreId: 'g1',
      limit: 12,
      offset: 0,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { albums: [] },
      'Albums fetched successfully.',
      200,
      { total: 0 }
    );
  });

  it('clamps limit to 20', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { limit: '999' } });
    const res = mkRes();
    genresService.getGenreAlbums.mockResolvedValue({ albums: [], pagination: {} });

    await controller.getGenreAlbums(req, res);

    expect(genresService.getGenreAlbums).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  it('strips pagination key from data passed to success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreAlbums.mockResolvedValue({ albums: [], pagination: {} });

    await controller.getGenreAlbums(req, res);

    expect(api.success.mock.calls[0][1]).not.toHaveProperty('pagination');
  });
});

// ══════════════════════════════════════════════════════════════
// getGenrePlaylists
// ══════════════════════════════════════════════════════════════
describe('getGenrePlaylists', () => {
  it('calls service with defaults and returns success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenrePlaylists.mockResolvedValue({ playlists: [], pagination: {} });

    await controller.getGenrePlaylists(req, res);

    expect(genresService.getGenrePlaylists).toHaveBeenCalledWith({
      genreId: 'g1',
      limit: 12,
      offset: 0,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { playlists: [] },
      'Playlists fetched successfully.',
      200,
      {}
    );
  });

  it('clamps limit to 20', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { limit: '500' } });
    const res = mkRes();
    genresService.getGenrePlaylists.mockResolvedValue({ playlists: [], pagination: {} });

    await controller.getGenrePlaylists(req, res);

    expect(genresService.getGenrePlaylists).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  it('strips pagination key from data passed to success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenrePlaylists.mockResolvedValue({ playlists: [], pagination: {} });

    await controller.getGenrePlaylists(req, res);

    expect(api.success.mock.calls[0][1]).not.toHaveProperty('pagination');
  });
});

// ══════════════════════════════════════════════════════════════
// getGenreArtists
// ══════════════════════════════════════════════════════════════
describe('getGenreArtists', () => {
  it('calls service with defaults and no user', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreArtists.mockResolvedValue({ artists: [], pagination: {} });

    await controller.getGenreArtists(req, res);

    expect(genresService.getGenreArtists).toHaveBeenCalledWith({
      genreId: 'g1',
      limit: 10,
      offset: 0,
      currentUserId: null,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { artists: [] },
      'Artists fetched successfully.',
      200,
      {}
    );
  });

  it('passes currentUserId when authenticated', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {}, user: { id: 'u42' } });
    const res = mkRes();
    genresService.getGenreArtists.mockResolvedValue({ artists: [], pagination: {} });

    await controller.getGenreArtists(req, res);

    expect(genresService.getGenreArtists).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: 'u42' })
    );
  });

  it('clamps limit to 20', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: { limit: '999' } });
    const res = mkRes();
    genresService.getGenreArtists.mockResolvedValue({ artists: [], pagination: {} });

    await controller.getGenreArtists(req, res);

    expect(genresService.getGenreArtists).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  it('strips pagination key from data passed to success', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreArtists.mockResolvedValue({ artists: [], pagination: {} });

    await controller.getGenreArtists(req, res);

    expect(api.success.mock.calls[0][1]).not.toHaveProperty('pagination');
  });

  it('bubbles service errors', async () => {
    const req = mkReq({ params: { genre_id: 'g1' }, query: {} });
    const res = mkRes();
    genresService.getGenreArtists.mockRejectedValue(new Error('service error'));

    await expect(controller.getGenreArtists(req, res)).rejects.toThrow('service error');
  });
});