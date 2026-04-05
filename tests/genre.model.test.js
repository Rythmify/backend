jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../src/config/db');
const genreModel = require('../src/models/genre.model');

describe('genreModel.getAllGenres', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns all genres ordered by name', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 'genre-1', name: 'Pop' },
        { id: 'genre-2', name: 'Rock' },
      ],
    });

    const result = await genreModel.getAllGenres();

    expect(result).toEqual([
      { id: 'genre-1', name: 'Pop' },
      { id: 'genre-2', name: 'Rock' },
    ]);

    const [sql] = db.query.mock.calls[0];

    expect(sql).toContain('SELECT id::text AS id, name');
    expect(sql).toContain('FROM genres');
    expect(sql).toContain('ORDER BY name ASC');
  });
});