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
  syncPlayback: jest.fn(),
  savePlayerState: jest.fn(),
  addToNextUp: jest.fn(),
  addQueueContext: jest.fn(),
  reorderPlayerQueue: jest.fn(),
  clearPlayerQueue: jest.fn(),
  removeQueueItem: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { verifyToken } = require('../../src/config/jwt');
const playbackService = require('../../src/services/playback.service');

const queueItem = {
  queue_item_id: '55555555-5555-4555-8555-555555555555',
  track_id: '22222222-2222-4222-8222-222222222222',
  queue_bucket: 'next_up',
  source_type: 'track',
  source_id: null,
  source_title: null,
  source_position: null,
  added_at: '2026-04-18T20:00:00.000Z',
};

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
      queue: [queueItem],
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
        queue: [queueItem],
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
    playbackService.getRecentlyPlayed.mockResolvedValue({
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });

    const response = await request(app)
      .get('/api/v1/me/history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      message: 'Recently played fetched successfully.',
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });
    expect(playbackService.getRecentlyPlayed).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: undefined,
      offset: undefined,
    });
  });

  it('returns recently played entries for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getRecentlyPlayed.mockResolvedValue({
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
            audio_url: 'audio-1',
            tags: ['house', 'summer'],
            is_liked_by_me: true,
            is_reposted_by_me: false,
            is_artist_followed_by_me: true,
          },
          last_played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
      pagination: {
        limit: 20,
        offset: 0,
        total: 57,
      },
    });

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
            audio_url: 'audio-1',
            tags: ['house', 'summer'],
            is_liked_by_me: true,
            is_reposted_by_me: false,
            is_artist_followed_by_me: true,
          },
          last_played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
      message: 'Recently played fetched successfully.',
      pagination: {
        limit: 20,
        offset: 0,
        total: 57,
      },
    });
  });

  it('forwards custom recently played limit and offset query params', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.getRecentlyPlayed.mockResolvedValue({
      data: [],
      pagination: {
        limit: 10,
        offset: 20,
        total: 57,
      },
    });

    const response = await request(app)
      .get('/api/v1/me/history')
      .query({ limit: 10, offset: 20 })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      message: 'Recently played fetched successfully.',
      pagination: {
        limit: 10,
        offset: 20,
        total: 57,
      },
    });
    expect(playbackService.getRecentlyPlayed).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: '10',
      offset: '20',
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
            audio_url: 'audio-1',
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
            audio_url: 'audio-1',
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

describe('POST /api/v1/me/playback/sync', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).post('/api/v1/me/playback/sync');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.syncPlayback).not.toHaveBeenCalled();
  });

  it('syncs history events and player state for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.syncPlayback.mockResolvedValue({
      history_events_received: 1,
      history_events_recorded: 1,
      history_events_deduplicated: 0,
      current_state_saved: true,
      current_state_ignored_as_stale: false,
      current_state: {
        track_id: '22222222-2222-4222-8222-222222222222',
        position_seconds: 42.5,
        volume: 0.75,
        queue: [],
        saved_at: '2026-04-06T12:05:00.000Z',
      },
    });

    const response = await request(app)
      .post('/api/v1/me/playback/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({
        history_events: [
          {
            track_id: '11111111-1111-4111-8111-111111111111',
            played_at: '2026-04-06T12:00:00.000Z',
            duration_played_seconds: 180,
          },
        ],
        current_state: {
          track_id: '22222222-2222-4222-8222-222222222222',
          position_seconds: 42.5,
          volume: 0.75,
          queue: [],
          state_updated_at: '2026-04-06T12:05:00.000Z',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        history_events_received: 1,
        history_events_recorded: 1,
        history_events_deduplicated: 0,
        current_state_saved: true,
        current_state_ignored_as_stale: false,
        current_state: {
          track_id: '22222222-2222-4222-8222-222222222222',
          position_seconds: 42.5,
          volume: 0.75,
          queue: [],
          saved_at: '2026-04-06T12:05:00.000Z',
        },
      },
      message: 'Playback sync completed successfully.',
    });
    expect(playbackService.syncPlayback).toHaveBeenCalledWith({
      userId: 'user-1',
      historyEvents: [
        {
          track_id: '11111111-1111-4111-8111-111111111111',
          played_at: '2026-04-06T12:00:00.000Z',
          duration_played_seconds: 180,
        },
      ],
      currentState: {
        track_id: '22222222-2222-4222-8222-222222222222',
        position_seconds: 42.5,
        volume: 0.75,
        queue: [],
        state_updated_at: '2026-04-06T12:05:00.000Z',
      },
    });
  });

  it('returns stale player-state sync results when the incoming state is older', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.syncPlayback.mockResolvedValue({
      history_events_received: 0,
      history_events_recorded: 0,
      history_events_deduplicated: 0,
      current_state_saved: false,
      current_state_ignored_as_stale: true,
      current_state: {
        track_id: '33333333-3333-4333-8333-333333333333',
        position_seconds: 99,
        volume: 0.5,
        queue: [],
        saved_at: '2026-04-06T12:10:00.000Z',
      },
    });

    const response = await request(app)
      .post('/api/v1/me/playback/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({
        current_state: {
          track_id: '22222222-2222-4222-8222-222222222222',
          position_seconds: 42.5,
          state_updated_at: '2026-04-06T12:05:00.000Z',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        history_events_received: 0,
        history_events_recorded: 0,
        history_events_deduplicated: 0,
        current_state_saved: false,
        current_state_ignored_as_stale: true,
        current_state: {
          track_id: '33333333-3333-4333-8333-333333333333',
          position_seconds: 99,
          volume: 0.5,
          queue: [],
          saved_at: '2026-04-06T12:10:00.000Z',
        },
      },
      message: 'Playback sync completed successfully.',
    });
  });

  it('returns validation errors from the service for invalid sync payloads', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.syncPlayback.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'At least one of history_events or current_state must be provided.',
    });

    const response = await request(app)
      .post('/api/v1/me/playback/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'At least one of history_events or current_state must be provided.',
      },
    });
  });

  it('does not expose the removed write-listening-history endpoint', async () => {
    const response = await request(app)
      .post('/api/v1/me/listening-history')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
    expect(playbackService.syncPlayback).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/me/player/state', () => {
  it('saves player state successfully', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.savePlayerState.mockResolvedValue({
      track_id: 'track-1',
      position_seconds: 14.5,
      volume: 0.6,
      queue: [queueItem],
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
        queue: [queueItem],
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

describe('POST /api/v1/me/player/queue/next-up', () => {
  it('returns the updated queue for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.addToNextUp.mockResolvedValue({
      queue: [queueItem],
    });

    const response = await request(app)
      .post('/api/v1/me/player/queue/next-up')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: '22222222-2222-4222-8222-222222222222',
        insert_after_queue_item_id: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        queue: [queueItem],
      },
      message: 'Queue updated successfully.',
    });
    expect(playbackService.addToNextUp).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: '22222222-2222-4222-8222-222222222222',
      insertAfterQueueItemId: '55555555-5555-4555-8555-555555555555',
    });
  });

  it('rejects unauthorized access', async () => {
    const response = await request(app)
      .post('/api/v1/me/player/queue/next-up')
      .send({ track_id: '22222222-2222-4222-8222-222222222222' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.addToNextUp).not.toHaveBeenCalled();
  });

  it('returns validation errors from the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.addToNextUp.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'insert_after_queue_item_id must be a valid UUID.',
    });

    const response = await request(app)
      .post('/api/v1/me/player/queue/next-up')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: '22222222-2222-4222-8222-222222222222',
        insert_after_queue_item_id: 'bad-anchor',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'insert_after_queue_item_id must be a valid UUID.',
      },
    });
  });

  it('returns queue-item not found errors from the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.addToNextUp.mockRejectedValue({
      statusCode: 404,
      code: 'QUEUE_ITEM_NOT_FOUND',
      message: 'Queue item not found.',
    });

    const response = await request(app)
      .post('/api/v1/me/player/queue/next-up')
      .set('Authorization', 'Bearer valid-token')
      .send({
        track_id: '22222222-2222-4222-8222-222222222222',
        insert_after_queue_item_id: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'QUEUE_ITEM_NOT_FOUND',
        message: 'Queue item not found.',
      },
    });
  });
});

describe('POST /api/v1/me/player/queue/context', () => {
  it('returns the updated player state for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: '15151515-1515-4515-8515-151515151515' });
    playbackService.addQueueContext.mockResolvedValue({
      track_id: '22222222-2222-4222-8222-222222222222',
      position_seconds: 0,
      volume: 0.7,
      queue: [queueItem],
      saved_at: '2026-04-19T00:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/v1/me/player/queue/context')
      .set('Authorization', 'Bearer valid-token')
      .send({
        interaction_type: 'play',
        source_type: 'playlist',
        source_id: '44444444-4444-4444-8444-444444444444',
        target_user_id: null,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        track_id: '22222222-2222-4222-8222-222222222222',
        position_seconds: 0,
        volume: 0.7,
        queue: [queueItem],
        saved_at: '2026-04-19T00:00:00.000Z',
      },
      message: 'Player state updated successfully.',
    });
    expect(playbackService.addQueueContext).toHaveBeenCalledWith({
      userId: '15151515-1515-4515-8515-151515151515',
      interactionType: 'play',
      sourceType: 'playlist',
      sourceId: '44444444-4444-4444-8444-444444444444',
      targetUserId: null,
    });
  });

  it('rejects unauthorized access', async () => {
    const response = await request(app).post('/api/v1/me/player/queue/context').send({
      interaction_type: 'next_up',
      source_type: 'mix',
      source_id: 'mix_genre_16161616-1616-4616-8616-161616161616',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.addQueueContext).not.toHaveBeenCalled();
  });

  it('returns service validation errors', async () => {
    verifyToken.mockReturnValue({ sub: '15151515-1515-4515-8515-151515151515' });
    playbackService.addQueueContext.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'interaction_type is required.',
    });

    const response = await request(app)
      .post('/api/v1/me/player/queue/context')
      .set('Authorization', 'Bearer valid-token')
      .send({
        source_type: 'playlist',
        source_id: '44444444-4444-4444-8444-444444444444',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'interaction_type is required.',
      },
    });
  });
});

describe('PATCH /api/v1/me/player/queue', () => {
  it('returns the reordered queue for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.reorderPlayerQueue.mockResolvedValue({
      queue: [queueItem],
    });

    const response = await request(app)
      .patch('/api/v1/me/player/queue')
      .set('Authorization', 'Bearer valid-token')
      .send({
        items: [
          {
            queue_item_id: '66666666-6666-4666-8666-666666666666',
            position: 1,
          },
          {
            queue_item_id: '55555555-5555-4555-8555-555555555555',
            position: 2,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        queue: [queueItem],
      },
      message: 'Queue updated successfully.',
    });
    expect(playbackService.reorderPlayerQueue).toHaveBeenCalledWith({
      userId: 'user-1',
      reorderRequest: {
        items: [
          {
            queue_item_id: '66666666-6666-4666-8666-666666666666',
            position: 1,
          },
          {
            queue_item_id: '55555555-5555-4555-8555-555555555555',
            position: 2,
          },
        ],
      },
    });
  });

  it('rejects unauthorized access', async () => {
    const response = await request(app)
      .patch('/api/v1/me/player/queue')
      .send({
        items: [
          {
            queue_item_id: '55555555-5555-4555-8555-555555555555',
            position: 1,
          },
        ],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.reorderPlayerQueue).not.toHaveBeenCalled();
  });

  it('returns validation errors from the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.reorderPlayerQueue.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'queue_item_id must be a valid UUID.',
    });

    const response = await request(app)
      .patch('/api/v1/me/player/queue')
      .set('Authorization', 'Bearer valid-token')
      .send({
        items: [
          {
            queue_item_id: 'not-a-uuid',
            position: 1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'queue_item_id must be a valid UUID.',
      },
    });
  });

  it('returns queue-not-found errors from the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.reorderPlayerQueue.mockRejectedValue({
      statusCode: 404,
      code: 'QUEUE_NOT_FOUND',
      message: 'Queue not found.',
    });

    const response = await request(app)
      .patch('/api/v1/me/player/queue')
      .set('Authorization', 'Bearer valid-token')
      .send({
        items: [
          {
            queue_item_id: '55555555-5555-4555-8555-555555555555',
            position: 1,
          },
        ],
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'QUEUE_NOT_FOUND',
        message: 'Queue not found.',
      },
    });
  });
});

describe('DELETE /api/v1/me/player/queue/items/:queue_item_id', () => {
  it('returns the updated queue for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.removeQueueItem.mockResolvedValue({
      queue: [queueItem],
    });

    const response = await request(app)
      .delete('/api/v1/me/player/queue/items/55555555-5555-4555-8555-555555555555')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        queue: [queueItem],
      },
      message: 'Queue updated successfully.',
    });
    expect(playbackService.removeQueueItem).toHaveBeenCalledWith({
      userId: 'user-1',
      queueItemId: '55555555-5555-4555-8555-555555555555',
    });
  });

  it('rejects unauthorized access', async () => {
    const response = await request(app).delete(
      '/api/v1/me/player/queue/items/55555555-5555-4555-8555-555555555555'
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.removeQueueItem).not.toHaveBeenCalled();
  });

  it('returns validation errors from the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.removeQueueItem.mockRejectedValue({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'queue_item_id must be a valid UUID.',
    });

    const response = await request(app)
      .delete('/api/v1/me/player/queue/items/not-a-uuid')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'queue_item_id must be a valid UUID.',
      },
    });
  });

  it('returns queue-item not found errors from the service', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.removeQueueItem.mockRejectedValue({
      statusCode: 404,
      code: 'QUEUE_ITEM_NOT_FOUND',
      message: 'Queue item not found.',
    });

    const response = await request(app)
      .delete('/api/v1/me/player/queue/items/55555555-5555-4555-8555-555555555555')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'QUEUE_ITEM_NOT_FOUND',
        message: 'Queue item not found.',
      },
    });
  });
});

describe('DELETE /api/v1/me/player/queue', () => {
  it('returns an empty queue for an authenticated user', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    playbackService.clearPlayerQueue.mockResolvedValue({
      queue: [],
    });

    const response = await request(app)
      .delete('/api/v1/me/player/queue')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        queue: [],
      },
      message: 'Queue cleared successfully.',
    });
    expect(playbackService.clearPlayerQueue).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('rejects unauthorized access', async () => {
    const response = await request(app).delete('/api/v1/me/player/queue');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(playbackService.clearPlayerQueue).not.toHaveBeenCalled();
  });
});
