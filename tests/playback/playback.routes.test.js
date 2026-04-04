jest.mock('../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../src/services/playback.service', () => ({
  getPlayerState: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { verifyToken } = require('../../src/config/jwt');
const playbackService = require('../../src/services/playback.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/me/player/state', () => {
  it('returns saved player state for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getPlayerState.mockResolvedValue({
      track_id: 'track-1',
      position_seconds: 8.5,
      volume: 0.75,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    });

    const response = await request(app)
      .get('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        track_id: 'track-1',
        position_seconds: 8.5,
        volume: 0.75,
        queue: ['track-2'],
        saved_at: '2026-04-05T00:00:00.000Z',
      },
      message: 'Player state fetched successfully.',
    });
    expect(playbackService.getPlayerState).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('returns data null when no saved state exists', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getPlayerState.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: null,
      message: 'Player state fetched successfully.',
    });
  });

  it('returns unauthorized when the authorization header is missing', async () => {
    const response = await request(app).get('/api/v1/me/player/state');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.getPlayerState).not.toHaveBeenCalled();
  });
});
