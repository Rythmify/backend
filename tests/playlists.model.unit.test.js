const { v4: uuidv4 } = require('uuid');
const model = require('../src/models/playlist.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  db.connect = jest.fn();
});

describe('playlist.model', () => {
  const mockPlaylistId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
  const mockTrackId = '550e8400-e29b-41d4-a716-446655440002';
  const mockGenreId = '550e8400-e29b-41d4-a716-446655440003';

  const mockPlaylist = {
    playlist_id: mockPlaylistId,
    owner_user_id: mockUserId,
    name: 'Test Playlist',
    description: 'Test Description',
    cover_image: 'https://example.com/cover.jpg',
    type: 'regular',
    subtype: 'playlist',
    slug: 'test-playlist',
    is_public: true,
    secret_token: 'secret123',
    release_date: null,
    genre_id: null,
    like_count: 5,
    repost_count: 2,
    track_count: 10,
    created_at: '2026-04-29T00:00:00Z',
    updated_at: '2026-04-29T00:00:00Z',
  };

  describe('getTopTrackArt', () => {
    it('returns top track cover image', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ cover_image: 'https://example.com/track.jpg' }] });
      const result = await model.getTopTrackArt(mockPlaylistId);
      expect(result).toEqual({ cover_image: 'https://example.com/track.jpg' });
    });

    it('returns null when no tracks', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.getTopTrackArt(mockPlaylistId);
      expect(result).toBeNull();
    });
  });

  describe('findPlaylistById', () => {
    it('returns playlist by id with tags', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockPlaylist] }) // Main query
        .mockResolvedValueOnce({ rows: [{ id: '1', name: 'rock' }] }); // Tags query
      const result = await model.findPlaylistById(mockPlaylistId);
      expect(result).toBeDefined();
      expect(result.playlist_id).toBe(mockPlaylistId);
      expect(Array.isArray(result.tags)).toBe(true);
    });

    it('returns null when playlist not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findPlaylistById(mockPlaylistId);
      expect(result).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('returns playlist by slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findBySlug('test-playlist');
      expect(result).toEqual(mockPlaylist);
    });

    it('excludes playlist by id when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await model.findBySlug('test-playlist', mockPlaylistId);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('id != $2'), [
        'test-playlist',
        mockPlaylistId,
      ]);
    });

    it('returns null when slug not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findBySlug('nonexistent-slug');
      expect(result).toBeNull();
    });
  });

  describe('findPublicPlaylists', () => {
    it('returns public playlists with all filters', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findPublicPlaylists({
        ownerUserId: null,
        q: null,
        subtype: 'playlist',
        isAlbumView: false,
        limit: 20,
        offset: 0,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns playlists with search query', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findPublicPlaylists({
        ownerUserId: null,
        q: 'test',
        subtype: null,
        isAlbumView: false,
        limit: 20,
        offset: 0,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns albums when isAlbumView is true', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      await model.findPublicPlaylists({
        ownerUserId: null,
        q: null,
        subtype: null,
        isAlbumView: true,
        limit: 20,
        offset: 0,
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("subtype != 'playlist'"),
        [20, 0]
      );
    });
  });

  describe('countPublicPlaylists', () => {
    it('returns count of public playlists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });
      const result = await model.countPublicPlaylists({
        ownerUserId: null,
        q: null,
        subtype: null,
        isAlbumView: false,
      });
      expect(result).toBe('42');
    });
  });

  describe('findMyPlaylists', () => {
    it('returns user playlists', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findMyPlaylists({
        userId: mockUserId,
        q: null,
        subtype: null,
        isAlbumView: false,
        limit: 20,
        offset: 0,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('countMyPlaylists', () => {
    it('returns count of user playlists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '15' }] });
      const result = await model.countMyPlaylists({
        userId: mockUserId,
        q: null,
        subtype: null,
        isAlbumView: false,
      });
      expect(result).toBe('15');
    });
  });

  describe('findLikedPlaylists', () => {
    it('returns liked playlists', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findLikedPlaylists({
        userId: mockUserId,
        q: null,
        subtype: null,
        isAlbumView: false,
        limit: 20,
        offset: 0,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('countLikedPlaylists', () => {
    it('returns count of liked playlists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: 8 }] });
      const result = await model.countLikedPlaylists({
        userId: mockUserId,
        q: null,
        subtype: null,
        isAlbumView: false,
      });
      expect(result).toBe(8);
    });
  });

  describe('create', () => {
    it('creates new playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.create({
        userId: mockUserId,
        name: 'Test Playlist',
        isPublic: true,
        secretToken: 'secret123',
        subtype: 'playlist',
        slug: 'test-playlist',
      });
      expect(result).toEqual(mockPlaylist);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO playlists'),
        expect.any(Array)
      );
    });
  });

  describe('updatePlaylist', () => {
    it('updates playlist with provided fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, name: 'Updated' }] });
      const result = await model.updatePlaylist(mockPlaylistId, { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE playlists'), [
        'Updated',
        mockPlaylistId,
      ]);
    });

    it('updates multiple fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...mockPlaylist, name: 'Updated', description: 'New Desc' }],
      });
      const result = await model.updatePlaylist(mockPlaylistId, {
        name: 'Updated',
        description: 'New Desc',
      });
      expect(result.name).toBe('Updated');
      expect(result.description).toBe('New Desc');
    });

    it('returns null when playlist not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.updatePlaylist(mockPlaylistId, { name: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('hardDelete', () => {
    it('returns deleted playlist object when successful', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: mockPlaylistId }] });
      const result = await model.hardDelete(mockPlaylistId);
      expect(result).toEqual({ id: mockPlaylistId });
    });

    it('returns null when playlist not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.hardDelete(mockPlaylistId);
      expect(result).toBeNull();
    });
  });

  describe('findPlaylistTracks', () => {
    it('returns playlist tracks array', async () => {
      const mockTrack = {
        track_id: mockTrackId,
        position: 1,
        title: 'Track Title',
        artist: 'Artist Name',
        duration: 180,
      };
      db.query.mockResolvedValueOnce({ rows: [mockTrack] });
      const result = await model.findPlaylistTracks(mockPlaylistId);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].track_id).toBe(mockTrackId);
    });

    it('returns empty array when no tracks', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findPlaylistTracks(mockPlaylistId);
      expect(result).toEqual([]);
    });
  });

  describe('findPlaylistTrack', () => {
    it('returns true when track exists in playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ 1: true }] });
      const result = await model.findPlaylistTrack(mockPlaylistId, mockTrackId);
      expect(result).toBe(true);
    });

    it('returns false when track not in playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findPlaylistTrack(mockPlaylistId, mockTrackId);
      expect(result).toBe(false);
    });
  });

  describe('getPlaylistTags', () => {
    it('returns playlist tags', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ name: 'rock' }, { name: 'indie' }] });
      const result = await model.getPlaylistTags(mockPlaylistId);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].name).toBe('rock');
    });

    it('returns empty array when no tags', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.getPlaylistTags(mockPlaylistId);
      expect(result).toEqual([]);
    });
  });

  describe('replacePlaylistTags', () => {
    it('replaces playlist tags with new ones', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // DELETE query
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // SELECT existing tag
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ id: '1', name: 'rock' }] }); // SELECT final tags
      const result = await model.replacePlaylistTags(mockPlaylistId, ['rock']);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findLikedMixesByUser', () => {
    it('returns map of liked mixes', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ playlist_id: mockPlaylistId }] });
      const result = await model.findLikedMixesByUser(mockUserId);
      expect(result instanceof Map).toBe(true);
      expect(result.has(mockPlaylistId)).toBe(true);
    });
  });

  describe('findDynamicMixPlaylistById', () => {
    it('returns dynamic mix playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findDynamicMixPlaylistById(mockPlaylistId, mockUserId);
      expect(result).toEqual(mockPlaylist);
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findDynamicMixPlaylistById(mockPlaylistId, mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('findOrCreateDailyMixPlaylist', () => {
    it('creates or updates daily mix playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findOrCreateDailyMixPlaylist(mockUserId);
      expect(result).toEqual(mockPlaylist);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO playlists'), [
        mockUserId,
      ]);
    });

    it('returns null when database fails', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findOrCreateDailyMixPlaylist(mockUserId);
      expect(result).toBeUndefined();
    });
  });

  describe('findOrCreateWeeklyMixPlaylist', () => {
    it('creates or updates weekly mix playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findOrCreateWeeklyMixPlaylist(mockUserId);
      expect(result).toEqual(mockPlaylist);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO playlists'), [
        mockUserId,
      ]);
    });

    it('returns undefined when no rows returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findOrCreateWeeklyMixPlaylist(mockUserId);
      expect(result).toBeUndefined();
    });
  });

  describe('findOrCreateGenreMixPlaylist', () => {
    it('creates or updates genre mix playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });
      const result = await model.findOrCreateGenreMixPlaylist(mockUserId, 'genre-id', 'Genre Mix');
      expect(result).toEqual(mockPlaylist);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO playlists'), [
        mockUserId,
        'genre-id',
        'Genre Mix',
      ]);
    });

    it('returns undefined when no rows returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findOrCreateGenreMixPlaylist(mockUserId, 'genre-id', 'Genre Mix');
      expect(result).toBeUndefined();
    });
  });

  describe('database error handling', () => {
    it('throws error when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      db.query.mockRejectedValueOnce(dbError);
      await expect(
        model.findPublicPlaylists({
          ownerUserId: null,
          q: null,
          subtype: null,
          isAlbumView: false,
          limit: 20,
          offset: 0,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('handles empty responses gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await model.findPlaylistById(mockPlaylistId);
      expect(result).toBeNull();
    });
  });

  describe('Transaction-based operations', () => {
    it('should reorder tracks successfully with transaction', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rowCount: 2 }) // First UPDATE (shift)
        .mockResolvedValueOnce({ rowCount: 1 }) // First UPDATE (reorder)
        .mockResolvedValueOnce({ rowCount: 1 }) // Second UPDATE (reorder)
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const items = [
        { track_id: mockTrackId, position: 1 },
        { track_id: uuidv4(), position: 2 },
      ];

      await model.reorderTracks(mockPlaylistId, items);

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback reorder on error', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
        .mockRejectedValueOnce(new Error('Update failed'));

      const items = [{ track_id: mockTrackId, position: 1 }];

      await expect(model.reorderTracks(mockPlaylistId, items)).rejects.toThrow();
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should remove track from playlist successfully', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ position: 5 }] }) // DELETE
        .mockResolvedValueOnce({ rowCount: 3 }) // UPDATE shift up
        .mockResolvedValueOnce({ rowCount: 3 }) // UPDATE shift down
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await model.removeTrackFromPlaylist(mockPlaylistId, mockTrackId);

      expect(result).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return false when track not found in playlist', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // DELETE not found
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await model.removeTrackFromPlaylist(mockPlaylistId, mockTrackId);

      expect(result).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback remove track on error', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ position: 5 }] }) // DELETE
        .mockRejectedValueOnce(new Error('Update failed'));

      await expect(model.removeTrackFromPlaylist(mockPlaylistId, mockTrackId)).rejects.toThrow();
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Additional helper functions', () => {
    it('should get all tracks in playlist', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ track_id: mockTrackId }, { track_id: uuidv4() }, { track_id: uuidv4() }],
      });

      const result = await model.getAllTracksInPlaylist(mockPlaylistId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should get total duration of playlist', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total_duration_seconds: 3600 }],
      });

      const result = await model.getTotalDuration(mockPlaylistId);

      expect(result).toBe(3600);
    });

    it('should get max position in playlist', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ max_pos: 42 }],
      });

      const result = await model.getMaxPosition(mockPlaylistId);

      expect(result).toBe(42);
    });

    it('should shift positions down', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 5 }); // Phase 1
      db.query.mockResolvedValueOnce({ rowCount: 5 }); // Phase 2

      await model.shiftPositionsDown(mockPlaylistId, 10);

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should insert track at position', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await model.insertTrackAtPosition(mockPlaylistId, mockTrackId, 5);

      expect(db.query).toHaveBeenCalled();
    });

    it('should bulk insert tracks', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 3 });

      const tracks = [
        { id: mockTrackId, position: 1 },
        { id: uuidv4(), position: 2 },
        { id: uuidv4(), position: 3 },
      ];

      await model.bulkInsertTracks(mockPlaylistId, tracks);

      expect(db.query).toHaveBeenCalled();
    });

    it('should no-op bulkInsertTracks when tracks list is empty', async () => {
      await model.bulkInsertTracks(mockPlaylistId, []);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should get playlist tags', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'tag1' },
          { id: 2, name: 'tag2' },
        ],
      });

      const result = await model.getPlaylistTags(mockPlaylistId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should replace playlist tags', async () => {
      const tags = ['tag1', 'tag2'];
      db.query
        .mockResolvedValueOnce({ rowCount: 0 }) // DELETE old tags
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT existing tag1
        .mockResolvedValueOnce({ rows: [] }) // SELECT tag2 not found
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // INSERT tag2
        .mockResolvedValueOnce({ rows: [] }) // INSERT playlist_tag1
        .mockResolvedValueOnce({ rows: [] }) // INSERT playlist_tag2
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'tag1' },
            { id: 2, name: 'tag2' },
          ],
        }); // SELECT final tags

      await model.replacePlaylistTags(mockPlaylistId, tags);

      expect(db.query).toHaveBeenCalled();
    });

    it('should return [] when replacing with empty tags list', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 }); // DELETE old tags

      const result = await model.replacePlaylistTags(mockPlaylistId, []);

      expect(result).toEqual([]);
    });

    it('should fallback to SELECT when INSERT returns no tag row', async () => {
      const tags = ['jazz'];
      db.query
        .mockResolvedValueOnce({ rowCount: 0 }) // DELETE old tags
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing jazz -> not found
        .mockResolvedValueOnce({ rows: [] }) // INSERT jazz -> no RETURNING row
        .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // SELECT jazz again -> found
        .mockResolvedValueOnce({ rows: [] }) // INSERT playlist_tag
        .mockResolvedValueOnce({ rows: [{ id: 9, name: 'jazz' }] }); // SELECT final tags

      const result = await model.replacePlaylistTags(mockPlaylistId, tags);

      expect(result).toEqual([{ id: 9, name: 'jazz' }]);
    });

    it('should find liked mixes by user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ playlist_id: mockPlaylistId }, { playlist_id: null }],
      });

      const result = await model.findLikedMixesByUser(mockUserId);

      expect(result instanceof Map).toBe(true);
      expect(result.get(mockPlaylistId)).toBe(true);
    });

    it('should return empty Map when userId is missing', async () => {
      const result = await model.findLikedMixesByUser(null);
      expect(result instanceof Map).toBe(true);
      expect(result.size).toBe(0);
    });

    it('should find playlist tracks paginated', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ track_id: mockTrackId, position: 1 }] })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] });

      const result = await model.findPlaylistTracksPaginated(mockPlaylistId, {
        limit: 10,
        offset: 0,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should find dynamic mix playlist', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ ...mockPlaylist, type: 'curated_daily' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await model.findDynamicMixPlaylistById(mockPlaylistId, mockUserId);

      expect(result).toBeDefined();
    });

    it('should create or update daily mix', async () => {
      // Clear previous mocks before setting up new ones for this isolated test
      jest.clearAllMocks();
      db.query = jest.fn().mockResolvedValue({
        rows: [
          { id: mockPlaylistId, name: 'Daily Drops', type: 'curated_daily', user_id: mockUserId },
        ],
      });

      const result = await model.findOrCreateDailyMixPlaylist(mockUserId);

      expect(result).toBeDefined();
      expect(result.name).toBe('Daily Drops');
    });

    it('should create or update weekly mix', async () => {
      db.query.mockClear();
      db.query.mockResolvedValue({
        rows: [
          { id: mockPlaylistId, name: 'Weekly Wave', type: 'curated_weekly', user_id: mockUserId },
        ],
      });

      const result = await model.findOrCreateWeeklyMixPlaylist(mockUserId);

      expect(result).toBeDefined();
    });

    it('should create or update genre mix', async () => {
      db.query.mockClear();
      db.query.mockResolvedValue({
        rows: [
          {
            id: mockPlaylistId,
            name: 'Genre Mix',
            type: 'auto_generated',
            genre_id: mockGenreId,
            user_id: mockUserId,
          },
        ],
      });

      const result = await model.findOrCreateGenreMixPlaylist(mockUserId, mockGenreId, 'Genre Mix');

      expect(result).toBeDefined();
    });

    it('should handle count returning large numbers', async () => {
      db.query.mockClear();
      db.query.mockResolvedValue({ rows: [{ count: 999999 }] }); // Use number not string

      const result = await model.countPublicPlaylists({
        ownerUserId: null,
        q: null,
        subtype: null,
        isAlbumView: false,
      });

      expect(result).toBe(999999);
    });

    it('should find playlists with multiple filter combinations', async () => {
      db.query.mockClear();
      db.query.mockResolvedValue({ rows: [mockPlaylist] });

      const result = await model.findPublicPlaylists({
        ownerUserId: mockUserId,
        q: 'search term',
        subtype: 'playlist',
        isAlbumView: false,
        limit: 100,
        offset: 0,
      });

      expect(result).toEqual([mockPlaylist]);
    });

    it('should count public playlists with ownerUserId filter', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: 5 }] });

      const result = await model.countPublicPlaylists({
        ownerUserId: mockUserId,
        q: null,
        subtype: null,
        isAlbumView: false,
      });

      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalled();
      const callParams = db.query.mock.calls[0];
      expect(callParams[1]).toContain(mockUserId);
    });

    it('should count public playlists with search query', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: 3 }] });

      const result = await model.countPublicPlaylists({
        ownerUserId: null,
        q: 'cool playlist',
        subtype: null,
        isAlbumView: false,
      });

      expect(result).toBe(3);
    });

    it('should count public playlists with subtype filter', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: 2 }] });

      const result = await model.countPublicPlaylists({
        ownerUserId: null,
        q: null,
        subtype: 'album',
        isAlbumView: false,
      });

      expect(result).toBe(2);
    });

    it('should count public playlists with album view filter', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await model.countPublicPlaylists({
        ownerUserId: null,
        q: null,
        subtype: null,
        isAlbumView: true,
      });

      expect(result).toBe(1);
    });

    it('should find my playlists with search and filters', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });

      const result = await model.findMyPlaylists({
        userId: mockUserId,
        q: 'my playlist',
        subtype: 'album',
        isAlbumView: false,
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual([mockPlaylist]);
    });

    it('should count my playlists with search and subtype', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: 2 }] });

      const result = await model.countMyPlaylists({
        userId: mockUserId,
        q: 'my',
        subtype: 'album',
        isAlbumView: false,
      });

      expect(result).toBe(2);
    });

    it('should find liked playlists with all filters', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockPlaylist] });

      const result = await model.findLikedPlaylists({
        userId: mockUserId,
        q: 'liked',
        subtype: 'playlist',
        isAlbumView: false,
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual([mockPlaylist]);
    });

    it('should count liked playlists with search query', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      const result = await model.countLikedPlaylists({
        userId: mockUserId,
        q: 'fav',
        subtype: null,
        isAlbumView: false,
      });

      expect(result).toBe(1);
    });

    it('should update playlist with single field', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, name: 'New Name' }] });

      const result = await model.updatePlaylist(mockPlaylistId, { name: 'New Name' });

      expect(result).toBeDefined();
      expect(db.query).toHaveBeenCalled();
    });

    it('should update playlist with secretToken', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, secret_token: 'newsecret' }] });

      const result = await model.updatePlaylist(mockPlaylistId, { secretToken: 'newsecret' });

      expect(result).toBeDefined();
    });

    it('should update playlist with subtype', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, subtype: 'album' }] });

      const result = await model.updatePlaylist(mockPlaylistId, { subtype: 'album' });

      expect(result).toBeDefined();
    });

    it('should update playlist with coverImage', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...mockPlaylist, cover_image: 'https://example.com/newcover.jpg' }],
      });

      const result = await model.updatePlaylist(mockPlaylistId, {
        coverImage: 'https://example.com/newcover.jpg',
      });

      expect(result).toBeDefined();
    });

    it('should update playlist with releaseDate', async () => {
      const newDate = '2026-05-01';
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, release_date: newDate }] });

      const result = await model.updatePlaylist(mockPlaylistId, { releaseDate: newDate });

      expect(result).toBeDefined();
    });

    it('should update playlist with genreId', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, genre_id: mockGenreId }] });

      const result = await model.updatePlaylist(mockPlaylistId, { genreId: mockGenreId });

      expect(result).toBeDefined();
    });

    it('should update playlist with slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockPlaylist, slug: 'new-slug' }] });

      const result = await model.updatePlaylist(mockPlaylistId, { slug: 'new-slug' });

      expect(result).toBeDefined();
    });

    it('should update playlist with multiple fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockPlaylist,
            name: 'Updated Name',
            description: 'Updated desc',
            is_public: false,
          },
        ],
      });

      const result = await model.updatePlaylist(mockPlaylistId, {
        name: 'Updated Name',
        description: 'Updated desc',
        isPublic: false,
      });

      expect(result).toBeDefined();
    });

    it('should update playlist with all fields', async () => {
      const updateData = {
        name: 'All Updated',
        description: 'All fields',
        isPublic: true,
        secretToken: 'all-secret',
        subtype: 'album',
        coverImage: 'https://example.com/all.jpg',
        releaseDate: '2026-06-01',
        genreId: mockGenreId,
        slug: 'all-updated',
      };

      db.query.mockResolvedValueOnce({
        rows: [{ ...mockPlaylist, ...updateData }],
      });

      const result = await model.updatePlaylist(mockPlaylistId, updateData);

      expect(result).toBeDefined();
    });

    it('should return null when updating non-existent playlist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await model.updatePlaylist(mockPlaylistId, { name: 'New' });

      expect(result).toBeNull();
    });

    it('should return null when no fields to update', async () => {
      const result = await model.updatePlaylist(mockPlaylistId, {});

      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should throw error when reorder track not found', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rowCount: 2 }) // UPDATE shift
        .mockResolvedValueOnce({ rowCount: 0 }); // UPDATE track - not found, rowCount = 0

      const items = [
        { track_id: mockTrackId, position: 1 },
        { track_id: uuidv4(), position: 2 },
      ];

      await expect(model.reorderTracks(mockPlaylistId, items)).rejects.toThrow(
        'PLAYLIST_REORDER_TRACK_NOT_FOUND'
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle successful reorder with multiple updates', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      const track1 = mockTrackId;
      const track2 = uuidv4();

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ track_id: track1 }, { track_id: track2 }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rowCount: 2 }) // UPDATE shift positions
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE track1 to position 1
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE track2 to position 2
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const items = [
        { track_id: track1, position: 1 },
        { track_id: track2, position: 2 },
      ];

      await model.reorderTracks(mockPlaylistId, items);

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should get total duration of playlist', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total_duration_seconds: 7200 }],
      });

      const result = await model.getTotalDuration(mockPlaylistId);

      expect(result).toBe(7200);
    });

    it('should get zero duration when playlist has no tracks', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total_duration_seconds: 0 }],
      });

      const result = await model.getTotalDuration(mockPlaylistId);

      expect(result).toBe(0);
    });

    it('should handle replacePlaylistTags with tag row existing', async () => {
      const tags = ['pop', 'rock'];
      db.query
        .mockResolvedValueOnce({ rowCount: 0 }) // DELETE old tags
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT existing pop tag
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // SELECT existing rock tag
        .mockResolvedValueOnce({ rows: [] }) // INSERT playlist_tag1
        .mockResolvedValueOnce({ rows: [] }) // INSERT playlist_tag2
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'pop' },
            { id: 2, name: 'rock' },
          ],
        }); // SELECT final tags

      const result = await model.replacePlaylistTags(mockPlaylistId, tags);

      expect(db.query).toHaveBeenCalled();
    });
  });
});
