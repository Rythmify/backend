jest.mock('../../../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../../../src/config/db');
const genreModel = require('../../../src/models/genre.model');

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

describe('genreModel.findGenreDetail', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns genre detail with aggregate counts', async () => {
    const row = {
      id: 'genre-1',
      name: 'Pop',
      cover_image: null,
      track_count: 3,
      artist_count: 2,
    };
    db.query.mockResolvedValue({ rows: [row] });

    await expect(genreModel.findGenreDetail('genre-1')).resolves.toEqual(row);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('COUNT(DISTINCT t.id)');
    expect(sql).toContain('COUNT(DISTINCT t.user_id)');
    expect(sql).toContain('LEFT JOIN tracks t');
    expect(sql).toContain('t.is_public  = true');
    expect(sql).toContain('t.is_hidden  = false');
    expect(sql).toContain("t.status     = 'ready'");
    expect(sql).toContain('WHERE  g.id = $1');
    expect(params).toEqual(['genre-1']);
  });

  it('returns null when no genre detail exists', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await expect(genreModel.findGenreDetail('missing-genre')).resolves.toBeNull();
  });
});
