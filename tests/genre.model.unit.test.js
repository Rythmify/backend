// ============================================================
// tests/genre.model.unit.test.js
// Covers: genre.model.js + genrediscovery.model.js
// ============================================================
const genreModel = require('../src/models/genre.model');
const discoveryModel = require('../src/models/genrediscovery.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

// ── Shared stubs ─────────────────────────────────────────────
const fakeGenre = {
  id: 'g1',
  name: 'Jazz',
  cover_image: null,
  track_count: '10',
  artist_count: '5',
};

const fakeTrack = {
  id: 't1',
  title: 'Blue Note',
  cover_image: '/img/t1.jpg',
  duration: 180,
  play_count: 100,
  like_count: 20,
  user_id: 'u1',
  stream_url: 'https://stream/t1',
  created_at: new Date().toISOString(),
  genre_name: 'Jazz',
  artist_name: 'Miles Davis',
};

const fakeArtist = {
  id: 'u1',
  display_name: 'Miles Davis',
  username: 'miles',
  profile_picture: null,
  is_verified: false,
  followers_count: '500',
  track_count_in_genre: '8',
  is_following: false,
};

const fakePlaylist = {
  id: 'p1',
  name: 'Jazz Vibes',
  cover_image: null,
  owner_id: 'u1',
  owner_name: 'Miles Davis',
  track_count: '10',
  like_count: '5',
  created_at: new Date().toISOString(),
  source: 'inferred',
};

const fakeAlbum = {
  id: 'a1',
  name: 'Kind of Blue',
  cover_image: null,
  owner_id: 'u1',
  owner_name: 'Miles Davis',
  track_count: '9',
  like_count: '100',
  release_date: '1959-08-17',
  created_at: new Date().toISOString(),
};

// ══════════════════════════════════════════════════════════════
// genre.model — getAllGenres
// ══════════════════════════════════════════════════════════════
describe('genre.model — getAllGenres', () => {
  it('returns all genre rows ordered by name', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeGenre] });

    const result = await genreModel.getAllGenres();

    expect(result).toEqual([fakeGenre]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY name ASC'));
  });

  it('returns empty array when no genres exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await genreModel.getAllGenres();

    expect(result).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════
// genre.model — findGenreDetail
// ══════════════════════════════════════════════════════════════
describe('genre.model — findGenreDetail', () => {
  it('returns genre detail row when found', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeGenre] });

    const result = await genreModel.findGenreDetail('g1');

    expect(result).toEqual(fakeGenre);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['g1']);
  });

  it('returns null when genre not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await genreModel.findGenreDetail('ghost');

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// genrediscovery.model — findGenreTracks
// ══════════════════════════════════════════════════════════════
describe('genrediscovery.model — findGenreTracks', () => {
  it('returns tracks and total count', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakeTrack] }) // tracks query
      .mockResolvedValueOnce({ rows: [{ total: '42' }] }); // count query

    const result = await discoveryModel.findGenreTracks({
      genreId: 'g1',
      limit: 12,
      offset: 0,
      sort: 'newest',
    });

    expect(result.tracks).toEqual([fakeTrack]);
    expect(result.total).toBe(42);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('uses play_count order for sort=popular', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] });

    await discoveryModel.findGenreTracks({
      genreId: 'g1',
      limit: 12,
      offset: 0,
      sort: 'popular',
    });

    const firstCall = db.query.mock.calls[0][0];
    expect(firstCall).toContain('play_count DESC');
  });

  it('uses created_at order for sort=newest', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] });

    await discoveryModel.findGenreTracks({
      genreId: 'g1',
      limit: 12,
      offset: 0,
      sort: 'newest',
    });

    const firstCall = db.query.mock.calls[0][0];
    expect(firstCall).toContain('created_at DESC');
  });

  it('returns total 0 when count row is missing', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{}] });

    const result = await discoveryModel.findGenreTracks({
      genreId: 'g1',
      limit: 12,
      offset: 0,
      sort: 'newest',
    });

    expect(result.total).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// genrediscovery.model — findGenreAlbums
// ══════════════════════════════════════════════════════════════
describe('genrediscovery.model — findGenreAlbums', () => {
  it('returns albums and total', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakeAlbum] })
      .mockResolvedValueOnce({ rows: [{ total: '3' }] });

    const result = await discoveryModel.findGenreAlbums({ genreId: 'g1', limit: 12, offset: 0 });

    expect(result.albums).toEqual([fakeAlbum]);
    expect(result.total).toBe(3);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['g1', 12, 0]);
  });

  it('returns empty albums and 0 total when none found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await discoveryModel.findGenreAlbums({ genreId: 'g1', limit: 12, offset: 0 });

    expect(result.albums).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// genrediscovery.model — findGenrePlaylists
// ══════════════════════════════════════════════════════════════
describe('genrediscovery.model — findGenrePlaylists', () => {
  it('returns playlists and total', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakePlaylist] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const result = await discoveryModel.findGenrePlaylists({ genreId: 'g1', limit: 4, offset: 0 });

    expect(result.playlists).toEqual([fakePlaylist]);
    expect(result.total).toBe(1);
  });

  it('returns empty when no playlists match', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await discoveryModel.findGenrePlaylists({ genreId: 'g1', limit: 4, offset: 0 });

    expect(result.playlists).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// genrediscovery.model — findGenreArtists
// ══════════════════════════════════════════════════════════════
describe('genrediscovery.model — findGenreArtists', () => {
  it('returns artists and total', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakeArtist] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const result = await discoveryModel.findGenreArtists({
      genreId: 'g1',
      limit: 12,
      offset: 0,
      currentUserId: null,
    });

    expect(result.artists).toEqual([fakeArtist]);
    expect(result.total).toBe(1);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['g1', 12, 0, null]);
  });

  it('passes currentUserId as $4 for follow status', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] });

    await discoveryModel.findGenreArtists({
      genreId: 'g1',
      limit: 12,
      offset: 0,
      currentUserId: 'u1',
    });

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['g1', 12, 0, 'u1']);
  });
});

// ══════════════════════════════════════════════════════════════
// genrediscovery.model — getPlaylistPreviewTracks
// ══════════════════════════════════════════════════════════════
describe('genrediscovery.model — getPlaylistPreviewTracks', () => {
  it('returns preview tracks for a playlist', async () => {
    const fakePreview = { track_id: 't1', title: 'Blue Note', cover_image: null };
    db.query.mockResolvedValueOnce({ rows: [fakePreview] });

    const result = await discoveryModel.getPlaylistPreviewTracks('p1', 2);

    expect(result).toEqual([fakePreview]);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['p1', 2]);
  });

  it('returns empty array when playlist has no tracks', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await discoveryModel.getPlaylistPreviewTracks('p1', 2);

    expect(result).toEqual([]);
  });

  it('defaults limit to 2', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await discoveryModel.getPlaylistPreviewTracks('p1');

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['p1', 2]);
  });
});
