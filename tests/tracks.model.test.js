jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../src/config/db');
const tracksModel = require('../src/models/track.model.js');

describe('tracksModel.updateTrackFields', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns null when no allowed update fields are provided', async () => {
    const result = await tracksModel.updateTrackFields('track-1', {
      unknown_field: 'x',
    });

    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('updates allowed fields and stringifies geo_regions', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1', title: 'New Title' }],
    });

    const result = await tracksModel.updateTrackFields('track-1', {
      title: 'New Title',
      description: 'New Description',
      geo_regions: ['EG', 'SA'],
    });

    expect(result).toEqual({
      id: 'track-1',
      title: 'New Title',
    });

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('UPDATE tracks');
    expect(sql).toContain('"title" = $2');
    expect(sql).toContain('"description" = $3');
    expect(sql).toContain('"geo_regions" = $4');
    expect(sql).toContain('WHERE id = $1 AND deleted_at IS NULL');

    expect(params).toEqual([
      'track-1',
      'New Title',
      'New Description',
      JSON.stringify(['EG', 'SA']),
    ]);
  });
});

describe('tracksModel.replaceTrackTags', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('deletes old track tags and inserts the new ones', async () => {
    db.query.mockResolvedValue({});

    await tracksModel.replaceTrackTags('track-1', ['tag-1', 'tag-2']);

    expect(db.query).toHaveBeenCalledTimes(3);

    expect(db.query).toHaveBeenNthCalledWith(1, 'DELETE FROM track_tags WHERE track_id = $1', [
      'track-1',
    ]);

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2)',
      ['track-1', 'tag-1']
    );

    expect(db.query).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2)',
      ['track-1', 'tag-2']
    );
  });

  it('only deletes old tags when new tagIds is empty', async () => {
    db.query.mockResolvedValue({});

    await tracksModel.replaceTrackTags('track-1', []);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith('DELETE FROM track_tags WHERE track_id = $1', [
      'track-1',
    ]);
  });
});

describe('tracksModel.findMyTracks', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns items and total without status filter', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'track-1', title: 'Track One' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
      });

    const result = await tracksModel.findMyTracks('user-1', {
      limit: 10,
      offset: 20,
      status: null,
    });

    expect(result).toEqual({
      items: [{ id: 'track-1', title: 'Track One' }],
      total: 1,
    });

    expect(db.query).toHaveBeenCalledTimes(2);

    const [itemsSql, itemsParams] = db.query.mock.calls[0];
    const [countSql, countParams] = db.query.mock.calls[1];

    expect(itemsSql).toContain('WHERE t.user_id = $1 AND t.deleted_at IS NULL');
    expect(itemsSql).toContain('LIMIT $2 OFFSET $3');
    expect(itemsParams).toEqual(['user-1', 10, 20]);

    expect(countSql).toContain('WHERE t.user_id = $1 AND t.deleted_at IS NULL');
    expect(countParams).toEqual(['user-1']);
  });

  it('adds status filter to both queries when status is provided', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'track-1', title: 'Ready Track', status: 'ready' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
      });

    const result = await tracksModel.findMyTracks('user-1', {
      limit: 10,
      offset: 0,
      status: 'ready',
    });

    expect(result).toEqual({
      items: [{ id: 'track-1', title: 'Ready Track', status: 'ready' }],
      total: 1,
    });

    expect(db.query).toHaveBeenCalledTimes(2);

    const [itemsSql, itemsParams] = db.query.mock.calls[0];
    const [countSql, countParams] = db.query.mock.calls[1];

    expect(itemsSql).toContain('t.status = $2');
    expect(itemsSql).toContain('LIMIT $3 OFFSET $4');
    expect(itemsParams).toEqual(['user-1', 'ready', 10, 0]);

    expect(countSql).toContain('t.status = $2');
    expect(countParams).toEqual(['user-1', 'ready']);
  });
});
