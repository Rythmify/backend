jest.mock('../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../src/services/playback.service', () => ({
  playTrack: jest.fn(),
  getPlaybackState: jest.fn(),
  getPlayerState: jest.fn(),
  getRecentlyPlayed: jest.fn(),
  clearListeningHistory: jest.fn(),
  getListeningHistory: jest.fn(),
  writeListeningHistory: jest.fn(),
  savePlayerState: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { verifyToken } = require('../../src/config/jwt');
const playbackService = require('../../src/services/playback.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/v1/tracks/:track_id/play', () => {
  it('returns a playable payload for an anonymous requester', async () => {
    playbackService.playTrack.mockResolvedValue({
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'playable',
      stream_url: 'stream-url',
      preview_url: null,
      reason: null,
    });

    const response = await request(app).post(
      '/api/v1/tracks/11111111-1111-4111-8111-111111111111/play'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        track_id: '11111111-1111-4111-8111-111111111111',
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      },
      message: 'Track play resolved successfully.',
    });
    expect(playbackService.playTrack).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: null,
      secretToken: null,
    });
  });

  it('passes requester identity and secret token when present', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.playTrack.mockResolvedValue({
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'preview',
      stream_url: null,
      preview_url: 'preview-url',
      reason: 'preview_only',
    });

    const response = await request(app)
      .post('/api/v1/tracks/11111111-1111-4111-8111-111111111111/play')
      .query({ secret_token: 'secret-123' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(playbackService.playTrack).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: 'user-1',
      secretToken: 'secret-123',
    });
  });

  it('returns 202 when the track is still processing', async () => {
    playbackService.playTrack.mockRejectedValue({
      statusCode: 202,
      code: 'BUSINESS_OPERATION_NOT_ALLOWED',
      message: 'Track is still processing. Please retry shortly.',
    });

    const response = await request(app).post(
      '/api/v1/tracks/11111111-1111-4111-8111-111111111111/play'
    );

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      error: {
        code: 'BUSINESS_OPERATION_NOT_ALLOWED',
        message: 'Track is still processing. Please retry shortly.',
      },
    });
  });
});

describe('GET /api/v1/tracks/:track_id/playback-state', () => {
  it('returns playback-state data for an anonymous requester', async () => {
    playbackService.getPlaybackState.mockResolvedValue({
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'playable',
      stream_url: 'stream-url',
      preview_url: null,
      reason: null,
    });

    const response = await request(app).get(
      '/api/v1/tracks/11111111-1111-4111-8111-111111111111/playback-state'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        track_id: '11111111-1111-4111-8111-111111111111',
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      },
      message: 'Playback state fetched successfully.',
    });
    expect(playbackService.getPlaybackState).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: null,
      secretToken: null,
    });
  });

  it('passes the authenticated requester and secret token when present', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getPlaybackState.mockResolvedValue({
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'preview',
      stream_url: null,
      preview_url: 'preview-url',
      reason: 'preview_only',
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/playback-state')
      .query({ secret_token: 'secret-123' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(playbackService.getPlaybackState).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: 'user-1',
      secretToken: 'secret-123',
    });
  });

  it('returns service validation errors for malformed track ids', async () => {
    playbackService.getPlaybackState.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    const response = await request(app).get('/api/v1/tracks/not-a-uuid/playback-state');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'track_id must be a valid UUID.',
      },
    });
  });
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

describe('GET /api/v1/me/history', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).get('/api/v1/me/history');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.getRecentlyPlayed).not.toHaveBeenCalled();
  });

  it('returns an empty array when the authenticated user has no listening history', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getRecentlyPlayed.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/me/history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      message: 'Recently played fetched successfully.',
    });
    expect(playbackService.getRecentlyPlayed).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('returns recently played entries for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getRecentlyPlayed.mockResolvedValue([
      {
        track: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Latest Track',
          genre: 'Pop',
          duration: 180,
          cover_image: 'cover-1.jpg',
          user_id: 'artist-1',
          artist_name: 'DJ Nova',
          play_count: 12,
          like_count: 4,
          stream_url: 'stream-1',
          tags: ['house', 'summer'],
        },
        last_played_at: '2026-04-06T12:00:00.000Z',
      },
    ]);

    const response = await request(app)
      .get('/api/v1/me/history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          track: {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Latest Track',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'artist-1',
            artist_name: 'DJ Nova',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
            tags: ['house', 'summer'],
          },
          last_played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
      message: 'Recently played fetched successfully.',
    });
  });
});

describe('DELETE /api/v1/me/history', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).delete('/api/v1/me/history');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.clearListeningHistory).not.toHaveBeenCalled();
  });

  it('returns 204 when authenticated and history exists', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.clearListeningHistory.mockResolvedValue(3);

    const response = await request(app)
      .delete('/api/v1/me/history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(playbackService.clearListeningHistory).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('returns 204 when authenticated and history does not exist', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.clearListeningHistory.mockResolvedValue(0);

    const response = await request(app)
      .delete('/api/v1/me/history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(playbackService.clearListeningHistory).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});

describe('GET /api/v1/me/listening-history', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).get('/api/v1/me/listening-history');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.getListeningHistory).not.toHaveBeenCalled();
  });

  it('returns empty listening history with pagination when no history exists', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getListeningHistory.mockResolvedValue({
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });

    const response = await request(app)
      .get('/api/v1/me/listening-history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
      message: 'Listening history fetched successfully.',
    });
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.items).toBeUndefined();
    expect(playbackService.getListeningHistory).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: undefined,
      offset: undefined,
    });
  });

  it('returns listening history items and forwards custom pagination params', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getListeningHistory.mockResolvedValue({
      data: [
        {
          id: 'history-2',
          track: {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track Repeat',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'artist-1',
            artist_name: 'DJ Nova',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
          },
          played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
      pagination: {
        limit: 5,
        offset: 10,
        total: 53,
      },
    });

    const response = await request(app)
      .get('/api/v1/me/listening-history')
      .query({ limit: '5', offset: '10' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: 'history-2',
          track: {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track Repeat',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'artist-1',
            artist_name: 'DJ Nova',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
          },
          played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
      pagination: {
        limit: 5,
        offset: 10,
        total: 53,
      },
      message: 'Listening history fetched successfully.',
    });
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.items).toBeUndefined();
    expect(playbackService.getListeningHistory).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: '5',
      offset: '10',
    });
  });
});

describe('POST /api/v1/me/listening-history', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).post('/api/v1/me/listening-history');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.writeListeningHistory).not.toHaveBeenCalled();
  });

  it('returns 201 when a valid new listening history entry is created', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.writeListeningHistory.mockResolvedValue({
      created: true,
      data: { success: true },
      message: 'Listening history entry recorded.',
    });

    const response = await request(app)
      .post('/api/v1/me/listening-history')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: '11111111-1111-4111-8111-111111111111',
        played_at: '2026-04-06T12:00:00.000Z',
        duration_played_seconds: 180,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        success: true,
      },
      message: 'Listening history entry recorded.',
    });
    expect(playbackService.writeListeningHistory).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: '11111111-1111-4111-8111-111111111111',
      playedAt: '2026-04-06T12:00:00.000Z',
      durationPlayedSeconds: 180,
    });
  });

  it('returns 200 when the request is deduplicated', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.writeListeningHistory.mockResolvedValue({
      created: false,
      data: { success: true },
      message: 'Listening history entry already recorded recently.',
    });

    const response = await request(app)
      .post('/api/v1/me/listening-history')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: '11111111-1111-4111-8111-111111111111',
        played_at: '2026-04-06T12:00:00.000Z',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        success: true,
      },
      message: 'Listening history entry already recorded recently.',
    });
  });

  it('returns validation errors from the service for invalid payloads', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.writeListeningHistory.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id is required.',
    });

    const response = await request(app)
      .post('/api/v1/me/listening-history')
      .set('Authorization', 'Bearer valid-token')
      .send({ played_at: '2026-04-06T12:00:00.000Z' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'track_id is required.',
      },
    });
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
