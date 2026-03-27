// tests/tag.model.test.js
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../src/config/db');
const tagModel = require('../src/models/tag.model');

describe('tagModel.findByNames', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('normalizes, deduplicates, and queries lowercase tag names', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 'tag-1', name: 'ambient' },
        { id: 'tag-2', name: 'chill' },
      ],
    });

    const result = await tagModel.findByNames([' Chill ', 'ambient', 'CHILL']);

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('FROM tags');
    expect(sql).toContain('WHERE LOWER(name) = ANY($1::text[])');
    expect(sql).toContain('ORDER BY name ASC');

    expect(params).toEqual([['chill', 'ambient']]);

    expect(result).toEqual([
      { id: 'tag-1', name: 'ambient' },
      { id: 'tag-2', name: 'chill' },
    ]);
  });

  it('returns empty array and does not query when normalized input is empty', async () => {
    const result = await tagModel.findByNames([]);

    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });
});
