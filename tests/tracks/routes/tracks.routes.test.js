jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../../src/services/tracks.service', () => ({
  uploadTrack: jest.fn(),
  getTrackById: jest.fn(),
  getTrackFanLeaderboard: jest.fn(),
  updateTrackVisibility: jest.fn(),
  getPrivateShareLink: jest.fn(),
  getMyTracks: jest.fn(),
  deleteTrack: jest.fn(),
  updateTrack: jest.fn(),
  updateTrackCoverImage: jest.fn(),
  replaceTrackAudio: jest.fn(),
  getTrackStream: jest.fn(),
  getTrackOfflineDownload: jest.fn(),
  getTrackWaveform: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../app');
const { verifyToken } = require('../../../src/config/jwt');
const tracksService = require('../../../src/services/tracks.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/v1/tracks', () => {
  it('uploads a track with audio and cover image', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    tracksService.uploadTrack.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Covered Track',
      audio_url: 'https://cdn.example.com/audio.mp3',
      cover_image: 'https://cdn.example.com/cover.jpg',
      status: 'processing',
    });

    const response = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', 'Bearer valid-token')
      .field('title', 'Covered Track')
      .attach('audio_file', Buffer.from('audio'), {
        filename: 'song.mp3',
        contentType: 'audio/mpeg',
      })
      .attach('cover_image', Buffer.from('image'), {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(tracksService.uploadTrack).toHaveBeenCalledWith({
      user: expect.objectContaining({ sub: 'user-1' }),
      audioFile: expect.objectContaining({
        originalname: 'song.mp3',
        mimetype: 'audio/mpeg',
      }),
      coverImageFile: expect.objectContaining({
        originalname: 'cover.jpg',
        mimetype: 'image/jpeg',
      }),
      body: expect.objectContaining({ title: 'Covered Track' }),
    });
    expect(response.body).toEqual({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Covered Track',
        audio_url: 'https://cdn.example.com/audio.mp3',
        cover_image: 'https://cdn.example.com/cover.jpg',
        status: 'processing',
      },
      message: 'Track created and queued for processing.',
    });
  });

  it('uploads a track with audio only and no cover image', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    tracksService.uploadTrack.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Audio Only Track',
      audio_url: 'https://cdn.example.com/audio-only.mp3',
      cover_image: null,
      status: 'processing',
    });

    const response = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', 'Bearer valid-token')
      .field('title', 'Audio Only Track')
      .attach('audio_file', Buffer.from('audio'), {
        filename: 'song.mp3',
        contentType: 'audio/mpeg',
      });

    expect(response.status).toBe(201);
    expect(tracksService.uploadTrack).toHaveBeenCalledWith({
      user: expect.objectContaining({ sub: 'user-1' }),
      audioFile: expect.objectContaining({
        originalname: 'song.mp3',
        mimetype: 'audio/mpeg',
      }),
      coverImageFile: null,
      body: expect.objectContaining({ title: 'Audio Only Track' }),
    });
    expect(response.body).toEqual({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Audio Only Track',
        audio_url: 'https://cdn.example.com/audio-only.mp3',
        cover_image: null,
        status: 'processing',
      },
      message: 'Track created and queued for processing.',
    });
  });

  it('returns 400 when audio_file is missing', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });

    const response = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', 'Bearer valid-token')
      .field('title', 'Missing Audio');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Audio file is required',
      },
    });
    expect(tracksService.uploadTrack).not.toHaveBeenCalled();
  });

  it('rejects an invalid cover image only when cover_image is provided', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });

    const response = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', 'Bearer valid-token')
      .field('title', 'Invalid Cover')
      .attach('audio_file', Buffer.from('audio'), {
        filename: 'song.mp3',
        contentType: 'audio/mpeg',
      })
      .attach('cover_image', Buffer.from('not-an-image'), {
        filename: 'cover.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      error: {
        code: 'UPLOAD_INVALID_FILE_TYPE',
        message: 'Unsupported file format. Accepted formats are JPEG, PNG, and WEBP.',
      },
    });
    expect(tracksService.uploadTrack).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/tracks/me', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const response = await request(app).get('/api/v1/tracks/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(tracksService.getMyTracks).not.toHaveBeenCalled();
  });

  it('returns the authenticated user track list with is_liked_by_me preserved', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    tracksService.getMyTracks.mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Owned Track',
          user_id: 'user-1',
          artist_name: 'DJ Nova',
          comment_count: 7,
          repost_count: 2,
          is_liked_by_me: true,
        },
      ],
      pagination: {
        limit: 20,
        offset: 0,
        total: 1,
      },
    });

    const response = await request(app)
      .get('/api/v1/tracks/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Owned Track',
          user_id: 'user-1',
          artist_name: 'DJ Nova',
          comment_count: 7,
          repost_count: 2,
          is_liked_by_me: true,
        },
      ],
      message: 'My tracks fetched successfully',
      pagination: {
        limit: 20,
        offset: 0,
        total: 1,
      },
    });
    expect(tracksService.getMyTracks).toHaveBeenCalledWith('user-1', {
      limit: undefined,
      offset: undefined,
      status: undefined,
    });
  });
});

describe('PATCH /api/v1/tracks/:track_id/audio', () => {
  const trackId = '11111111-1111-4111-8111-111111111111';

  it('requires authentication', async () => {
    const response = await request(app).patch(`/api/v1/tracks/${trackId}/audio`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(tracksService.replaceTrackAudio).not.toHaveBeenCalled();
  });

  it('validates track_id before accepting the upload', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });

    const response = await request(app)
      .patch('/api/v1/tracks/not-a-uuid/audio')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio_file', Buffer.from('audio'), {
        filename: 'song.mp3',
        contentType: 'audio/mpeg',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(tracksService.replaceTrackAudio).not.toHaveBeenCalled();
  });

  it('returns 400 when audio_file is missing', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });

    const response = await request(app)
      .patch(`/api/v1/tracks/${trackId}/audio`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Audio file is required',
      },
    });
    expect(tracksService.replaceTrackAudio).not.toHaveBeenCalled();
  });

  it('replaces audio and returns the reset processing track payload', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    tracksService.replaceTrackAudio.mockResolvedValue({
      id: trackId,
      audio_url: 'https://cdn.example.com/new-audio.mp3',
      status: 'processing',
      stream_url: null,
      preview_url: null,
      waveform_url: null,
    });

    const response = await request(app)
      .patch(`/api/v1/tracks/${trackId}/audio`)
      .set('Authorization', 'Bearer valid-token')
      .attach('audio_file', Buffer.from('audio'), {
        filename: 'song.mp3',
        contentType: 'audio/mpeg',
      });

    expect(response.status).toBe(200);
    expect(tracksService.replaceTrackAudio).toHaveBeenCalledWith({
      trackId,
      userId: 'user-1',
      audioFile: expect.objectContaining({
        originalname: 'song.mp3',
        mimetype: 'audio/mpeg',
      }),
    });
    expect(response.body).toEqual({
      data: {
        id: trackId,
        audio_url: 'https://cdn.example.com/new-audio.mp3',
        status: 'processing',
        stream_url: null,
        preview_url: null,
        waveform_url: null,
      },
      message: 'Track audio updated successfully. Processing restarted.',
    });
  });
});

describe('GET /api/v1/tracks/:track_id/offline-download', () => {
  const trackId = '11111111-1111-4111-8111-111111111111';

  it('requires authentication', async () => {
    const response = await request(app).get(`/api/v1/tracks/${trackId}/offline-download`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(tracksService.getTrackOfflineDownload).not.toHaveBeenCalled();
  });

  it('validates track_id before calling the controller', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });

    const response = await request(app)
      .get('/api/v1/tracks/not-a-uuid/offline-download')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(tracksService.getTrackOfflineDownload).not.toHaveBeenCalled();
  });

  it('returns an offline download payload for an authenticated requester', async () => {
    verifyToken.mockReturnValue({ sub: 'user-1' });
    tracksService.getTrackOfflineDownload.mockResolvedValue({
      track_id: trackId,
      download_url: 'signed-url',
      source: 'stream',
      expires_in_seconds: 300,
      expires_at: '2026-04-25T12:05:00.000Z',
    });

    const response = await request(app)
      .get(`/api/v1/tracks/${trackId}/offline-download`)
      .query({ secret_token: 'secret-123' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(tracksService.getTrackOfflineDownload).toHaveBeenCalledWith(
      trackId,
      'user-1',
      'secret-123'
    );
    expect(response.body).toEqual({
      data: {
        track_id: trackId,
        download_url: 'signed-url',
        source: 'stream',
        expires_in_seconds: 300,
        expires_at: '2026-04-25T12:05:00.000Z',
      },
      message: 'Offline download URL fetched successfully.',
    });
  });
});

describe('GET /api/v1/tracks/:track_id', () => {
  it('returns track details for an anonymous requester with viewer flags set to false', async () => {
    tracksService.getTrackById.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Public Track',
      user_id: 'artist-1',
      is_public: true,
      is_hidden: false,
      is_liked_by_me: false,
      is_reposted_by_me: false,
      is_artist_followed_by_me: false,
    });

    const response = await request(app).get('/api/v1/tracks/11111111-1111-4111-8111-111111111111');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Public Track',
        user_id: 'artist-1',
        is_public: true,
        is_hidden: false,
        is_liked_by_me: false,
        is_reposted_by_me: false,
        is_artist_followed_by_me: false,
      },
      message: 'Track fetched successfully',
    });
    expect(tracksService.getTrackById).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      null,
      null
    );
  });

  it('passes the authenticated requester and secret_token to the service', async () => {
    verifyToken.mockReturnValue({ sub: 'listener-1' });
    tracksService.getTrackById.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Viewer Track',
      user_id: 'artist-1',
      is_public: false,
      is_hidden: false,
      is_liked_by_me: true,
      is_reposted_by_me: true,
      is_artist_followed_by_me: true,
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111')
      .query({ secret_token: 'secret-123' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(tracksService.getTrackById).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'listener-1',
      'secret-123'
    );
    expect(response.body).toEqual({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Viewer Track',
        user_id: 'artist-1',
        is_public: false,
        is_hidden: false,
        is_liked_by_me: true,
        is_reposted_by_me: true,
        is_artist_followed_by_me: true,
      },
      message: 'Track fetched successfully',
    });
  });

  it('returns service privacy errors without changing the public route behavior', async () => {
    tracksService.getTrackById.mockRejectedValue({
      statusCode: 403,
      code: 'RESOURCE_PRIVATE',
      message: 'This track is private',
    });

    const response = await request(app).get('/api/v1/tracks/11111111-1111-4111-8111-111111111111');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'RESOURCE_PRIVATE',
        message: 'This track is private',
      },
    });
  });
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
      period: 'first_7_days',
      items: [],
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard')
      .query({ period: 'first_7_days' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(tracksService.getTrackFanLeaderboard).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'first_7_days',
      'user-1',
      null
    );
  });

  it('keeps accepting last_7_days as a query alias while returning first_7_days from the service response', async () => {
    tracksService.getTrackFanLeaderboard.mockResolvedValue({
      period: 'first_7_days',
      items: [],
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard')
      .query({ period: 'last_7_days' });

    expect(response.status).toBe(200);
    expect(tracksService.getTrackFanLeaderboard).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'last_7_days',
      null,
      null
    );
    expect(response.body).toEqual({
      data: {
        period: 'first_7_days',
        items: [],
      },
      message: 'Fan leaderboard fetched successfully.',
    });
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
      message:
        'period must be one of: overall, first_7_days. last_7_days is accepted as a deprecated alias.',
    });

    const response = await request(app)
      .get('/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard')
      .query({ period: 'top' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message:
          'period must be one of: overall, first_7_days. last_7_days is accepted as a deprecated alias.',
      },
    });
  });

  it('returns 403 when the service hides the fan leaderboard for the track', async () => {
    tracksService.getTrackFanLeaderboard.mockRejectedValue({
      statusCode: 403,
      code: 'FAN_LEADERBOARD_HIDDEN',
      message: 'Fan leaderboard is disabled for this track.',
    });

    const response = await request(app).get(
      '/api/v1/tracks/11111111-1111-4111-8111-111111111111/fan-leaderboard'
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'FAN_LEADERBOARD_HIDDEN',
        message: 'Fan leaderboard is disabled for this track.',
      },
    });
  });
});

