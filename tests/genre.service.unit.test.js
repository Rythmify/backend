// ============================================================
// tests/genres.service.unit.test.js
// ============================================================
const genreService = require('../src/services/genres.service');
const genreModel = require('../src/models/genre.model');
const discoveryModel = require('../src/models/genrediscovery.model');

jest.mock('../src/models/genre.model');
jest.mock('../src/models/genrediscovery.model');

beforeEach(() => jest.clearAllMocks());

// ── Shared stubs ─────────────────────────────────────────────
const fakeGenre = {
  id: 'g1',
  name: 'Electronic',
  cover_image: null,
  track_count: '42',
  artist_count: '10',
};

const fakeTrack = {
  id: 't1',
  title: 'Track One',
  cover_image: null,
  duration: 180,
  genre_name: 'Electronic',
  play_count: '100',
  like_count: '20',
  user_id: 'u1',
  artist_name: 'Artist One',
  stream_url: 'https://example.com/t1.mp3',
  created_at: new Date().toISOString(),
};

const fakeAlbum = {
  id: 'al1',
  name: 'Album One',
  cover_image: null,
  owner_id: 'u1',
  owner_name: 'Artist One',
  track_count: '8',
  like_count: '5',
  release_date: '2024-01-01',
  created_at: new Date().toISOString(),
};

const fakePlaylist = {
  id: 'pl1',
  name: 'Playlist One',
  cover_image: null,
  owner_id: 'u1',
  owner_name: 'Artist One',
  track_count: '12',
  like_count: '3',
  source: 'user',
  created_at: new Date().toISOString(),
};

const fakeArtist = {
  id: 'u1',
  display_name: 'Artist One',
  username: 'artistone',
  profile_picture: null,
  is_verified: false,
  followers_count: '50',
  track_count_in_genre: '5',
  is_following: false,
};

const fakePreviewTrack = {
  track_id: 't1',
  title: 'Track One',
  cover_image: null,
  duration: 180,
  stream_url: 'https://example.com/t1.mp3',
  artist_name: 'Artist One',
  user_id: 'u1',
};

// ══════════════════════════════════════════════════════════════
// getAllGenres
// ══════════════════════════════════════════════════════════════
describe('getAllGenres', () => {
  it('returns paginated genres slice', async () => {
    genreModel.getAllGenres.mockResolvedValue([fakeGenre, fakeGenre, fakeGenre]);

    const result = await genreService.getAllGenres({ limit: 2, offset: 0 });

    expect(genreModel.getAllGenres).toHaveBeenCalled();
    expect(result.data).toHaveLength(2);
    expect(result.pagination).toEqual({ limit: 2, offset: 0, total: 3 });
  });

  it('returns correct slice when offset is set', async () => {
    genreModel.getAllGenres.mockResolvedValue([fakeGenre, fakeGenre, fakeGenre]);

    const result = await genreService.getAllGenres({ limit: 2, offset: 2 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.offset).toBe(2);
  });

  it('returns empty data when offset exceeds total', async () => {
    genreModel.getAllGenres.mockResolvedValue([fakeGenre]);

    const result = await genreService.getAllGenres({ limit: 10, offset: 99 });

    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════
// getGenrePage
// ══════════════════════════════════════════════════════════════
describe('getGenrePage', () => {
  beforeEach(() => {
    genreModel.findGenreDetail.mockResolvedValue(fakeGenre);
    discoveryModel.findGenreTracks.mockResolvedValue({ tracks: [fakeTrack], total: 1 });
    discoveryModel.findGenreAlbums.mockResolvedValue({ albums: [fakeAlbum], total: 1 });
    discoveryModel.findGenrePlaylists.mockResolvedValue({
      playlists: [fakePlaylist, fakePlaylist],
      total: 2,
    });
    discoveryModel.findGenreArtists.mockResolvedValue({ artists: [fakeArtist], total: 1 });
    discoveryModel.getPlaylistPreviewTracks.mockResolvedValue([fakePreviewTrack]);
  });

  it('throws 404 when genre not found', async () => {
    genreModel.findGenreDetail.mockResolvedValue(null);

    await expect(genreService.getGenrePage({ genreId: 'ghost' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('returns genre page with formatted sections', async () => {
    const result = await genreService.getGenrePage({ genreId: 'g1' });

    expect(result.genre).toMatchObject({ id: 'g1', name: 'Electronic' });
    expect(result.tracks).toHaveLength(1);
    expect(result.albums).toHaveLength(1);
    expect(result.artists).toHaveLength(1);
  });

  it('sets introducing from first playlist with preview tracks', async () => {
    const result = await genreService.getGenrePage({ genreId: 'g1' });

    expect(result.introducing).not.toBeNull();
    expect(result.introducing.id).toBe(fakePlaylist.id);
    expect(result.introducing.tracks_preview).toHaveLength(1);
    expect(result.introducing.tracks_preview[0]).toMatchObject({ id: fakePreviewTrack.track_id });
  });

  it('places rest of playlists (not the first) in playlists array', async () => {
    const result = await genreService.getGenrePage({ genreId: 'g1' });

    // discoveryModel returned 2 playlists; first → introducing, second → playlists
    expect(result.playlists).toHaveLength(1);
  });

  it('sets introducing to null when no playlists returned', async () => {
    discoveryModel.findGenrePlaylists.mockResolvedValue({ playlists: [], total: 0 });

    const result = await genreService.getGenrePage({ genreId: 'g1' });

    expect(result.introducing).toBeNull();
    expect(result.playlists).toHaveLength(0);
  });

  it('runs sub-queries in parallel (all discovery calls made)', async () => {
    await genreService.getGenrePage({ genreId: 'g1' });

    expect(discoveryModel.findGenreTracks).toHaveBeenCalled();
    expect(discoveryModel.findGenreAlbums).toHaveBeenCalled();
    expect(discoveryModel.findGenrePlaylists).toHaveBeenCalled();
    expect(discoveryModel.findGenreArtists).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// getGenreTracks
// ══════════════════════════════════════════════════════════════
describe('getGenreTracks', () => {
  beforeEach(() => {
    genreModel.findGenreDetail.mockResolvedValue(fakeGenre);
    discoveryModel.findGenreTracks.mockResolvedValue({ tracks: [fakeTrack], total: 25 });
  });

  it('throws 404 when genre not found', async () => {
    genreModel.findGenreDetail.mockResolvedValue(null);

    await expect(genreService.getGenreTracks({ genreId: 'ghost' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('returns formatted tracks and correct pagination', async () => {
    const result = await genreService.getGenreTracks({ genreId: 'g1', limit: 10, offset: 0 });

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({ id: 't1', title: 'Track One' });
    expect(result.pagination).toMatchObject({
      page: 1,
      per_page: 10,
      total_items: 25,
      total_pages: 3,
      has_next: true,
      has_prev: false,
    });
  });

  it('calculates has_prev correctly on page 2', async () => {
    const result = await genreService.getGenreTracks({ genreId: 'g1', limit: 10, offset: 10 });

    expect(result.pagination.has_prev).toBe(true);
    expect(result.pagination.page).toBe(2);
  });

  it('calculates has_next=false on last page', async () => {
    discoveryModel.findGenreTracks.mockResolvedValue({ tracks: [fakeTrack], total: 5 });

    const result = await genreService.getGenreTracks({ genreId: 'g1', limit: 10, offset: 0 });

    expect(result.pagination.has_next).toBe(false);
  });

  it('passes sort param to the model', async () => {
    await genreService.getGenreTracks({ genreId: 'g1', limit: 10, offset: 0, sort: 'popular' });

    expect(discoveryModel.findGenreTracks).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'popular' })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// getGenreAlbums
// ══════════════════════════════════════════════════════════════
describe('getGenreAlbums', () => {
  beforeEach(() => {
    genreModel.findGenreDetail.mockResolvedValue(fakeGenre);
    discoveryModel.findGenreAlbums.mockResolvedValue({ albums: [fakeAlbum], total: 1 });
  });

  it('throws 404 when genre not found', async () => {
    genreModel.findGenreDetail.mockResolvedValue(null);

    await expect(genreService.getGenreAlbums({ genreId: 'ghost' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('returns formatted albums and pagination', async () => {
    const result = await genreService.getGenreAlbums({ genreId: 'g1', limit: 12, offset: 0 });

    expect(result.albums).toHaveLength(1);
    expect(result.albums[0]).toMatchObject({ id: 'al1', name: 'Album One' });
    expect(result.pagination).toMatchObject({
      page: 1,
      per_page: 12,
      total_items: 1,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    });
  });
});

// ══════════════════════════════════════════════════════════════
// getGenrePlaylists
// ══════════════════════════════════════════════════════════════
describe('getGenrePlaylists', () => {
  beforeEach(() => {
    genreModel.findGenreDetail.mockResolvedValue(fakeGenre);
    discoveryModel.findGenrePlaylists.mockResolvedValue({ playlists: [fakePlaylist], total: 1 });
  });

  it('throws 404 when genre not found', async () => {
    genreModel.findGenreDetail.mockResolvedValue(null);

    await expect(genreService.getGenrePlaylists({ genreId: 'ghost' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('returns formatted playlists and pagination', async () => {
    const result = await genreService.getGenrePlaylists({ genreId: 'g1', limit: 12, offset: 0 });

    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0]).toMatchObject({ id: 'pl1', name: 'Playlist One' });
    expect(result.pagination).toMatchObject({ page: 1, total_items: 1 });
  });
});

// ══════════════════════════════════════════════════════════════
// getGenreArtists
// ══════════════════════════════════════════════════════════════
describe('getGenreArtists', () => {
  beforeEach(() => {
    genreModel.findGenreDetail.mockResolvedValue(fakeGenre);
    discoveryModel.findGenreArtists.mockResolvedValue({ artists: [fakeArtist], total: 1 });
  });

  it('throws 404 when genre not found', async () => {
    genreModel.findGenreDetail.mockResolvedValue(null);

    await expect(genreService.getGenreArtists({ genreId: 'ghost' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('returns formatted artists and pagination', async () => {
    const result = await genreService.getGenreArtists({ genreId: 'g1', limit: 10, offset: 0 });

    expect(result.artists).toHaveLength(1);
    expect(result.artists[0]).toMatchObject({
      id: 'u1',
      display_name: 'Artist One',
      follower_count: 50,
      track_count_in_genre: 5,
    });
    expect(result.pagination).toMatchObject({ page: 1, total_items: 1 });
  });

  it('passes currentUserId to the model', async () => {
    await genreService.getGenreArtists({
      genreId: 'g1',
      limit: 10,
      offset: 0,
      currentUserId: 'u2',
    });

    expect(discoveryModel.findGenreArtists).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: 'u2' })
    );
  });
});
