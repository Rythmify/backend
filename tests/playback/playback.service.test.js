const service = require('../../src/services/playback.service');
const playerStateModel = require('../../src/models/player-state.model');
const playbackModel = require('../../src/models/playback.model');

jest.mock('../../src/models/player-state.model');
jest.mock('../../src/models/playback.model');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const QUEUE_TRACK_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => jest.clearAllMocks());

describe('playback.service', () => {
  describe('playTrack', () => {
    it('returns 200-style playable payload for a public ready track with stream_url', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.playTrack({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });

      expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
    });

    it('returns preview when only preview_url exists', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: 'preview-url',
        enable_app_playback: true,
      });

      await expect(service.playTrack({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'preview',
        stream_url: null,
        preview_url: 'preview-url',
        reason: 'preview_only',
      });
    });

    it('returns 202 when the track is still processing', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'processing',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.playTrack({ trackId: TRACK_ID })).rejects.toMatchObject({
        statusCode: 202,
        code: 'BUSINESS_OPERATION_NOT_ALLOWED',
      });

      expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
    });

    it('returns 503 when track processing failed', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'failed',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.playTrack({ trackId: TRACK_ID })).rejects.toMatchObject({
        statusCode: 503,
        code: 'UPLOAD_PROCESSING_FAILED',
      });
    });

    it('returns 400 for an invalid track uuid', async () => {
      await expect(service.playTrack({ trackId: 'not-a-uuid' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'track_id must be a valid UUID.',
      });

      expect(playbackModel.findTrackByIdForPlaybackState).not.toHaveBeenCalled();
    });

    it('returns 404 when the track does not exist', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue(null);

      await expect(service.playTrack({ trackId: TRACK_ID })).rejects.toMatchObject({
        statusCode: 404,
        code: 'TRACK_NOT_FOUND',
      });
    });

    it('returns 404 for a hidden track when the requester is not the owner', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: true,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.playTrack({ trackId: TRACK_ID, requesterUserId: 'listener-1' })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'TRACK_NOT_FOUND',
      });
    });

    it('returns 403 for a private track without a valid token', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: false,
        is_hidden: false,
        secret_token: 'secret-123',
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.playTrack({ trackId: TRACK_ID, requesterUserId: 'listener-1' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'RESOURCE_PRIVATE',
      });
    });

    it('allows a private track with a valid secret token', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: false,
        is_hidden: false,
        secret_token: 'secret-123',
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.playTrack({
          trackId: TRACK_ID,
          requesterUserId: 'listener-1',
          secretToken: 'secret-123',
        })
      ).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });
    });

    it('allows the owner to play their own private track', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: false,
        is_hidden: false,
        secret_token: 'secret-123',
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.playTrack({ trackId: TRACK_ID, requesterUserId: 'owner-1' })
      ).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });
    });

    it('writes listening history for authenticated successful plays', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });
      playbackModel.insertListeningHistory.mockResolvedValue({
        id: 'history-1',
        user_id: 'user-1',
        track_id: TRACK_ID,
      });

      await service.playTrack({ trackId: TRACK_ID, requesterUserId: 'user-1' });

      expect(playbackModel.insertListeningHistory).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
      });
    });

    it('does not write listening history for guests', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await service.playTrack({ trackId: TRACK_ID, requesterUserId: null });

      expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
    });
  });

  describe('getPlaybackState', () => {
    it('returns playable for a public ready track with stream_url', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });
    });

    it('returns preview when stream_url is missing but preview_url exists', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: 'preview-url',
        enable_app_playback: true,
      });

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'preview',
        stream_url: null,
        preview_url: 'preview-url',
        reason: 'preview_only',
      });
    });

    it('returns processing for a processing track', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'processing',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'processing',
        stream_url: null,
        preview_url: null,
        reason: 'track_processing',
      });
    });

    it('returns failed for a failed track', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'failed',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'failed',
        stream_url: null,
        preview_url: null,
        reason: 'track_processing_failed',
      });
    });

    it('returns unavailable when a ready track has no playable urls', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: null,
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'unavailable',
        stream_url: null,
        preview_url: null,
        reason: 'playback_url_unavailable',
      });
    });

    it('returns blocked when app playback is disabled', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: 'preview-url',
        enable_app_playback: false,
      });

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'blocked',
        stream_url: null,
        preview_url: null,
        reason: 'app_playback_disabled',
      });
    });

    it('returns 404 when the track does not exist', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue(null);

      await expect(service.getPlaybackState({ trackId: TRACK_ID })).rejects.toMatchObject({
        statusCode: 404,
        code: 'TRACK_NOT_FOUND',
      });
    });

    it('returns 404 for a hidden track when the requester is not the owner', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: true,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.getPlaybackState({ trackId: TRACK_ID, requesterUserId: 'listener-1' })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'TRACK_NOT_FOUND',
      });
    });

    it('allows hidden owner access', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: false,
        is_hidden: true,
        secret_token: 'secret-123',
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.getPlaybackState({ trackId: TRACK_ID, requesterUserId: 'owner-1' })
      ).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });
    });

    it('returns 403 for a private track without a valid secret token', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: false,
        is_hidden: false,
        secret_token: 'secret-123',
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.getPlaybackState({ trackId: TRACK_ID, requesterUserId: 'listener-1' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'RESOURCE_PRIVATE',
      });
    });

    it('allows private access with a valid secret token', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: false,
        is_hidden: false,
        secret_token: 'secret-123',
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(
        service.getPlaybackState({
          trackId: TRACK_ID,
          requesterUserId: 'listener-1',
          secretToken: 'secret-123',
        })
      ).resolves.toEqual({
        track_id: TRACK_ID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });
    });

    it('returns 400 for an invalid track uuid', async () => {
      await expect(service.getPlaybackState({ trackId: 'not-a-uuid' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'track_id must be a valid UUID.',
      });

      expect(playbackModel.findTrackByIdForPlaybackState).not.toHaveBeenCalled();
    });
  });

  it('returns the saved player state for the authenticated user', async () => {
    const state = {
      track_id: 'track-1',
      position_seconds: 42.75,
      volume: 0.6,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playerStateModel.findByUserId.mockResolvedValue(state);

    await expect(service.getPlayerState({ userId: 'user-1' })).resolves.toEqual(state);
    expect(playerStateModel.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('returns null when the user has no saved state', async () => {
    playerStateModel.findByUserId.mockResolvedValue(null);

    await expect(service.getPlayerState({ userId: 'user-1' })).resolves.toBeNull();
  });

  it('throws unauthorized when userId is missing', async () => {
    await expect(service.getPlayerState({ userId: null })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  describe('getRecentlyPlayed', () => {
    it('returns an empty array when the user has no listening history', async () => {
      playbackModel.findRecentlyPlayedByUserId.mockResolvedValue([]);

      await expect(service.getRecentlyPlayed({ userId: 'user-1' })).resolves.toEqual([]);
      expect(playbackModel.findRecentlyPlayedByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns recently played entries ordered by newest last_played_at first', async () => {
      const history = [
        {
          track: {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Latest Track',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'artist-1',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
          },
          last_played_at: '2026-04-06T12:00:00.000Z',
        },
        {
          track: {
            id: '22222222-2222-4222-8222-222222222222',
            title: 'Older Track',
            genre: 'Rock',
            duration: 210,
            cover_image: 'cover-2.jpg',
            user_id: 'artist-2',
            play_count: 8,
            like_count: 2,
            stream_url: 'stream-2',
          },
          last_played_at: '2026-04-05T09:00:00.000Z',
        },
      ];

      playbackModel.findRecentlyPlayedByUserId.mockResolvedValue(history);

      await expect(service.getRecentlyPlayed({ userId: 'user-1' })).resolves.toEqual(history);
      expect(playbackModel.findRecentlyPlayedByUserId).toHaveBeenCalledWith('user-1');
    });

    it('throws unauthorized when userId is missing', async () => {
      await expect(service.getRecentlyPlayed({ userId: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playbackModel.findRecentlyPlayedByUserId).not.toHaveBeenCalled();
    });
  });

  describe('getListeningHistory', () => {
    it('returns empty listening history with default pagination when the user has no history', async () => {
      playbackModel.findListeningHistoryByUserId.mockResolvedValue([]);
      playbackModel.countListeningHistoryByUserId.mockResolvedValue(0);

      await expect(service.getListeningHistory({ userId: 'user-1' })).resolves.toEqual({
        items: [],
        pagination: {
          limit: 20,
          offset: 0,
          total: 0,
        },
      });

      expect(playbackModel.findListeningHistoryByUserId).toHaveBeenCalledWith('user-1', 20, 0);
      expect(playbackModel.countListeningHistoryByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns listening history rows newest first with custom limit and offset', async () => {
      const history = [
        {
          id: 'history-2',
          track: {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track Repeat',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'artist-1',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
          },
          played_at: '2026-04-06T12:00:00.000Z',
        },
        {
          id: 'history-1',
          track: {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track Repeat',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'artist-1',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
          },
          played_at: '2026-04-06T11:00:00.000Z',
        },
      ];

      playbackModel.findListeningHistoryByUserId.mockResolvedValue(history);
      playbackModel.countListeningHistoryByUserId.mockResolvedValue(53);

      await expect(
        service.getListeningHistory({ userId: 'user-1', limit: '5', offset: '10' })
      ).resolves.toEqual({
        items: history,
        pagination: {
          limit: 5,
          offset: 10,
          total: 53,
        },
      });

      expect(playbackModel.findListeningHistoryByUserId).toHaveBeenCalledWith('user-1', 5, 10);
      expect(playbackModel.countListeningHistoryByUserId).toHaveBeenCalledWith('user-1');
    });

    it('throws unauthorized when userId is missing', async () => {
      await expect(service.getListeningHistory({ userId: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playbackModel.findListeningHistoryByUserId).not.toHaveBeenCalled();
      expect(playbackModel.countListeningHistoryByUserId).not.toHaveBeenCalled();
    });

    it('rejects invalid limit values outside the allowed range', async () => {
      await expect(
        service.getListeningHistory({ userId: 'user-1', limit: '101' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'limit must be an integer between 1 and 100.',
      });

      expect(playbackModel.findListeningHistoryByUserId).not.toHaveBeenCalled();
    });

    it('rejects invalid offset values below zero', async () => {
      await expect(
        service.getListeningHistory({ userId: 'user-1', offset: '-1' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'offset must be an integer greater than or equal to 0.',
      });

      expect(playbackModel.findListeningHistoryByUserId).not.toHaveBeenCalled();
    });
  });

  it('saves player state successfully', async () => {
    const state = {
      track_id: 'track-1',
      position_seconds: 21.5,
      volume: 0.4,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playerStateModel.trackExists.mockResolvedValue(true);
    playerStateModel.upsert.mockResolvedValue(state);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 21.5,
        volume: 0.4,
        queue: [QUEUE_TRACK_ID],
      })
    ).resolves.toEqual(state);

    expect(playerStateModel.upsert).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 21.5,
      volume: 0.4,
      queue: [QUEUE_TRACK_ID],
    });
  });

  it('defaults optional fields when saving player state', async () => {
    playerStateModel.trackExists.mockResolvedValue(true);
    playerStateModel.upsert.mockResolvedValue({ track_id: 'track-1' });

    await service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 8,
    });

    expect(playerStateModel.upsert).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 8,
      volume: 1,
      queue: [],
    });
  });

  it('rejects missing track_id', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: null,
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
  });

  it('rejects missing position_seconds', async () => {
    playerStateModel.trackExists.mockResolvedValue(true);
    await expect(
      service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: undefined,
    })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
  });

  it('rejects invalid volume outside the allowed range', async () => {
    playerStateModel.trackExists.mockResolvedValue(true);
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        volume: 1.1,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
  });

  it('rejects malformed track_id with VALIDATION_FAILED', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: 'not-a-uuid',
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });

    expect(playerStateModel.trackExists).not.toHaveBeenCalled();
    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });

  it('returns TRACK_NOT_FOUND when the provided track does not exist', async () => {
    playerStateModel.trackExists.mockResolvedValue(false);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND', statusCode: 404 });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed queue item UUIDs', async () => {
    playerStateModel.trackExists.mockResolvedValue(true);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: ['bad-queue-id'],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });
});
