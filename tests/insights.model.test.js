jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../src/config/db');
const insightsModel = require('../src/models/insights.model');

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRACK_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('insightsModel.findOwnedTrackById', () => {
  it('returns an owned, non-deleted track row', async () => {
    db.query.mockResolvedValue({ rows: [{ id: TRACK_ID }] });

    const result = await insightsModel.findOwnedTrackById({
      userId: USER_ID,
      trackId: TRACK_ID,
    });

    expect(result).toEqual({ id: TRACK_ID });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM tracks'), [
      TRACK_ID,
      USER_ID,
    ]);

    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('id = $1');
    expect(sql).toContain('user_id = $2');
    expect(sql).toContain('deleted_at IS NULL');
  });
});

describe('insightsModel.getCreatorInsights', () => {
  it('maps empty data as zero-filled daily buckets', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          bucket: '2026-04-29',
          plays: 0,
          likes: 0,
          comments: 0,
          reposts: 0,
          downloads: 0,
        },
        {
          bucket: '2026-04-30',
          plays: 0,
          likes: 0,
          comments: 0,
          reposts: 0,
          downloads: 0,
        },
      ],
    });

    const result = await insightsModel.getCreatorInsights({
      userId: USER_ID,
      trackId: null,
      granularity: 'day',
      bucketCount: 30,
      timezone: 'UTC',
    });

    expect(result).toEqual({
      totals: {
        plays: 0,
        likes: 0,
        comments: 0,
        reposts: 0,
        downloads: 0,
      },
      series: [
        {
          bucket: '2026-04-29',
          plays: 0,
          likes: 0,
          comments: 0,
          reposts: 0,
          downloads: 0,
        },
        {
          bucket: '2026-04-30',
          plays: 0,
          likes: 0,
          comments: 0,
          reposts: 0,
          downloads: 0,
        },
      ],
    });
  });

  it('builds 7d and 30d daily aggregation over owned tracks', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await insightsModel.getCreatorInsights({
      userId: USER_ID,
      trackId: TRACK_ID,
      granularity: 'day',
      bucketCount: 7,
      timezone: 'UTC',
    });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('generate_series');
    expect(sql).toContain("INTERVAL '1 day'");
    expect(sql).toContain("date_trunc('day'");
    expect(sql).toContain('FROM listening_history lh');
    expect(sql).toContain('FROM track_likes tl');
    expect(sql).toContain('FROM comments c');
    expect(sql).toContain('FROM track_reposts tr');
    expect(sql).toContain('0::int AS downloads');
    expect(sql).toContain('t.user_id = params.user_id');
    expect(sql).toContain('params.track_id IS NULL OR t.id = params.track_id');
    expect(params).toEqual([USER_ID, TRACK_ID, 'UTC', 7, 'day']);

    await insightsModel.getCreatorInsights({
      userId: USER_ID,
      trackId: null,
      granularity: 'day',
      bucketCount: 30,
      timezone: 'UTC',
    });

    expect(db.query.mock.calls[1][1]).toEqual([USER_ID, null, 'UTC', 30, 'day']);
  });

  it('builds 12m monthly aggregation and totals returned rows', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          bucket: '2026-03',
          plays: '10',
          likes: '3',
          comments: '2',
          reposts: '1',
          downloads: '0',
        },
        {
          bucket: '2026-04',
          plays: '7',
          likes: '4',
          comments: '0',
          reposts: '2',
          downloads: '0',
        },
      ],
    });

    const result = await insightsModel.getCreatorInsights({
      userId: USER_ID,
      trackId: null,
      granularity: 'month',
      bucketCount: 12,
      timezone: 'Africa/Cairo',
    });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("INTERVAL '1 month'");
    expect(sql).toContain("date_trunc('month'");
    expect(params).toEqual([USER_ID, null, 'Africa/Cairo', 12, 'month']);
    expect(result).toEqual({
      totals: {
        plays: 17,
        likes: 7,
        comments: 2,
        reposts: 3,
        downloads: 0,
      },
      series: [
        {
          bucket: '2026-03',
          plays: 10,
          likes: 3,
          comments: 2,
          reposts: 1,
          downloads: 0,
        },
        {
          bucket: '2026-04',
          plays: 7,
          likes: 4,
          comments: 0,
          reposts: 2,
          downloads: 0,
        },
      ],
    });
  });
});
