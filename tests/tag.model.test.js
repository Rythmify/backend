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

describe('tagModel.findByName', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns tag row when tag exists', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'tag-1', name: 'chill' }],
    });

    const result = await tagModel.findByName('chill');

    expect(result).toEqual({
      id: 'tag-1',
      name: 'chill',
    });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('SELECT id::text AS id, name');
    expect(sql).toContain('FROM tags');
    expect(sql).toContain('WHERE LOWER(name) = LOWER($1)');
    expect(sql).toContain('LIMIT 1');

    expect(params).toEqual(['chill']);
  });

  it('returns null when tag does not exist', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tagModel.findByName('unknown');

    expect(result).toBeNull();
  });
});

describe('tagModel.findByIds', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns empty array when tagIds is empty', async () => {
    const result = await tagModel.findByIds([]);

    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('deduplicates ids and preserves input order in returned rows', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 'tag-2', name: 'ambient' },
        { id: 'tag-1', name: 'chill' },
      ],
    });

    const result = await tagModel.findByIds(['tag-1', 'tag-2', 'tag-1']);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('WHERE id::text = ANY($1::text[])');
    expect(params).toEqual([['tag-1', 'tag-2']]);

    expect(result).toEqual([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);
  });

  it('filters out ids that are not returned by the query', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'tag-1', name: 'chill' }],
    });

    const result = await tagModel.findByIds(['tag-1', 'tag-2']);

    expect(result).toEqual([{ id: 'tag-1', name: 'chill' }]);
  });
});

describe('tagModel.getAllTags', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns all tags ordered by name', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 'tag-1', name: 'ambient' },
        { id: 'tag-2', name: 'chill' },
      ],
    });

    const result = await tagModel.getAllTags();

    expect(result).toEqual([
      { id: 'tag-1', name: 'ambient' },
      { id: 'tag-2', name: 'chill' },
    ]);

    const [sql] = db.query.mock.calls[0];

    expect(sql).toContain('SELECT id::text AS id, name');
    expect(sql).toContain('FROM tags');
    expect(sql).toContain('ORDER BY name ASC');
  });
});
