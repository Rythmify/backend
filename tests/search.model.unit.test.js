// ============================================================
// tests/search.model.unit.test.js
// ============================================================
const model = require('../src/models/search.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

// ── Shared stubs ─────────────────────────────────────────────
const fakeTrackRow = {
  id: 't1', title: 'Blue Note', cover_image: '/img/t1.jpg',
  user_id: 'u1', artist_name: 'Miles Davis', artist_username: 'miles',
  genre_name: 'Jazz', duration: 180, play_count: 100, like_count: 20,
  repost_count: 5, stream_url: 'https://stream/t1',
  created_at: new Date().toISOString(), score: 0.9, total_count: '1',
};

const fakeUserRow = {
  id: 'u1', display_name: 'Miles Davis', username: 'miles',
  profile_picture: null, followers_count: 500,
  city: 'Cairo', country: 'EG', created_at: new Date().toISOString(),
  score: 0.8, total_count: '1',
};

const fakePlaylistRow = {
  id: 'p1', name: 'Jazz Vibes', cover_image: null,
  owner_id: 'u1', owner_display_name: 'Miles Davis', owner_username: 'miles',
  track_count: 10, created_at: new Date().toISOString(),
  score: 0.7, total_count: '1',
};

// ══════════════════════════════════════════════════════════════
// searchTracks
// ══════════════════════════════════════════════════════════════
describe('searchTracks', () => {
  it('returns rows and total', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeTrackRow] });

    const result = await model.searchTracks({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(result.rows).toEqual([fakeTrackRow]);
    expect(result.total).toBe(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WITH ranked'),
      expect.arrayContaining(['jazz', 0.2, 20, 0])
    );
  });

  it('returns total 0 when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.searchTracks({
      q: 'nothing', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('uses play_count order for sort=plays', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchTracks({
      q: 'jazz', sort: 'plays', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('play_count DESC'),
      expect.any(Array)
    );
  });

  it('uses created_at order for sort=newest', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchTracks({
      q: 'jazz', sort: 'newest', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('created_at DESC'),
      expect.any(Array)
    );
  });

  it('appends tag as $5 when tag is provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchTracks({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2, tag: 'blues',
    });

    const params = db.query.mock.calls[0][1];
    expect(params).toHaveLength(5);
    expect(params[4]).toBe('blues');
  });

  it('does not append tag param when tag is not provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchTracks({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    const params = db.query.mock.calls[0][1];
    expect(params).toHaveLength(4);
  });

  it('injects time_range clause into query when provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchTracks({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
      time_range: 'past_week',
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INTERVAL '1 week'"),
      expect.any(Array)
    );
  });

  it('injects duration clause into query when provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchTracks({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
      duration: 'short',
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('t.duration < 120'),
      expect.any(Array)
    );
  });
});

// ══════════════════════════════════════════════════════════════
// getTrackSearchTags
// ══════════════════════════════════════════════════════════════
describe('getTrackSearchTags', () => {
  it('returns array of tag names', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ tag: 'blues' }, { tag: 'jazz' }] });

    const result = await model.getTrackSearchTags({ q: 'jazz', threshold: 0.2 });

    expect(result).toEqual(['blues', 'jazz']);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['jazz', 0.2]);
  });

  it('returns empty array when no tags found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.getTrackSearchTags({ q: 'xyz', threshold: 0.2 });

    expect(result).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════
// searchUsers
// ══════════════════════════════════════════════════════════════
describe('searchUsers', () => {
  it('returns rows with is_following=false when no currentUserId', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUserRow] });

    const result = await model.searchUsers({
      q: 'miles', sort: 'relevance', limit: 20, offset: 0,
      threshold: 0.2, currentUserId: null,
    });

    expect(result.rows[0].is_following).toBe(false);
    expect(result.total).toBe(1);
  });

  it('enriches follow status when currentUserId is provided', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakeUserRow] })                          // search
      .mockResolvedValueOnce({ rows: [{ following_id: 'u1' }] });             // follows

    const result = await model.searchUsers({
      q: 'miles', sort: 'relevance', limit: 20, offset: 0,
      threshold: 0.2, currentUserId: 'viewer1',
    });

    expect(result.rows[0].is_following).toBe(true);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('sets is_following=false for users not in follows result', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakeUserRow] })
      .mockResolvedValueOnce({ rows: [] });   // not following anyone

    const result = await model.searchUsers({
      q: 'miles', sort: 'relevance', limit: 20, offset: 0,
      threshold: 0.2, currentUserId: 'viewer1',
    });

    expect(result.rows[0].is_following).toBe(false);
  });

  it('appends location as $5 when location is provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchUsers({
      q: 'miles', sort: 'relevance', limit: 20, offset: 0,
      threshold: 0.2, currentUserId: null, location: 'Cairo',
    });

    const params = db.query.mock.calls[0][1];
    expect(params).toHaveLength(5);
    expect(params[4]).toBe('Cairo');
  });

  it('returns total 0 when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.searchUsers({
      q: 'ghost', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(result.total).toBe(0);
  });

  it('uses created_at order for sort=newest', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.searchUsers({
      q: 'miles', sort: 'newest', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('u.created_at DESC'),
      expect.any(Array)
    );
  });
});

// ══════════════════════════════════════════════════════════════
// getUserSearchLocations
// ══════════════════════════════════════════════════════════════
describe('getUserSearchLocations', () => {
  it('returns deduplicated city and country labels', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { city: 'Cairo', country: 'EG' },
        { city: null, country: 'US' },
      ],
    });

    const result = await model.getUserSearchLocations({ q: 'miles', threshold: 0.2 });

    expect(result).toEqual([
      { label: 'Cairo', value: 'Cairo' },
      { label: 'EG', value: 'EG' },
      { label: 'US', value: 'US' },
    ]);
  });

  it('skips null city and null country', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ city: null, country: null }] });

    const result = await model.getUserSearchLocations({ q: 'x', threshold: 0.2 });

    expect(result).toEqual([]);
  });

  it('deduplicates repeated values', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { city: 'Cairo', country: 'EG' },
        { city: 'Cairo', country: 'EG' },
      ],
    });

    const result = await model.getUserSearchLocations({ q: 'x', threshold: 0.2 });

    const values = result.map((r) => r.value);
    expect(values).toEqual(['Cairo', 'EG']);
  });
});

// ══════════════════════════════════════════════════════════════
// searchPlaylists / searchAlbums
// ══════════════════════════════════════════════════════════════
describe('searchPlaylists', () => {
  it('returns rows with preview_tracks and total', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakePlaylistRow] })   // main search
      .mockResolvedValueOnce({ rows: [] });                  // preview tracks

    const result = await model.searchPlaylists({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(result.rows[0].preview_tracks).toEqual([]);
    expect(result.total).toBe(1);
  });

  it('groups preview tracks by playlist_id', async () => {
    const previewTrack = {
      playlist_id: 'p1', track_id: 't1', title: 'Blue Note',
      cover_image: null, duration: 180, play_count: 100,
      stream_url: 'https://stream/t1', artist_name: 'Miles', user_id: 'u1',
    };

    db.query
      .mockResolvedValueOnce({ rows: [fakePlaylistRow] })
      .mockResolvedValueOnce({ rows: [previewTrack] });

    const result = await model.searchPlaylists({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(result.rows[0].preview_tracks).toHaveLength(1);
    expect(result.rows[0].preview_tracks[0].id).toBe('t1');
  });

  it('returns total 0 and no preview fetch when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.searchPlaylists({
      q: 'nothing', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(db.query).toHaveBeenCalledTimes(1); // no second call for preview tracks
  });

  it('appends tag as $5 when provided', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] });

    await model.searchPlaylists({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2, tag: 'chill',
    });

    const params = db.query.mock.calls[0][1];
    expect(params[4]).toBe('chill');
  });
});

describe('searchAlbums', () => {
  it('delegates to _searchPlaylistLike with subtype=album', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [fakePlaylistRow] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await model.searchAlbums({
      q: 'jazz', sort: 'relevance', limit: 20, offset: 0, threshold: 0.2,
    });

    // subtype = album should appear in the injected SQL string
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'album'"),
      expect.any(Array)
    );
    expect(result.rows).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════
// getPlaylistSearchTags
// ══════════════════════════════════════════════════════════════
describe('getPlaylistSearchTags', () => {
  it('returns tag names for playlists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ tag: 'chill' }, { tag: 'jazz' }] });

    const result = await model.getPlaylistSearchTags({ q: 'jazz', threshold: 0.2, subtype: 'playlist' });

    expect(result).toEqual(['chill', 'jazz']);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['jazz', 0.2, 'playlist']);
  });

  it('passes subtype=album correctly', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.getPlaylistSearchTags({ q: 'jazz', threshold: 0.2, subtype: 'album' });

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['jazz', 0.2, 'album']);
  });
});

// ══════════════════════════════════════════════════════════════
// suggestUsers
// ══════════════════════════════════════════════════════════════
describe('suggestUsers', () => {
  it('returns users with is_following=false when no userId', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', display_name: 'Miles', username: 'miles', profile_picture: null }],
    });

    const result = await model.suggestUsers('mi', 5, null);

    expect(result[0].is_following).toBe(false);
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      ['mi%', 'mi', 0.2, 5]
    );
  });

  it('returns followed users with is_following=true when userId provided', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', display_name: 'Miles', username: 'miles', profile_picture: null }],
    });

    const result = await model.suggestUsers('mi', 5, 'viewer1');

    expect(result[0].is_following).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      ['viewer1', 'mi%', 'mi', 0.2, 5]
    );
  });

  it('returns empty array when no matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.suggestUsers('xyz', 5, null);

    expect(result).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════
// suggestTrackTitles
// ══════════════════════════════════════════════════════════════
describe('suggestTrackTitles', () => {
  it('returns array of title strings', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ title: 'Blue Note' }, { title: 'Blue Train' }] });

    const result = await model.suggestTrackTitles('blue', 5);

    expect(result).toEqual(['Blue Note', 'Blue Train']);
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      ['blue%', 'blue', 0.2, 5]
    );
  });

  it('returns empty array when no matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.suggestTrackTitles('xyz', 5);

    expect(result).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════
// suggestPlaylistNames
// ══════════════════════════════════════════════════════════════
describe('suggestPlaylistNames', () => {
  it('returns array of playlist name strings', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ name: 'Jazz Vibes' }, { name: 'Jazz Classics' }] });

    const result = await model.suggestPlaylistNames('jazz', 5);

    expect(result).toEqual(['Jazz Vibes', 'Jazz Classics']);
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      ['jazz%', 'jazz', 0.2, 5]
    );
  });

  it('returns empty array when no matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.suggestPlaylistNames('xyz', 5);

    expect(result).toEqual([]);
  });
});