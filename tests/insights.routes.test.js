jest.mock('../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../src/services/insights.service', () => ({
  getMyInsights: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { verifyToken } = require('../src/config/jwt');
const insightsService = require('../src/services/insights.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/me/insights', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).get('/api/v1/me/insights');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(insightsService.getMyInsights).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid range', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    insightsService.getMyInsights.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'range must be one of: 7d, 30d, 12m.',
    });

    const response = await request(app)
      .get('/api/v1/me/insights')
      .query({ range: '90d' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'range must be one of: 7d, 30d, 12m.',
      },
    });
  });

  it('returns insights for the authenticated creator', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    insightsService.getMyInsights.mockResolvedValue({
      range: '30d',
      granularity: 'day',
      timezone: 'UTC',
      track_id: null,
      totals: {
        plays: 1200,
        likes: 84,
        comments: 19,
        reposts: 12,
        downloads: 0,
      },
      series: [
        {
          bucket: '2026-04-01',
          plays: 40,
          likes: 3,
          comments: 1,
          reposts: 0,
          downloads: 0,
        },
      ],
    });

    const response = await request(app)
      .get('/api/v1/me/insights')
      .query({ range: '30d', timezone: 'UTC' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        range: '30d',
        granularity: 'day',
        timezone: 'UTC',
        track_id: null,
        totals: {
          plays: 1200,
          likes: 84,
          comments: 19,
          reposts: 12,
          downloads: 0,
        },
        series: [
          {
            bucket: '2026-04-01',
            plays: 40,
            likes: 3,
            comments: 1,
            reposts: 0,
            downloads: 0,
          },
        ],
      },
      message: 'Insights fetched successfully.',
    });
    expect(insightsService.getMyInsights).toHaveBeenCalledWith({
      userId: 'user-1',
      range: '30d',
      trackId: undefined,
      timezone: 'UTC',
    });
  });
});
