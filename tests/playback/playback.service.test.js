const service = require('../../src/services/playback.service');
const playerStateModel = require('../../src/models/player-state.model');
const playbackModel = require('../../src/models/playback.model');

jest.mock('../../src/models/player-state.model');
jest.mock('../../src/models/playback.model');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const QUEUE_TRACK_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => jest.clearAllMocks());

describe('playback.service', () => {
  const getRecentTimestampIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

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

    it('returns 403 when app playback is disabled for a ready track', async () => {
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

      await expect(service.playTrack({ trackId: TRACK_ID })).rejects.toMatchObject({
        statusCode: 403,
        code: 'BUSINESS_OPERATION_NOT_ALLOWED',
        message: 'Playback is blocked for this track.',
      });

      expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
    });

    it('returns 500 when a ready track has no playable audio urls', async () => {
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

      await expect(service.playTrack({ trackId: TRACK_ID })).rejects.toMatchObject({
        statusCode: 500,
        code: 'STREAM_URL_MISSING',
        message: 'No playable audio available',
      });

      expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
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
      playbackModel.countRecentlyPlayedByUserId.mockResolvedValue(0);

      await expect(service.getRecentlyPlayed({ userId: 'user-1' })).resolves.toEqual({
        data: [],
        pagination: {
          limit: 20,
          offset: 0,
          total: 0,
        },
      });
      expect(playbackModel.findRecentlyPlayedByUserId).toHaveBeenCalledWith('user-1', 20, 0);
      expect(playbackModel.countRecentlyPlayedByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns recently played entries ordered by newest last_played_at first with pagination', async () => {
      const items = [
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
        {
          track: {
            id: '22222222-2222-4222-8222-222222222222',
            title: 'Older Track',
            genre: 'Rock',
            duration: 210,
            cover_image: 'cover-2.jpg',
            user_id: 'artist-2',
            artist_name: 'Echo Atlas',
            play_count: 8,
            like_count: 2,
            stream_url: 'stream-2',
            tags: [],
          },
          last_played_at: '2026-04-05T09:00:00.000Z',
        },
      ];

      playbackModel.findRecentlyPlayedByUserId.mockResolvedValue(items);
      playbackModel.countRecentlyPlayedByUserId.mockResolvedValue(57);

      await expect(
        service.getRecentlyPlayed({ userId: 'user-1', limit: '10', offset: '20' })
      ).resolves.toEqual({
        data: items,
        pagination: {
          limit: 10,
          offset: 20,
          total: 57,
        },
      });
      expect(playbackModel.findRecentlyPlayedByUserId).toHaveBeenCalledWith('user-1', 10, 20);
      expect(playbackModel.countRecentlyPlayedByUserId).toHaveBeenCalledWith('user-1');
    });

    it('throws validation error when recently played limit is invalid', async () => {
      await expect(service.getRecentlyPlayed({ userId: 'user-1', limit: '0' })).rejects.toMatchObject(
        {
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          message: 'limit must be an integer between 1 and 100.',
        }
      );

      expect(playbackModel.findRecentlyPlayedByUserId).not.toHaveBeenCalled();
      expect(playbackModel.countRecentlyPlayedByUserId).not.toHaveBeenCalled();
    });

    it('throws validation error when recently played offset is invalid', async () => {
      await expect(
        service.getRecentlyPlayed({ userId: 'user-1', offset: '-1' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'offset must be an integer greater than or equal to 0.',
      });

      expect(playbackModel.findRecentlyPlayedByUserId).not.toHaveBeenCalled();
      expect(playbackModel.countRecentlyPlayedByUserId).not.toHaveBeenCalled();
    });

    it('throws unauthorized when userId is missing', async () => {
      await expect(service.getRecentlyPlayed({ userId: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playbackModel.findRecentlyPlayedByUserId).not.toHaveBeenCalled();
      expect(playbackModel.countRecentlyPlayedByUserId).not.toHaveBeenCalled();
    });
  });

  describe('clearListeningHistory', () => {
    it('calls the model and returns the deleted row count when history exists', async () => {
      playbackModel.deleteListeningHistoryByUserId.mockResolvedValue(3);

      await expect(service.clearListeningHistory({ userId: 'user-1' })).resolves.toBe(3);
      expect(playbackModel.deleteListeningHistoryByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns zero when the user has no listening history', async () => {
      playbackModel.deleteListeningHistoryByUserId.mockResolvedValue(0);

      await expect(service.clearListeningHistory({ userId: 'user-1' })).resolves.toBe(0);
      expect(playbackModel.deleteListeningHistoryByUserId).toHaveBeenCalledWith('user-1');
    });

    it('throws unauthorized when userId is missing', async () => {
      await expect(service.clearListeningHistory({ userId: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playbackModel.deleteListeningHistoryByUserId).not.toHaveBeenCalled();
    });
  });

  describe('getListeningHistory', () => {
    it('returns empty listening history with default pagination when the user has no history', async () => {
      playbackModel.findListeningHistoryByUserId.mockResolvedValue([]);
      playbackModel.countListeningHistoryByUserId.mockResolvedValue(0);

      const result = await service.getListeningHistory({ userId: 'user-1' });

      expect(result).toEqual({
        data: [],
        pagination: {
          limit: 20,
          offset: 0,
          total: 0,
        },
      });
      expect(result.items).toBeUndefined();

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
            artist_name: 'DJ Nova',
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
            artist_name: 'DJ Nova',
            play_count: 12,
            like_count: 4,
            stream_url: 'stream-1',
          },
          played_at: '2026-04-06T11:00:00.000Z',
        },
      ];

      playbackModel.findListeningHistoryByUserId.mockResolvedValue(history);
      playbackModel.countListeningHistoryByUserId.mockResolvedValue(53);

      const result = await service.getListeningHistory({
        userId: 'user-1',
        limit: '5',
        offset: '10',
      });

      expect(result).toEqual({
        data: history,
        pagination: {
          limit: 5,
          offset: 10,
          total: 53,
        },
      });
      expect(result.items).toBeUndefined();

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

  describe('syncPlayback', () => {
    const publicReadyTrack = {
      id: TRACK_ID,
      user_id: 'owner-1',
      status: 'ready',
      is_public: true,
      is_hidden: false,
      secret_token: null,
      stream_url: 'stream-url',
      preview_url: null,
      enable_app_playback: true,
    };

    it('throws unauthorized when userId is missing', async () => {
      await expect(service.syncPlayback({ userId: null, historyEvents: [] })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playbackModel.findTrackByIdForPlaybackState).not.toHaveBeenCalled();
      expect(playerStateModel.trackExists).not.toHaveBeenCalled();
    });

    it('rejects empty sync payloads', async () => {
      await expect(service.syncPlayback({ userId: 'user-1' })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'At least one of history_events or current_state must be provided.',
      });
    });

    it('rejects non-array history_events payloads', async () => {
      await expect(
        service.syncPlayback({ userId: 'user-1', historyEvents: 'not-an-array' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'history_events must be an array.',
      });
    });

    it('rejects non-object current_state payloads', async () => {
      await expect(
        service.syncPlayback({ userId: 'user-1', currentState: 'not-an-object' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'current_state must be an object.',
      });
    });

    it('rejects invalid history event payloads', async () => {
      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [null],
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'Each history_events item must be an object.',
      });
    });

    it('rejects invalid current_state.state_updated_at values', async () => {
      playerStateModel.trackExists.mockResolvedValue(true);

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          currentState: {
            track_id: TRACK_ID,
            position_seconds: 12.5,
            state_updated_at: 'not-a-date',
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'current_state.state_updated_at must be a valid datetime.',
      });
    });

    it('rejects current_state.state_updated_at values that are too far in the future', async () => {
      playerStateModel.trackExists.mockResolvedValue(true);

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          currentState: {
            track_id: TRACK_ID,
            position_seconds: 12.5,
            state_updated_at: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'current_state.state_updated_at must not be in the future.',
      });
    });

    it('syncs validated history events and saves a newer player state', async () => {
      const olderPlayedAt = new Date(Date.now() - 60 * 1000).toISOString();
      const newerPlayedAt = new Date(Date.now() - 30 * 1000).toISOString();
      const stateUpdatedAt = getRecentTimestampIso();

      playbackModel.findTrackByIdForPlaybackState
        .mockResolvedValueOnce(publicReadyTrack)
        .mockResolvedValueOnce(publicReadyTrack);
      playbackModel.findRecentListeningHistoryEntry
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'history-existing',
          user_id: 'user-1',
          track_id: TRACK_ID,
          played_at: newerPlayedAt,
        });
      playbackModel.insertListeningHistory.mockResolvedValue({
        id: 'history-1',
        user_id: 'user-1',
        track_id: TRACK_ID,
        duration_played: 100,
        played_at: olderPlayedAt,
      });
      playerStateModel.trackExists.mockResolvedValue(true);
      playerStateModel.upsertIfNewer.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 1473.8,
        volume: 0.49,
        queue: [],
        saved_at: stateUpdatedAt,
      });

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [
            {
              track_id: TRACK_ID,
              played_at: newerPlayedAt,
              duration_played_seconds: 100,
            },
            {
              track_id: TRACK_ID,
              played_at: olderPlayedAt,
              duration_played_seconds: 100,
            },
          ],
          currentState: {
            track_id: TRACK_ID,
            position_seconds: 1473.8,
            volume: 0.49,
            queue: [],
            state_updated_at: stateUpdatedAt,
          },
        })
      ).resolves.toEqual({
        history_events_received: 2,
        history_events_recorded: 1,
        history_events_deduplicated: 1,
        current_state_saved: true,
        current_state_ignored_as_stale: false,
        current_state: {
          track_id: TRACK_ID,
          position_seconds: 1473.8,
          volume: 0.49,
          queue: [],
          saved_at: stateUpdatedAt,
        },
      });

      expect(playbackModel.findRecentListeningHistoryEntry).toHaveBeenNthCalledWith(1, {
        userId: 'user-1',
        trackId: TRACK_ID,
        playedAt: olderPlayedAt,
        windowSeconds: 30,
      });
      expect(playbackModel.findRecentListeningHistoryEntry).toHaveBeenNthCalledWith(2, {
        userId: 'user-1',
        trackId: TRACK_ID,
        playedAt: newerPlayedAt,
        windowSeconds: 30,
      });
      expect(playbackModel.insertListeningHistory).toHaveBeenCalledTimes(1);
      expect(playbackModel.insertListeningHistory).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        durationPlayed: 100,
        playedAt: olderPlayedAt,
      });
      expect(playerStateModel.upsertIfNewer).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 1473.8,
        volume: 0.49,
        queue: [],
        updatedAt: stateUpdatedAt,
      });
    });

    it('ignores stale current_state syncs and returns the newer stored state', async () => {
      const currentSavedState = {
        track_id: TRACK_ID,
        position_seconds: 87,
        volume: 0.9,
        queue: [QUEUE_TRACK_ID],
        saved_at: '2026-04-05T01:00:00.000Z',
      };

      playerStateModel.trackExists.mockResolvedValue(true);
      playerStateModel.upsertIfNewer.mockResolvedValue(null);
      playerStateModel.findByUserId.mockResolvedValue(currentSavedState);

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          currentState: {
            track_id: TRACK_ID,
            position_seconds: 10,
            volume: 0.5,
            queue: [],
            state_updated_at: '2026-04-05T00:00:00.000Z',
          },
        })
      ).resolves.toEqual({
        history_events_received: 0,
        history_events_recorded: 0,
        history_events_deduplicated: 0,
        current_state_saved: false,
        current_state_ignored_as_stale: true,
        current_state: currentSavedState,
      });

      expect(playerStateModel.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('rejects inaccessible history-event tracks before writing anything', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue(null);

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [
            {
              track_id: TRACK_ID,
              played_at: getRecentTimestampIso(),
            },
          ],
        })
      ).rejects.toMatchObject({
        code: 'TRACK_NOT_FOUND',
        statusCode: 404,
      });

      expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
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

  it('rejects unauthorized save attempts when userId is missing', async () => {
    await expect(
      service.savePlayerState({
        userId: null,
        trackId: TRACK_ID,
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

    expect(playerStateModel.trackExists).not.toHaveBeenCalled();
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

  it('rejects non-numeric position_seconds values', async () => {
    playerStateModel.trackExists.mockResolvedValue(true);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 'not-a-number',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      message: 'position_seconds must be a number greater than or equal to 0.',
    });
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

  it('rejects queue values that are not arrays', async () => {
    playerStateModel.trackExists.mockResolvedValue(true);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: 'not-an-array',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      message: 'queue must be an array.',
    });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });
});
