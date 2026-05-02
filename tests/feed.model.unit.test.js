const model = require('../src/models/feed.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const GENRE_UUID = '22222222-2222-2222-2222-222222222222';

describe('Feed - Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  it('getDailyTracks and getWeeklyTracks return rows', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't2' }] });

    await expect(model.getDailyTracks(10, null)).resolves.toEqual([{ id: 't1' }]);
    await expect(model.getWeeklyTracks('u1', 10)).resolves.toEqual([{ id: 't2' }]);
  });

  it('isFollowingArtist returns true/false based on rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }).mockResolvedValueOnce({ rows: [] });

    await expect(model.isFollowingArtist('u1', 'a1')).resolves.toBe(true);
    await expect(model.isFollowingArtist('u1', 'a1')).resolves.toBe(false);
  });

  it('getHomeTrendingByGenre returns empty and initial tab payload', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.getHomeTrendingByGenre(20, null)).resolves.toEqual({
      genres: [],
      initial_tab: null,
    });

    db.query
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] });

    const out = await model.getHomeTrendingByGenre(20, null);
    expect(out.genres).toEqual([{ genre_id: GENRE_UUID, genre_name: 'Pop' }]);
    expect(out.initial_tab.tracks).toEqual([{ id: 't1' }]);
  });

  it('getHomeTrendingByGenre falls back to empty tracks when initial genre tracks are non-array', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }] })
      .mockResolvedValueOnce({
        rows: null,
      });

    const out = await model.getHomeTrendingByGenre(20, null);
    expect(out.initial_tab.tracks).toEqual([]);
  });

  it('getUserLikedGenreTrendingIds handles null user and returns set', async () => {
    await expect(model.getUserLikedGenreTrendingIds(null)).resolves.toEqual(new Set());

    db.query.mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID }] });
    const out = await model.getUserLikedGenreTrendingIds('u1');
    expect(out.has(GENRE_UUID)).toBe(true);
  });

  it('artist/station mapping functions return normalized payloads', async () => {
    const row = {
      id: 'a1',
      display_name: 'Artist',
      profile_picture: null,
      top_genre: null,
      play_velocity: '5',
      track_count: '7',
      followers_count: '3',
      total_count: '1',
    };

    db.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] });

    const a = await model.getArtistsToWatch(10, null);
    const ap = await model.getArtistsToWatchPaginated(10, 0, null);
    const d = await model.getDiscoverWithStations(10, null);
    const s = await model.getStationsPaginated(10, 0, null);
    const one = await model.getStationByArtistId('a1', null);

    expect(a[0].play_velocity).toBe(5);
    expect(ap.total).toBe(1);
    expect(d[0].name).toContain('Based on');
    expect(s.total).toBe(1);
    expect(one.artist_id).toBe('a1');
  });

  it('artist/station mapping functions normalize null numeric fields and empty totals', async () => {
    const row = {
      id: 'a1',
      display_name: 'Artist',
      profile_picture: null,
      top_genre: null,
      play_velocity: null,
      track_count: null,
      followers_count: null,
    };

    db.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [],
      });

    const a = await model.getArtistsToWatch(10, null);
    const ap = await model.getArtistsToWatchPaginated(10, 0, null);
    const s = await model.getStationsPaginated(10, 0, null);

    expect(a[0].play_velocity).toBe(0);
    expect(a[0].track_count).toBe(0);
    expect(ap.total).toBe(0);
    expect(s.total).toBe(0);
  });

  it('getStationByArtistId returns null for empty rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.getStationByArtistId('a1', null)).resolves.toBeNull();
  });

  it('getTracksByArtistId returns items and total', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 't1', total_count: '2' }] });
    await expect(model.getTracksByArtistId('a1', 10, 0, null)).resolves.toEqual({
      items: [{ id: 't1', total_count: '2' }],
      total: 2,
    });
  });

  it('genre candidate and preview helpers return rows and empty on invalid arrays', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID }] })
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't2' }] });

    await expect(model.getPersonalizedMixGenreCandidates('u1', 6)).resolves.toEqual([
      { genre_id: GENRE_UUID },
    ]);
    await expect(model.getTrendingMixGenreCandidates(6, null)).resolves.toEqual([
      { genre_id: GENRE_UUID },
    ]);
    await expect(model.getTopPreviewTracksByGenreIds([GENRE_UUID], null)).resolves.toEqual([
      { id: 't1' },
    ]);
    await expect(model.getFirstPreviewTracksByAlbumIds([VALID_UUID], null)).resolves.toEqual([
      { id: 't2' },
    ]);

    await expect(model.getTopPreviewTracksByGenreIds([], null)).resolves.toEqual([]);
    await expect(model.getFirstPreviewTracksByAlbumIds([], null)).resolves.toEqual([]);
  });

  it('getFirstPreviewTracksByAlbumIds reads preview tracks from playlist_tracks for album-style playlists', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ album_id: VALID_UUID, id: 't1', title: 'First Track', album_order: 1 }],
    });

    const out = await model.getFirstPreviewTracksByAlbumIds([VALID_UUID], null);

    expect(out).toEqual([{ album_id: VALID_UUID, id: 't1', title: 'First Track', album_order: 1 }]);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN   playlist_tracks pt ON pt.playlist_id = sa.album_id'),
      [[VALID_UUID], null]
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY pt.position ASC NULLS LAST, t.created_at ASC'),
      [[VALID_UUID], null]
    );
  });

  it('getMoreOfWhatYouLike maps items and source rank fallback', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 't1',
          title: 'T1',
          cover_image: null,
          duration: 1,
          genre_name: null,
          user_id: 'u2',
          play_count: 0,
          like_count: 0,
          repost_count: 0,
          artist_name: null,
          stream_url: null,
          created_at: '2026-01-01',
          source_rank: 6,
          total_count: '1',
        },
      ],
    });

    const out = await model.getMoreOfWhatYouLike('u1', 10, 0);
    expect(out.total).toBe(1);
    expect(out.source).toBe('trending_fallback');
    expect(out.items[0].id).toBe('t1');
  });

  it('album list functions return mapped rows and totals', async () => {
    const albumRow = {
      id: 'p1',
      name: 'Album',
      cover_image: null,
      owner_id: 'a1',
      owner_name: 'Artist',
      track_count: 5,
      like_count: 10,
      created_at: '2026-01-01',
      total_count: '1',
    };

    db.query
      .mockResolvedValueOnce({ rows: [albumRow] })
      .mockResolvedValueOnce({ rows: [albumRow] })
      .mockResolvedValueOnce({ rows: [albumRow] });

    const a = await model.getAlbumsFromFollowedArtists('u1', 6, 0);
    const b = await model.getTopAlbums(6, 0, null);
    const c = await model.getAllAlbums(6, 0, null);

    expect(a.total).toBe(1);
    expect(b.items[0].owner_name).toBe('Artist');
    expect(c.items[0].id).toBe('p1');
  });

  it('album list functions return zero totals for empty rows', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [],
      });

    await expect(model.getAlbumsFromFollowedArtists('u1', 6, 0)).resolves.toEqual({
      items: [],
      total: 0,
    });
    await expect(model.getTopAlbums(6, 0, null)).resolves.toEqual({ items: [], total: 0 });
    await expect(model.getAllAlbums(6, 0, null)).resolves.toEqual({ items: [], total: 0 });
  });

  it('findGenreById and track-by-genre methods handle empty and normal cases', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: GENRE_UUID, name: 'Pop' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't3', total_count: '4' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(model.findGenreById(GENRE_UUID)).resolves.toEqual({ id: GENRE_UUID, name: 'Pop' });
    await expect(model.findTracksByGenreId(GENRE_UUID, 10, null)).resolves.toEqual([{ id: 't1' }]);
    await expect(model.findTracksByGenreIds([GENRE_UUID], 10, null)).resolves.toEqual([
      { id: 't2' },
    ]);

    const p = await model.findTracksByGenreIdPaginated(GENRE_UUID, 10, 0, null);
    expect(p.total).toBe(4);

    await expect(model.findTracksByGenreIds([], 10, null)).resolves.toEqual([]);
  });

  it('findGenreById returns null and paginated genre tracks return total 0 for empty rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(model.findGenreById(GENRE_UUID)).resolves.toBeNull();
    await expect(model.findTracksByGenreIdPaginated(GENRE_UUID, 10, 0, null)).resolves.toEqual({
      rows: [],
      total: 0,
    });
  });

  it('getActivityFeed maps track/playlist activities and cursor behavior', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            type: 'track_post',
            occurred_at: now,
            actor_id: 'u2',
            track_id: 't1',
            playlist_id: null,
            sort_id: 's1',
          },
          {
            type: 'playlist_post',
            occurred_at: now,
            actor_id: 'u2',
            track_id: null,
            playlist_id: 'p1',
            sort_id: 's2',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'u2', username: 'u2', display_name: 'U2', followers_count: 1, is_verified: false },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 't1',
            title: 'Track',
            artist_id: 'a1',
            artist_username: 'a',
            artist_is_verified: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'u2', username: 'u2', display_name: 'U2', followers_count: 1, is_verified: false },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'p1', name: 'Playlist', creator_username: 'u2', creator_is_verified: false }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await model.getActivityFeed('u1', 2, Buffer.from('bad date').toString('base64'));
    expect(Array.isArray(out.items)).toBe(true);
    expect(typeof out.hasMore).toBe('boolean');
    expect(Object.prototype.hasOwnProperty.call(out, 'nextCursor')).toBe(true);
    expect(db.query).toHaveBeenCalled();
  });

  it('getDiscoveryFeed decodes cursor, returns next cursor when hasMore', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ track_id: 't1' }, { track_id: 't2' }] });

    const out = await model.getDiscoveryFeed('u1', 2, Buffer.from('0').toString('base64'));

    expect(out.items).toHaveLength(2);
    expect(out.hasMore).toBe(true);
    expect(typeof out.nextCursor).toBe('string');
  });

  it('getDiscoveryFeed with no cursor and fewer rows than limit returns no next cursor', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ track_id: 't1' }] });

    const out = await model.getDiscoveryFeed('u1', 2, null);

    expect(out.items).toHaveLength(1);
    expect(out.hasMore).toBe(false);
    expect(out.nextCursor).toBeNull();
  });

  it('getActivityFeed maps both track and playlist records with hasMore and nextCursor', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const rows = [
      {
        type: 'track_repost',
        occurred_at: now,
        actor_id: 'u2',
        track_id: 't1',
        playlist_id: null,
        sort_id: 's1',
      },
      {
        type: 'playlist_repost',
        occurred_at: now,
        actor_id: 'u2',
        track_id: null,
        playlist_id: 'p1',
        sort_id: 's2',
      },
      {
        type: 'track_post',
        occurred_at: now,
        actor_id: 'u2',
        track_id: 't2',
        playlist_id: null,
        sort_id: 's3',
      },
    ];

    db.query.mockImplementation(async (sql) => {
      if (sql.includes('WITH followings AS')) {
        return { rows };
      }
      if (sql.includes('FROM users WHERE id = $1 LIMIT 1')) {
        return {
          rows: [
            {
              id: 'u2',
              username: 'u2',
              display_name: 'User 2',
              profile_picture: null,
              followers_count: 11,
              is_verified: true,
            },
          ],
        };
      }
      if (sql.includes('FROM tracks t') && sql.includes('WHERE t.id = $1')) {
        return {
          rows: [
            {
              id: 't1',
              title: 'Track 1',
              duration: 120,
              play_count: 5,
              like_count: 3,
              cover_image: null,
              audio_url: 'a.mp3',
              preview_url: null,
              stream_url: null,
              artist_id: 'a1',
              artist_username: 'artist1',
              artist_display_name: 'Artist 1',
              artist_profile_picture: null,
              artist_followers: 9,
              artist_is_verified: false,
            },
          ],
        };
      }
      if (sql.includes('FROM playlists p') && sql.includes('WHERE p.id = $1')) {
        return {
          rows: [
            {
              id: 'p1',
              name: 'Playlist 1',
              description: null,
              cover_image: null,
              track_count: 2,
              like_count: 7,
              repost_count: 1,
              created_at: now,
              creator_id: 'u2',
              creator_username: 'u2',
              creator_display_name: 'User 2',
              creator_profile_picture: null,
              creator_followers: 11,
              creator_is_verified: true,
            },
          ],
        };
      }
      if (sql.includes('FROM playlist_tracks pt')) {
        return {
          rows: [
            {
              id: 'tA',
              title: 'Track A',
              duration: 100,
              play_count: 1,
              like_count: 1,
              cover_image: null,
              audio_url: 'a.mp3',
              preview_url: null,
              stream_url: null,
              created_at: now,
              artist_id: 'a1',
              username: 'artist1',
              display_name: 'Artist 1',
              profile_picture: null,
            },
            {
              id: 'tB',
              title: 'Track B',
              duration: 100,
              play_count: 1,
              like_count: 1,
              cover_image: null,
              audio_url: 'b.mp3',
              preview_url: null,
              stream_url: null,
              created_at: now,
              artist_id: 'a2',
              username: 'artist2',
              display_name: 'Artist 2',
              profile_picture: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const out = await model.getActivityFeed('u1', 2, null);

    expect(out.items).toHaveLength(2);
    expect(out.hasMore).toBe(true);
    expect(typeof out.nextCursor).toBe('string');
    expect(out.items[0].type).toBe('repost');
  });

  it('getActivityFeed tolerates null ids by skipping batched lookup queries and returning null payloads', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          type: 'track_post',
          occurred_at: null,
          actor_id: null,
          track_id: null,
          playlist_id: null,
          sort_id: 's1',
        },
        {
          type: 'playlist_post',
          occurred_at: null,
          actor_id: null,
          track_id: null,
          playlist_id: null,
          sort_id: 's2',
        },
      ],
    });

    const out = await model.getActivityFeed('u1', 5, null);

    expect(out.items).toHaveLength(2);
    expect(out.items[0].user).toBeNull();
    expect(out.items[0].track).toBeNull();
    expect(out.items[0].created_at).toBeNull();
    expect(out.items[1].playlist).toBeNull();
    expect(out.items[1].track).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('getMoreOfWhatYouLike returns personalized source when top rank is <= 5', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 't9',
          title: 'T9',
          cover_image: null,
          duration: 1,
          genre_name: null,
          user_id: 'u2',
          play_count: 0,
          like_count: 0,
          repost_count: 0,
          artist_name: null,
          stream_url: null,
          created_at: '2026-01-01',
          source_rank: 2,
          total_count: '1',
        },
      ],
    });

    const out = await model.getMoreOfWhatYouLike('u1', 10, 0);
    expect(out.source).toBe('personalized');
  });

  it('paginated artist/station functions return total 0 for empty rows', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(model.getArtistsToWatchPaginated(10, 0, null)).resolves.toEqual({
      items: [],
      total: 0,
    });
    await expect(model.getStationsPaginated(10, 0, null)).resolves.toEqual({
      items: [],
      total: 0,
    });
    await expect(model.getTracksByArtistId('a1', 10, 0, null)).resolves.toEqual({
      items: [],
      total: 0,
    });
  });

  it('optional viewerUserId defaults are exercised when omitted', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'd1' }] })
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'a1',
            display_name: 'A',
            profile_picture: null,
            top_genre: null,
            play_velocity: '1',
            track_count: '1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            display_name: 'S',
            profile_picture: null,
            track_count: '1',
            follower_count: '1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            display_name: 'S',
            profile_picture: null,
            track_count: '1',
            follower_count: '1',
            total_count: '1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 't1', total_count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID }] })
      .mockResolvedValueOnce({ rows: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't4' }] });

    await expect(model.getDailyTracks(1)).resolves.toEqual([{ id: 'd1' }]);
    await expect(model.getHomeTrendingByGenre(1)).resolves.toEqual({
      genres: [{ genre_id: GENRE_UUID, genre_name: 'Pop' }],
      initial_tab: {
        genre_id: GENRE_UUID,
        genre_name: 'Pop',
        tracks: [{ id: 't1' }],
      },
    });
    await expect(model.getArtistsToWatch(1)).resolves.toHaveLength(1);
    await expect(model.getDiscoverWithStations(1)).resolves.toHaveLength(1);
    await expect(model.getStationsPaginated(1, 0)).resolves.toEqual({
      items: expect.any(Array),
      total: 1,
    });
    await expect(model.getTracksByArtistId('a1', 1, 0)).resolves.toEqual({
      items: [{ id: 't1', total_count: '1' }],
      total: 1,
    });
    await expect(model.getPersonalizedMixGenreCandidates('u1', 1)).resolves.toEqual([
      { genre_id: GENRE_UUID },
    ]);
    await expect(model.getTrendingMixGenreCandidates(1)).resolves.toEqual([
      { genre_id: GENRE_UUID, genre_name: 'Pop' },
    ]);
    await expect(model.getTopPreviewTracksByGenreIds([GENRE_UUID])).resolves.toEqual([
      { id: 't1' },
    ]);
    await expect(model.getFirstPreviewTracksByAlbumIds([VALID_UUID])).resolves.toEqual([
      { id: 't2' },
    ]);
    const topAlbums = await model.getTopAlbums(1, 0);
    expect(topAlbums.items[0].id).toBe('t3');

    const allAlbums = await model.getAllAlbums(1, 0);
    expect(allAlbums.items[0].id).toBe('t4');
  });

  it('getActivityFeed supports valid cursor decoding path', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const cursor = Buffer.from(new Date('2026-01-01T00:00:00.000Z').toISOString()).toString(
      'base64'
    );

    const out = await model.getActivityFeed('u1', 2, cursor);
    expect(out).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it('getActivityFeed tolerates invalid cursor values', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const out = await model.getActivityFeed('u1', 2, {});

    expect(out).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it('getActivityFeed formats playlist preview times across all age buckets', async () => {
    const now = new Date();
    const secondsAgo = new Date(now.getTime() - 30 * 1000);
    const minutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const hoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const daysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const weeksAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            type: 'playlist_post',
            occurred_at: now,
            actor_id: 'u2',
            track_id: null,
            playlist_id: 'p1',
            sort_id: 's1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u2',
            username: 'u2',
            display_name: 'User 2',
            profile_picture: null,
            followers_count: 11,
            is_verified: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            name: 'Playlist 1',
            description: null,
            cover_image: null,
            track_count: 6,
            like_count: 7,
            repost_count: 1,
            created_at: now,
            creator_id: 'u2',
            creator_username: 'u2',
            creator_display_name: 'User 2',
            creator_profile_picture: null,
            creator_followers: 11,
            creator_is_verified: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            playlist_id: 'p1',
            id: 't-base',
            title: 'Base Track',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'base.mp3',
            preview_url: null,
            stream_url: null,
            created_at: now,
            artist_id: 'a1',
            username: 'artist1',
            display_name: 'Artist 1',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-null',
            title: 'Null Time',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'a.mp3',
            preview_url: null,
            stream_url: null,
            created_at: null,
            artist_id: 'a2',
            username: 'artist2',
            display_name: 'Artist 2',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-seconds',
            title: 'Seconds Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'b.mp3',
            preview_url: null,
            stream_url: null,
            created_at: secondsAgo,
            artist_id: 'a3',
            username: 'artist3',
            display_name: 'Artist 3',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-minutes',
            title: 'Minutes Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'c.mp3',
            preview_url: null,
            stream_url: null,
            created_at: minutesAgo,
            artist_id: 'a4',
            username: 'artist4',
            display_name: 'Artist 4',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-days',
            title: 'Days Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'e.mp3',
            preview_url: null,
            stream_url: null,
            created_at: daysAgo,
            artist_id: 'a5',
            username: 'artist5',
            display_name: 'Artist 5',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-weeks',
            title: 'Weeks Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'f.mp3',
            preview_url: null,
            stream_url: null,
            created_at: weeksAgo,
            artist_id: 'a6',
            username: 'artist6',
            display_name: 'Artist 6',
            profile_picture: null,
          },
        ],
      });

    const out = await model.getActivityFeed('u1', 5, null);

    expect(out.items[0].playlist.trackPreviews.map((track) => track.timeSince)).toEqual([
      null,
      '30 seconds ago',
      '2 minutes ago',
      '2 days ago',
    ]);
  });

  it('getActivityFeed formats null playlist preview timestamps', async () => {
    const now = new Date();
    const secondsAgo = new Date(now.getTime() - 30 * 1000);
    const minutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const hoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            type: 'playlist_post',
            occurred_at: now,
            actor_id: 'u2',
            track_id: null,
            playlist_id: 'p1',
            sort_id: 's1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u2',
            username: 'u2',
            display_name: 'User 2',
            followers_count: 11,
            is_verified: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            name: 'Playlist 1',
            description: null,
            cover_image: null,
            track_count: 4,
            like_count: 7,
            repost_count: 1,
            created_at: now,
            creator_id: 'u2',
            creator_username: 'u2',
            creator_display_name: 'User 2',
            creator_profile_picture: null,
            creator_followers: 11,
            creator_is_verified: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            playlist_id: 'p1',
            id: 't-null',
            title: 'Null Time',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'a.mp3',
            preview_url: null,
            stream_url: null,
            created_at: null,
            artist_id: 'a1',
            username: 'artist1',
            display_name: 'Artist 1',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-seconds',
            title: 'Seconds Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'b.mp3',
            preview_url: null,
            stream_url: null,
            created_at: secondsAgo,
            artist_id: 'a2',
            username: 'artist2',
            display_name: 'Artist 2',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-minutes',
            title: 'Minutes Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'c.mp3',
            preview_url: null,
            stream_url: null,
            created_at: minutesAgo,
            artist_id: 'a3',
            username: 'artist3',
            display_name: 'Artist 3',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-hours',
            title: 'Hours Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'd.mp3',
            preview_url: null,
            stream_url: null,
            created_at: hoursAgo,
            artist_id: 'a4',
            username: 'artist4',
            display_name: 'Artist 4',
            profile_picture: null,
          },
        ],
      });

    const out = await model.getActivityFeed('u1', 4, null);

    expect(out.items[0].playlist.trackPreviews.map((track) => track.timeSince)).toEqual([
      '30 seconds ago',
      '2 minutes ago',
      '3 hours ago',
    ]);
  });

  it('getActivityFeed formats weeks-old playlist preview timestamps', async () => {
    const now = new Date();
    const weeksAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const daysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const hoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const minutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            type: 'playlist_post',
            occurred_at: now,
            actor_id: 'u2',
            track_id: null,
            playlist_id: 'p1',
            sort_id: 's1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u2',
            username: 'u2',
            display_name: 'User 2',
            followers_count: 11,
            is_verified: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            name: 'Playlist 1',
            description: null,
            cover_image: null,
            track_count: 4,
            like_count: 7,
            repost_count: 1,
            created_at: now,
            creator_id: 'u2',
            creator_username: 'u2',
            creator_display_name: 'User 2',
            creator_profile_picture: null,
            creator_followers: 11,
            creator_is_verified: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            playlist_id: 'p1',
            id: 't-base',
            title: 'Base Track',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'base.mp3',
            preview_url: null,
            stream_url: null,
            created_at: now,
            artist_id: 'a1',
            username: 'artist1',
            display_name: 'Artist 1',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-weeks',
            title: 'Weeks Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'a.mp3',
            preview_url: null,
            stream_url: null,
            created_at: weeksAgo,
            artist_id: 'a2',
            username: 'artist2',
            display_name: 'Artist 2',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-days',
            title: 'Days Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'b.mp3',
            preview_url: null,
            stream_url: null,
            created_at: daysAgo,
            artist_id: 'a3',
            username: 'artist3',
            display_name: 'Artist 3',
            profile_picture: null,
          },
          {
            playlist_id: 'p1',
            id: 't-hours',
            title: 'Hours Ago',
            duration: 100,
            play_count: 1,
            like_count: 1,
            cover_image: null,
            audio_url: 'c.mp3',
            preview_url: null,
            stream_url: null,
            created_at: hoursAgo,
            artist_id: 'a4',
            username: 'artist4',
            display_name: 'Artist 4',
            profile_picture: null,
          },
        ],
      });

    const out = await model.getActivityFeed('u1', 4, null);

    expect(out.items[0].playlist.trackPreviews.map((track) => track.timeSince)).toEqual([
      '1 weeks ago',
      '2 days ago',
      '3 hours ago',
    ]);
  });

  it('getDiscoveryFeed handles invalid cursor (NaN offset)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ track_id: 't1' }] });

    const badCursor = Buffer.from('not-a-number').toString('base64');
    const out = await model.getDiscoveryFeed('u1', 2, badCursor);

    expect(out.items).toHaveLength(1);
    expect(out.hasMore).toBe(false);
    expect(out.nextCursor).toBeNull();
  });

  it('getDiscoveryFeed returns empty when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const out = await model.getDiscoveryFeed('u1', 10, null);

    expect(out).toEqual({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('getDailyTracks handles explicit null viewerUserId', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 't1' }] });

    const out = await model.getDailyTracks(5, null);

    expect(out).toEqual([{ id: 't1' }]);
  });

  it('getWeeklyTracks returns empty array when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const out = await model.getWeeklyTracks('u1', 10);

    expect(out).toEqual([]);
  });

  it('getTracksByArtistId handles missing total_count safely', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 't1' }], // no total_count
    });

    const out = await model.getTracksByArtistId('a1', 10, 0, null);

    expect(out.total).toBeNaN(); // exposes branch
    expect(out.items).toHaveLength(1);
  });

  it('getMoreOfWhatYouLike returns empty result correctly', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const out = await model.getMoreOfWhatYouLike('u1', 10, 0);

    expect(out).toEqual({
      items: [],
      total: 0,
      source: 'trending_fallback',
    });
  });

  it('getTopPreviewTracksByGenreIds returns empty for invalid input', async () => {
    const out = await model.getTopPreviewTracksByGenreIds(null, null);
    expect(out).toEqual([]);
  });

  it('getFirstPreviewTracksByAlbumIds returns empty for invalid input', async () => {
    const out = await model.getFirstPreviewTracksByAlbumIds(null, null);
    expect(out).toEqual([]);
  });

  it('getActivityFeed returns hasMore=false when rows <= limit', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          type: 'track_post',
          occurred_at: new Date(),
          actor_id: null,
          track_id: null,
          playlist_id: null,
          sort_id: 's1',
        },
      ],
    });

    const out = await model.getActivityFeed('u1', 5, null);

    expect(out.hasMore).toBe(false);
    expect(out.nextCursor).toBeNull();
  });
});
