const model = require('../src/models/followdiscovery.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

describe('FollowDiscovery - Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMutualFollowSuggestions', () => {
    it('maps rows, filters null ids, parses numbers, and returns total', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'u2',
            display_name: 'Listener 2',
            username: 'listener2',
            profile_picture: 'https://img/u2.jpg',
            is_verified: true,
            followers_count: '10',
            mutual_count: '3',
            suggestion_source: 'mutual',
            total_count: '5',
          },
          {
            id: null,
            display_name: 'invalid',
            username: 'invalid',
            profile_picture: null,
            is_verified: false,
            followers_count: '999',
            mutual_count: '1',
            suggestion_source: 'popular',
            total_count: '5',
          },
          {
            id: 'u3',
            display_name: 'Listener 3',
            username: 'listener3',
            profile_picture: null,
            is_verified: false,
            followers_count: 'not-a-number',
            mutual_count: null,
            suggestion_source: 'popular',
            total_count: '5',
          },
        ],
      });

      const result = await model.getMutualFollowSuggestions('user-1', 20, 0);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WITH mutual_candidates AS'), [
        'user-1',
        20,
        0,
      ]);
      expect(result).toEqual({
        items: [
          {
            id: 'u2',
            display_name: 'Listener 2',
            username: 'listener2',
            profile_picture: 'https://img/u2.jpg',
            is_verified: true,
            follower_count: 10,
            mutual_count: 3,
            suggestion_source: 'mutual',
            is_following: false,
          },
          {
            id: 'u3',
            display_name: 'Listener 3',
            username: 'listener3',
            profile_picture: null,
            is_verified: false,
            follower_count: 0,
            mutual_count: null,
            suggestion_source: 'popular',
            is_following: false,
          },
        ],
        total: 5,
      });
    });

    it('returns empty result and zero total for no rows', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(model.getMutualFollowSuggestions('user-1', 5, 2)).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('propagates db query errors', async () => {
      db.query.mockRejectedValue(new Error('query failed'));

      await expect(model.getMutualFollowSuggestions('user-1', 20, 0)).rejects.toThrow(
        'query failed'
      );
    });
  });

  describe('getPopularUsers', () => {
    it('maps popular listeners with total count', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'u9',
            display_name: 'Popular User',
            username: 'popular_user',
            profile_picture: null,
            is_verified: false,
            followers_count: '44',
            suggestion_source: 'popular',
            total_count: '1',
          },
        ],
      });

      const result = await model.getPopularUsers('user-1', 10, 3);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*) OVER()::integer'), [
        'user-1',
        10,
        3,
      ]);
      expect(result).toEqual({
        items: [
          {
            id: 'u9',
            display_name: 'Popular User',
            username: 'popular_user',
            profile_picture: null,
            is_verified: false,
            follower_count: 44,
            mutual_count: null,
            suggestion_source: 'popular',
            is_following: false,
          },
        ],
        total: 1,
      });
    });

    it('handles invalid total_count as zero via toInt fallback', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'u10',
            display_name: 'Bad Count User',
            username: 'bad_count',
            profile_picture: null,
            is_verified: false,
            followers_count: '5',
            suggestion_source: 'popular',
            total_count: 'abc',
          },
        ],
      });

      const result = await model.getPopularUsers('user-1', 5, 0);
      expect(result.total).toBe(0);
    });

    it('throws on db failures', async () => {
      db.query.mockRejectedValue(new Error('db offline'));

      await expect(model.getPopularUsers('user-1', 5, 0)).rejects.toThrow('db offline');
    });

    it('returns zero total and empty items when no popular users are found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(model.getPopularUsers('user-1', 5, 0)).resolves.toEqual({
        items: [],
        total: 0,
      });
    });
  });

  describe('getArtistsByUserGenres', () => {
    it('maps artist rows and keeps nullable top_genre', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'a1',
            display_name: 'Artist One',
            username: 'artist_one',
            profile_picture: 'https://img/a1.jpg',
            is_verified: true,
            followers_count: '321',
            top_genre: 'Electronic',
            is_following: false,
            total_count: '2',
          },
          {
            id: 'a2',
            display_name: 'Artist Two',
            username: 'artist_two',
            profile_picture: null,
            is_verified: false,
            followers_count: '0',
            top_genre: null,
            is_following: false,
            total_count: '2',
          },
        ],
      });

      const result = await model.getArtistsByUserGenres('user-1', 50, 10);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WITH liked_genres AS'), [
        'user-1',
        50,
        10,
      ]);
      expect(result).toEqual({
        items: [
          {
            id: 'a1',
            display_name: 'Artist One',
            username: 'artist_one',
            profile_picture: 'https://img/a1.jpg',
            is_verified: true,
            follower_count: 321,
            top_genre: 'Electronic',
            is_following: false,
          },
          {
            id: 'a2',
            display_name: 'Artist Two',
            username: 'artist_two',
            profile_picture: null,
            is_verified: false,
            follower_count: 0,
            top_genre: null,
            is_following: false,
          },
        ],
        total: 2,
      });
    });

    it('filters null ids and returns zero total for empty derived result', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: null,
            total_count: null,
          },
        ],
      });

      await expect(model.getArtistsByUserGenres('user-1', 1, 0)).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('rejects on query exception', async () => {
      db.query.mockRejectedValue(new Error('bad sql'));

      await expect(model.getArtistsByUserGenres('user-1', 1, 0)).rejects.toThrow('bad sql');
    });

    it('returns zero total when query returns no rows', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(model.getArtistsByUserGenres('user-1', 25, 0)).resolves.toEqual({
        items: [],
        total: 0,
      });
    });
  });

  describe('getPopularArtists', () => {
    it('maps artists and applies default offset when omitted', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'a9',
            display_name: 'Popular Artist',
            username: 'pop_artist',
            profile_picture: null,
            is_verified: true,
            followers_count: '88',
            top_genre: 'Hip-Hop',
            is_following: false,
            total_count: '3',
          },
        ],
      });

      const result = await model.getPopularArtists('user-1', 12);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['user-1', 12, 0]);
      expect(result).toEqual({
        items: [
          {
            id: 'a9',
            display_name: 'Popular Artist',
            username: 'pop_artist',
            profile_picture: null,
            is_verified: true,
            follower_count: 88,
            top_genre: 'Hip-Hop',
            is_following: false,
          },
        ],
        total: 3,
      });
    });

    it('returns zero total for empty rows', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(model.getPopularArtists('user-1', 20, 4)).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('bubbles db errors', async () => {
      db.query.mockRejectedValue(new Error('connection lost'));

      await expect(model.getPopularArtists('user-1', 20, 0)).rejects.toThrow('connection lost');
    });

    it('normalizes undefined top_genre to null', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'a100',
            display_name: 'No Genre Artist',
            username: 'nogenre',
            profile_picture: 'https://img/a100.jpg',
            is_verified: false,
            followers_count: '7',
            top_genre: undefined,
            total_count: '1',
          },
        ],
      });

      const result = await model.getPopularArtists('user-1', 20, 0);
      expect(result.items[0].top_genre).toBeNull();
    });
  });
});
