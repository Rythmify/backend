jest.mock('../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../src/services/tracks.service', () => ({
  uploadTrack: jest.fn(),
  getTrackById: jest.fn(),
  getTrackFanLeaderboard: jest.fn(),
  updateTrackVisibility: jest.fn(),
  getPrivateShareLink: jest.fn(),
  getMyTracks: jest.fn(),
  deleteTrack: jest.fn(),
  updateTrack: jest.fn(),
  updateTrackCoverImage: jest.fn(),
  getTrackStream: jest.fn(),
  getTrackWaveform: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { verifyToken } = require('../../src/config/jwt');
const tracksService = require('../../src/services/tracks.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/tracks/:track_id/fan-leaderboard', () => {
  it('returns the leaderboard for an anonymous requester', async () => {
    tracksService.getTrackFanLeaderboard.mockResolvedValue({
      period: 'overall',
      items: [
        {
          rank: 1,
          user: {
            id: 'fan-1',
            username: 'fan_1',
            display_name: 'Fan One',
            profile_picture: 'https://cdn.rythmify.com/avatars/fan-1.jpg',
            is_verified: false,
          },
          play_count: 9,
          last_played_at: '2026-04-09T00:00:00.000Z',
        },
      ],
    });

    const response = await request(app).get(
      '/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        period: 'overall',
        items: [
          {
            rank: 1,
            user: {
              id: 'fan-1',
              username: 'fan_1',
              display_name: 'Fan One',
              profile_picture: 'https://cdn.rythmify.com/avatars/fan-1.jpg',
              is_verified: false,
            },
            play_count: 9,
            last_played_at: '2026-04-09T00:00:00.000Z',
          },
        ],
      },
      message: 'Fan leaderboard fetched successfully.',
    });
    expect(tracksService.getTrackFanLeaderboard).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      undefined,
      null,
      null
    );
    expect(response.body.data.items[0].user).not.toHaveProperty('cover_photo');
  });

  it('passes the authenticated requester and selected period to the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    tracksService.getTrackFanLeaderboard.mockResolvedValue({
      period: 'last_7_days',
      items: [],
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard')
      .query({ period: 'last_7_days' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(tracksService.getTrackFanLeaderboard).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'last_7_days',
      'user-1',
      null
    );
  });

  it('passes secret_token through for private shared access', async () => {
    tracksService.getTrackFanLeaderboard.mockResolvedValue({
      period: 'overall',
      items: [],
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard')
      .query({ secret_token: 'secret-123' });

    expect(response.status).toBe(200);
    expect(tracksService.getTrackFanLeaderboard).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      undefined,
      null,
      'secret-123'
    );
  });

  it('returns service validation errors', async () => {
    tracksService.getTrackFanLeaderboard.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'period must be one of: overall, last_7_days.',
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard')
      .query({ period: 'top' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'period must be one of: overall, last_7_days.',
      },
    });
  });
});
