jest.mock('../../../src/models/insights.model', () => ({
  findOwnedTrackById: jest.fn(),
  getCreatorInsights: jest.fn(),
}));

const insightsModel = require('../../../src/models/insights.model');
const insightsService = require('../../../src/services/insights.service');

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRACK_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.resetAllMocks();
  insightsModel.getCreatorInsights.mockResolvedValue({
    totals: {
      plays: 0,
      likes: 0,
      comments: 0,
      reposts: 0,
      downloads: 0,
    },
    series: [],
  });
});

describe('insightsService.getMyInsights', () => {
  it('defaults to 30d, UTC, all owned tracks', async () => {
    const result = await insightsService.getMyInsights({ userId: USER_ID });

    expect(result).toEqual({
      range: '30d',
      granularity: 'day',
      timezone: 'UTC',
      track_id: null,
      totals: {
        plays: 0,
        likes: 0,
        comments: 0,
        reposts: 0,
        downloads: 0,
      },
      series: [],
    });
    expect(insightsModel.findOwnedTrackById).not.toHaveBeenCalled();
    expect(insightsModel.getCreatorInsights).toHaveBeenCalledWith({
      userId: USER_ID,
      trackId: null,
      granularity: 'day',
      bucketCount: 30,
      timezone: 'UTC',
    });
  });

  it('rejects invalid range values', async () => {
    await expect(
      insightsService.getMyInsights({ userId: USER_ID, range: '90d' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'range must be one of: 7d, 30d, 12m.',
    });

    expect(insightsModel.getCreatorInsights).not.toHaveBeenCalled();
  });

  it('rejects invalid track_id values', async () => {
    await expect(
      insightsService.getMyInsights({ userId: USER_ID, trackId: 'not-a-uuid' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(insightsModel.findOwnedTrackById).not.toHaveBeenCalled();
    expect(insightsModel.getCreatorInsights).not.toHaveBeenCalled();
  });

  it("rejects another artist's track insights", async () => {
    insightsModel.findOwnedTrackById.mockResolvedValue(null);

    await expect(
      insightsService.getMyInsights({ userId: USER_ID, trackId: TRACK_ID })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_DENIED',
      message: 'You are not allowed to access insights for this track.',
    });

    expect(insightsModel.findOwnedTrackById).toHaveBeenCalledWith({
      userId: USER_ID,
      trackId: TRACK_ID,
    });
    expect(insightsModel.getCreatorInsights).not.toHaveBeenCalled();
  });

  it('uses 7 daily buckets for 7d', async () => {
    await insightsService.getMyInsights({ userId: USER_ID, range: '7d' });

    expect(insightsModel.getCreatorInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        granularity: 'day',
        bucketCount: 7,
      })
    );
  });

  it('uses 12 monthly buckets for 12m', async () => {
    await insightsService.getMyInsights({
      userId: USER_ID,
      range: '12m',
      timezone: 'Africa/Cairo',
    });

    expect(insightsModel.getCreatorInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        granularity: 'month',
        bucketCount: 12,
        timezone: 'Africa/Cairo',
      })
    );
  });
});
