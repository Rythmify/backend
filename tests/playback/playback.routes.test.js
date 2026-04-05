jest.mock('../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../src/services/playback.service', () => ({
  getPlayerState: jest.fn(),
  savePlayerState: jest.fn(),
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

describe('POST /api/v1/me/player/state', () => {
  it('saves player state successfully', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockResolvedValue({
      track_id: 'track-1',
      position_seconds: 14.5,
      volume: 0.6,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: 'track-1',
        position_seconds: 14.5,
        volume: 0.6,
        queue: ['track-2'],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        track_id: 'track-1',
        position_seconds: 14.5,
        volume: 0.6,
        queue: ['track-2'],
        saved_at: '2026-04-05T00:00:00.000Z',
      },
      message: 'Player state saved successfully.',
    });
    expect(playbackService.savePlayerState).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: 'track-1',
      positionSeconds: 14.5,
      volume: 0.6,
      queue: ['track-2'],
    });
  });

  it('updates existing player state if one already exists', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockResolvedValue({
      track_id: 'track-9',
      position_seconds: 87,
      volume: 0.9,
      queue: [],
      saved_at: '2026-04-05T01:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: 'track-9',
        position_seconds: 87,
        volume: 0.9,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      track_id: 'track-9',
      position_seconds: 87,
      volume: 0.9,
      queue: [],
      saved_at: '2026-04-05T01:00:00.000Z',
    });
  });

  it('rejects unauthorized access', async () => {
    const response = await request(app)
      .post('/api/v1/me/player/state')
      .send({ track_id: 'track-1', position_seconds: 5 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.savePlayerState).not.toHaveBeenCalled();
  });

  it('returns validation failure for missing required fields', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id is required.',
    });

    const response = await request(app)
      .post('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token')
      .send({ position_seconds: 5 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'track_id is required.',
      },
    });
  });

  it('returns validation failure for invalid volume outside the allowed range', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'volume must be between 0 and 1.',
    });

    const response = await request(app)
      .post('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token')
      .send({ track_id: 'track-1', position_seconds: 5, volume: 2 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'volume must be between 0 and 1.',
      },
    });
  });

  it('returns validation failure for malformed track_id UUID', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    const response = await request(app)
      .post('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token')
      .send({ track_id: 'bad-uuid', position_seconds: 5 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'track_id must be a valid UUID.',
      },
    });
  });

  it('returns TRACK_NOT_FOUND when the provided track_id does not exist', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockRejectedValue({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
      message: 'Track not found',
    });

    const response = await request(app)
      .post('/api/v1/me/player/state')
      .set('Authorization', 'Bearer valid-token')
      .send({ track_id: 'missing-track', position_seconds: 5 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'TRACK_NOT_FOUND',
        message: 'Track not found',
      },
    });
  });
});
