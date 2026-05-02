// ============================================================
// tests/search.service.unit.test.js
// ============================================================
const searchService = require('../../../src/services/search.service');
const searchModel = require('../../../src/models/search.model');

jest.mock('../../../src/models/search.model');

beforeEach(() => jest.clearAllMocks());

// ── Shared stubs ─────────────────────────────────────────────
const fakeTrackRow = {
  id: 't1',
  title: 'Track One',
  cover_image: null,
  artist_name: 'Artist One',
  user_id: 'u1',
  artist_username: 'artistone',
  genre_name: 'Electronic',
  duration: 200,
  play_count: 100,
  like_count: 20,
  repost_count: 5,
  stream_url: 'https://example.com/t1.mp3',
  created_at: new Date().toISOString(),
  score: 0.9123,
};

const fakeUserRow = {
  id: 'u1',
  display_name: 'Artist One',
  username: 'artistone',
  profile_picture: null,
  followers_count: 200,
  is_following: false,
  score: 0.87654,
};

const fakePlaylistRow = {
  id: 'pl1',
  name: 'Playlist One',
  cover_image: null,
  owner_id: 'u1',
  owner_display_name: 'Artist One',
  owner_username: 'artistone',
  track_count: 10,
  created_at: new Date().toISOString(),
  score: 0.75,
  preview_tracks: [],
};

const fakeAlbumRow = { ...fakePlaylistRow, id: 'al1', name: 'Album One' };

function setupAllMocks({
  tracks = { rows: [fakeTrackRow], total: 1 },
  users = { rows: [fakeUserRow], total: 1 },
  playlists = { rows: [fakePlaylistRow], total: 1 },
  albums = { rows: [fakeAlbumRow], total: 1 },
} = {}) {
  searchModel.searchTracks.mockResolvedValue(tracks);
  searchModel.searchUsers.mockResolvedValue(users);
  searchModel.searchPlaylists.mockResolvedValue(playlists);
  searchModel.searchAlbums.mockResolvedValue(albums);
  searchModel.getTrackSearchTags.mockResolvedValue([]);
  searchModel.getUserSearchLocations.mockResolvedValue([]);
  searchModel.getPlaylistSearchTags.mockResolvedValue([]);
}

// ══════════════════════════════════════════════════════════════
// search — no type filter (all types)
// ══════════════════════════════════════════════════════════════
describe('search — all types', () => {
  beforeEach(() => setupAllMocks());

  it('fans out to all four search model calls', async () => {
    await searchService.search({ q: 'test', limit: 10, offset: 0 });

    expect(searchModel.searchTracks).toHaveBeenCalled();
    expect(searchModel.searchUsers).toHaveBeenCalled();
    expect(searchModel.searchPlaylists).toHaveBeenCalled();
    expect(searchModel.searchAlbums).toHaveBeenCalled();
  });

  it('returns data for all four types', async () => {
    const result = await searchService.search({ q: 'test', limit: 10, offset: 0 });

    expect(result.data.tracks).toHaveLength(1);
    expect(result.data.users).toHaveLength(1);
    expect(result.data.playlists).toHaveLength(1);
    expect(result.data.albums).toHaveLength(1);
  });

  it('sets total as sum of all type totals when no type filter', async () => {
    // each mock returns total: 1 → sum = 4
    const result = await searchService.search({ q: 'test', limit: 10, offset: 0 });

    expect(result.pagination.total).toBe(4);
  });

  it('returns null filters when no type is specified', async () => {
    const result = await searchService.search({ q: 'test', limit: 10, offset: 0 });

    expect(result.filters).toBeNull();
  });

  it('passes pagination params through', async () => {
    await searchService.search({ q: 'test', limit: 5, offset: 10 });

    const result = await searchService.search({ q: 'test', limit: 5, offset: 10 });
    expect(result.pagination).toMatchObject({ limit: 5, offset: 10 });
  });
});

// ══════════════════════════════════════════════════════════════
// search — type=tracks
// ══════════════════════════════════════════════════════════════
describe('search — type=tracks', () => {
  beforeEach(() => {
    setupAllMocks({ tracks: { rows: [fakeTrackRow], total: 25 } });
    searchModel.getTrackSearchTags.mockResolvedValue([{ value: 'edm', count: 5 }]);
  });

  it('skips users, playlists, albums queries', async () => {
    await searchService.search({ q: 'test', type: 'tracks', limit: 10, offset: 0 });

    expect(searchModel.searchUsers).not.toHaveBeenCalled();
    expect(searchModel.searchPlaylists).not.toHaveBeenCalled();
    expect(searchModel.searchAlbums).not.toHaveBeenCalled();
  });

  it('returns only tracks data populated', async () => {
    const result = await searchService.search({ q: 'test', type: 'tracks', limit: 10, offset: 0 });

    expect(result.data.tracks).toHaveLength(1);
    expect(result.data.users).toHaveLength(0);
    expect(result.data.playlists).toHaveLength(0);
    expect(result.data.albums).toHaveLength(0);
  });

  it('uses track total for pagination', async () => {
    const result = await searchService.search({ q: 'test', type: 'tracks', limit: 10, offset: 0 });

    expect(result.pagination.total).toBe(25);
  });

  it('fetches track tags and returns filter block', async () => {
    const result = await searchService.search({ q: 'test', type: 'tracks', limit: 10, offset: 0 });

    expect(searchModel.getTrackSearchTags).toHaveBeenCalled();
    expect(result.filters.available.time_range).toBeDefined();
    expect(result.filters.available.duration).toBeDefined();
    expect(result.filters.available.tags).toEqual([{ value: 'edm', count: 5 }]);
  });

  it('echoes active filters back in response', async () => {
    const result = await searchService.search({
      q: 'test',
      type: 'tracks',
      limit: 10,
      offset: 0,
      time_range: 'past_week',
      duration: 'short',
      tag: 'edm',
    });

    expect(result.filters.active).toEqual({
      time_range: 'past_week',
      duration: 'short',
      tag: 'edm',
    });
  });

  it('formats score to 4 decimal places', async () => {
    const result = await searchService.search({ q: 'test', type: 'tracks', limit: 10, offset: 0 });

    const score = result.data.tracks[0].score;
    expect(score).toBe(parseFloat(score.toFixed(4)));
  });
});

// ══════════════════════════════════════════════════════════════
// search — type=users
// ══════════════════════════════════════════════════════════════
describe('search — type=users', () => {
  beforeEach(() => {
    setupAllMocks({ users: { rows: [fakeUserRow], total: 8 } });
    searchModel.getUserSearchLocations.mockResolvedValue([{ value: 'Cairo', count: 3 }]);
  });

  it('fetches user locations and returns filter block', async () => {
    const result = await searchService.search({ q: 'test', type: 'users', limit: 10, offset: 0 });

    expect(searchModel.getUserSearchLocations).toHaveBeenCalled();
    expect(result.filters.available.locations).toEqual([{ value: 'Cairo', count: 3 }]);
  });

  it('uses user total for pagination', async () => {
    const result = await searchService.search({ q: 'test', type: 'users', limit: 10, offset: 0 });

    expect(result.pagination.total).toBe(8);
  });

  it('skips tracks, playlists, albums queries', async () => {
    await searchService.search({ q: 'test', type: 'users', limit: 10, offset: 0 });

    expect(searchModel.searchTracks).not.toHaveBeenCalled();
    expect(searchModel.searchPlaylists).not.toHaveBeenCalled();
    expect(searchModel.searchAlbums).not.toHaveBeenCalled();
  });

  it('formats user result correctly', async () => {
    const result = await searchService.search({ q: 'test', type: 'users', limit: 10, offset: 0 });
    const user = result.data.users[0];

    expect(user).toMatchObject({
      id: 'u1',
      display_name: 'Artist One',
      username: 'artistone',
      follower_count: 200,
      is_following: false,
    });
  });
});

// ══════════════════════════════════════════════════════════════
// search — type=playlists
// ══════════════════════════════════════════════════════════════
describe('search — type=playlists', () => {
  beforeEach(() => {
    setupAllMocks({ playlists: { rows: [fakePlaylistRow], total: 3 } });
    searchModel.getPlaylistSearchTags.mockResolvedValue([{ value: 'chill', count: 2 }]);
  });

  it('returns playlist filter block with tags', async () => {
    const result = await searchService.search({
      q: 'test',
      type: 'playlists',
      limit: 10,
      offset: 0,
    });

    expect(result.filters.available.tags).toEqual([{ value: 'chill', count: 2 }]);
    expect(result.filters.active.tag).toBeNull();
  });

  it('formats playlist result with owner object', async () => {
    const result = await searchService.search({
      q: 'test',
      type: 'playlists',
      limit: 10,
      offset: 0,
    });
    const pl = result.data.playlists[0];

    expect(pl.owner).toMatchObject({ id: 'u1', display_name: 'Artist One' });
    expect(pl.title).toBe('Playlist One');
  });
});

// ══════════════════════════════════════════════════════════════
// search — type=albums
// ══════════════════════════════════════════════════════════════
describe('search — type=albums', () => {
  beforeEach(() => {
    setupAllMocks({ albums: { rows: [fakeAlbumRow], total: 2 } });
    searchModel.getPlaylistSearchTags.mockResolvedValue([{ value: 'jazz', count: 1 }]);
  });

  it('returns album filter block with tags', async () => {
    const result = await searchService.search({ q: 'test', type: 'albums', limit: 10, offset: 0 });

    expect(result.filters.available.tags).toEqual([{ value: 'jazz', count: 1 }]);
  });

  it('uses album total for pagination', async () => {
    const result = await searchService.search({ q: 'test', type: 'albums', limit: 10, offset: 0 });

    expect(result.pagination.total).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════
// getSuggestions
// ══════════════════════════════════════════════════════════════
describe('getSuggestions', () => {
  beforeEach(() => {
    searchModel.suggestUsers.mockResolvedValue([{ id: 'u1', display_name: 'Artist One' }]);
    searchModel.suggestTrackTitles.mockResolvedValue(['Track One', 'Track Two']);
    searchModel.suggestPlaylistNames.mockResolvedValue(['Playlist One', 'Playlist Two']);
  });

  it('returns users and interleaved suggestions', async () => {
    const result = await searchService.getSuggestions({ q: 'tra', limit: 5, userId: 'u2' });

    expect(result.users).toHaveLength(1);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('deduplicates overlapping track and playlist names', async () => {
    searchModel.suggestTrackTitles.mockResolvedValue(['Same Name', 'Track Two']);
    searchModel.suggestPlaylistNames.mockResolvedValue(['Same Name', 'Playlist Two']);

    const result = await searchService.getSuggestions({ q: 'same', limit: 10, userId: null });

    const count = result.suggestions.filter((s) => s.toLowerCase() === 'same name').length;
    expect(count).toBe(1);
  });

  it('respects the limit', async () => {
    searchModel.suggestTrackTitles.mockResolvedValue(['A', 'B', 'C', 'D', 'E']);
    searchModel.suggestPlaylistNames.mockResolvedValue(['F', 'G', 'H', 'I', 'J']);

    const result = await searchService.getSuggestions({ q: 'a', limit: 3, userId: null });

    expect(result.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('passes userId to suggestUsers', async () => {
    await searchService.getSuggestions({ q: 'test', limit: 5, userId: 'u99' });

    expect(searchModel.suggestUsers).toHaveBeenCalledWith('test', 5, 'u99');
  });
});

// ══════════════════════════════════════════════════════════════
// searchEverything
// ══════════════════════════════════════════════════════════════
describe('searchEverything', () => {
  beforeEach(() => {
    searchModel.searchTracks.mockResolvedValue({
      rows: [fakeTrackRow, fakeTrackRow, fakeTrackRow, fakeTrackRow, fakeTrackRow],
      total: 5,
    });
    searchModel.searchUsers.mockResolvedValue({
      rows: [fakeUserRow, fakeUserRow, fakeUserRow],
      total: 3,
    });
    searchModel.searchPlaylists.mockResolvedValue({
      rows: [fakePlaylistRow, fakePlaylistRow],
      total: 2,
    });
    searchModel.searchAlbums.mockResolvedValue({ rows: [fakeAlbumRow, fakeAlbumRow], total: 2 });
  });

  it('returns top_track as first track result', async () => {
    const result = await searchService.searchEverything({ q: 'test' });

    expect(result.data.top_track).toMatchObject({ id: 't1' });
  });

  it('returns top_user as first user result', async () => {
    const result = await searchService.searchEverything({ q: 'test' });

    expect(result.data.top_user).toMatchObject({ id: 'u1' });
  });

  it('excludes top_track from tracks array (starts at index 1)', async () => {
    const result = await searchService.searchEverything({ q: 'test' });

    // 5 rows returned; top_track takes index 0, tracks gets indices 1–4 (max 4)
    expect(result.data.tracks.length).toBeLessThanOrEqual(4);
  });

  it('returns top_track=null and top_user=null when no results', async () => {
    searchModel.searchTracks.mockResolvedValue({ rows: [], total: 0 });
    searchModel.searchUsers.mockResolvedValue({ rows: [], total: 0 });
    searchModel.searchPlaylists.mockResolvedValue({ rows: [], total: 0 });
    searchModel.searchAlbums.mockResolvedValue({ rows: [], total: 0 });

    const result = await searchService.searchEverything({ q: 'nothing' });

    expect(result.data.top_track).toBeNull();
    expect(result.data.top_user).toBeNull();
    expect(result.data.tracks).toHaveLength(0);
    expect(result.data.users).toHaveLength(0);
  });

  it('returns null pagination and filters', async () => {
    const result = await searchService.searchEverything({ q: 'test' });

    expect(result.pagination).toBeNull();
    expect(result.filters).toBeNull();
  });

  it('caps playlists and albums at 2 each', async () => {
    const result = await searchService.searchEverything({ q: 'test' });

    expect(result.data.playlists.length).toBeLessThanOrEqual(2);
    expect(result.data.albums.length).toBeLessThanOrEqual(2);
  });
});
