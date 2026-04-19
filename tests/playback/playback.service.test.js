const { validate: isUuid } = require('uuid');
const service = require('../../src/services/playback.service');
const playerStateModel = require('../../src/models/player-state.model');
const playbackModel = require('../../src/models/playback.model');

jest.mock('../../src/models/player-state.model');
jest.mock('../../src/models/playback.model');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const QUEUE_TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_QUEUE_TRACK_ID = '33333333-3333-4333-8333-333333333333';
const THIRD_QUEUE_TRACK_ID = '77777777-7777-4777-8777-777777777777';
const FOURTH_QUEUE_TRACK_ID = '88888888-8888-4888-8888-888888888888';
const PLAYLIST_ID = '44444444-4444-4444-8444-444444444444';
const QUEUE_ITEM_ID = '55555555-5555-4555-8555-555555555555';
const SECOND_QUEUE_ITEM_ID = '66666666-6666-4666-8666-666666666666';
const THIRD_QUEUE_ITEM_ID = '99999999-9999-4999-8999-999999999999';
const FOURTH_QUEUE_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUEUE_ITEM_ADDED_AT = '2026-04-18T20:00:00.000Z';

const buildQueueItem = (overrides = {}) => ({
  queue_item_id: QUEUE_ITEM_ID,
  track_id: QUEUE_TRACK_ID,
  queue_bucket: 'next_up',
  source_type: 'track',
  source_id: null,
  source_position: null,
  added_at: QUEUE_ITEM_ADDED_AT,
  ...overrides,
});

const expectGeneratedQueueItem = (queueItem, overrides = {}) => {
  expect(queueItem).toMatchObject({
    track_id: QUEUE_TRACK_ID,
    queue_bucket: 'next_up',
    source_type: 'track',
    source_id: null,
    source_position: null,
    ...overrides,
  });
  expect(isUuid(queueItem.queue_item_id)).toBe(true);
  expect(new Date(queueItem.added_at).toISOString()).toBe(queueItem.added_at);
};

const expectGeneratedNextUpInsertionItem = (queueItem, overrides = {}) => {
  expect(queueItem).toMatchObject({
    queue_bucket: 'next_up',
    source_type: 'track',
    source_id: null,
    source_position: null,
    ...overrides,
  });
  expect(isUuid(queueItem.queue_item_id)).toBe(true);
  expect(new Date(queueItem.added_at).toISOString()).toBe(queueItem.added_at);
};

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
      track_id: TRACK_ID,
      position_seconds: 42.75,
      volume: 0.6,
      queue: [buildQueueItem()],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playerStateModel.findByUserId.mockResolvedValue(state);

    await expect(service.getPlayerState({ userId: 'user-1' })).resolves.toEqual(state);
    expect(playerStateModel.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('normalizes legacy queue UUID arrays when returning saved player state', async () => {
    playerStateModel.findByUserId.mockResolvedValue({
      track_id: TRACK_ID,
      position_seconds: 42.75,
      volume: 0.6,
      queue: [QUEUE_TRACK_ID],
      saved_at: '2026-04-05T00:00:00.000Z',
    });

    const state = await service.getPlayerState({ userId: 'user-1' });

    expect(state.track_id).toBe(TRACK_ID);
    expect(state.queue).toHaveLength(1);
    expectGeneratedQueueItem(state.queue[0]);
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
            is_liked_by_me: true,
            is_reposted_by_me: false,
            is_artist_followed_by_me: true,
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
            is_liked_by_me: false,
            is_reposted_by_me: true,
            is_artist_followed_by_me: false,
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
      await expect(
        service.getRecentlyPlayed({ userId: 'user-1', limit: '0' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'limit must be an integer between 1 and 100.',
      });

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
      await expect(service.syncPlayback({ userId: null, historyEvents: [] })).rejects.toMatchObject(
        {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        }
      );

      expect(playbackModel.findTrackByIdForPlaybackState).not.toHaveBeenCalled();
      expect(playerStateModel.findExistingTrackIds).not.toHaveBeenCalled();
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
      playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);

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
      playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);

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
      playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
      playerStateModel.upsertIfNewer.mockImplementation(async ({ queue }) => ({
        track_id: TRACK_ID,
        position_seconds: 1473.8,
        volume: 0.49,
        queue,
        saved_at: stateUpdatedAt,
      }));

      const result = await service.syncPlayback({
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
          queue: [QUEUE_TRACK_ID],
          state_updated_at: stateUpdatedAt,
        },
      });

      expect(result).toEqual({
        history_events_received: 2,
        history_events_recorded: 1,
        history_events_deduplicated: 1,
        current_state_saved: true,
        current_state_ignored_as_stale: false,
        current_state: {
          track_id: TRACK_ID,
          position_seconds: 1473.8,
          volume: 0.49,
          queue: [expect.any(Object)],
          saved_at: stateUpdatedAt,
        },
      });
      expectGeneratedQueueItem(result.current_state.queue[0]);

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
        queue: [expect.any(Object)],
        updatedAt: stateUpdatedAt,
      });
      expectGeneratedQueueItem(playerStateModel.upsertIfNewer.mock.calls[0][0].queue[0]);
    });

    it('normalizes current_state queue items with the same defaults used by saved player state', async () => {
      const stateUpdatedAt = getRecentTimestampIso();

      playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
      playerStateModel.upsertIfNewer.mockImplementation(async ({ queue }) => ({
        track_id: TRACK_ID,
        position_seconds: 10,
        volume: 1,
        queue,
        saved_at: stateUpdatedAt,
      }));

      const result = await service.syncPlayback({
        userId: 'user-1',
        currentState: {
          track_id: TRACK_ID,
          position_seconds: 10,
          queue: [{ track_id: QUEUE_TRACK_ID }],
          state_updated_at: stateUpdatedAt,
        },
      });

      expect(playerStateModel.upsertIfNewer).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        volume: 1,
        queue: [expect.any(Object)],
        updatedAt: stateUpdatedAt,
      });
      expectGeneratedQueueItem(playerStateModel.upsertIfNewer.mock.calls[0][0].queue[0]);
      expectGeneratedQueueItem(result.current_state.queue[0]);
    });

    it('ignores stale current_state syncs and returns the newer stored state', async () => {
      const currentSavedState = {
        track_id: TRACK_ID,
        position_seconds: 87,
        volume: 0.9,
        queue: [
          buildQueueItem({
            queue_item_id: SECOND_QUEUE_ITEM_ID,
            queue_bucket: 'context',
            source_type: 'playlist',
            source_id: PLAYLIST_ID,
            source_position: 2,
          }),
        ],
        saved_at: '2026-04-05T01:00:00.000Z',
      };

      playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
      playerStateModel.upsertIfNewer.mockResolvedValue(null);
      playerStateModel.findByUserId.mockResolvedValue(currentSavedState);

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          currentState: {
            track_id: TRACK_ID,
            position_seconds: 10,
            volume: 0.5,
            queue: [
              buildQueueItem({
                queue_item_id: SECOND_QUEUE_ITEM_ID,
                queue_bucket: 'context',
                source_type: 'playlist',
                source_id: PLAYLIST_ID,
                source_position: 2,
              }),
            ],
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

  describe('addToNextUp', () => {
    beforeEach(() => {
      playbackModel.findTrackByIdForPlaybackState.mockImplementation(async (trackId) => ({
        id: trackId,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      }));
    });

    it('inserts one item into an empty queue and creates a queue-only state when needed', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue(null);
      playerStateModel.upsert.mockImplementation(
        async ({ trackId, positionSeconds, volume, queue }) => ({
          track_id: trackId,
          position_seconds: positionSeconds,
          volume,
          queue,
          saved_at: '2026-04-19T00:00:00.000Z',
        })
      );

      const result = await service.addToNextUp({
        userId: 'user-1',
        trackId: SECOND_QUEUE_TRACK_ID,
      });

      expect(playbackModel.findTrackByIdForPlaybackState).toHaveBeenCalledWith(
        SECOND_QUEUE_TRACK_ID
      );
      expect(playerStateModel.findStateRowByUserId).toHaveBeenCalledWith('user-1');
      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: null,
        positionSeconds: 0,
        volume: 1,
        queue: [expect.any(Object)],
      });
      expect(result.queue).toHaveLength(1);
      expectGeneratedNextUpInsertionItem(result.queue[0], {
        track_id: SECOND_QUEUE_TRACK_ID,
      });
      expect(playbackModel.findLatestListeningHistoryEntryByUserAndTrack).not.toHaveBeenCalled();
      expect(playbackModel.updateListeningHistoryProgress).not.toHaveBeenCalled();
    });

    it('inserts immediately after the referenced queue item', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 12.5,
        volume: 0.7,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(
        async ({ trackId, positionSeconds, volume, queue }) => ({
          track_id: trackId,
          position_seconds: positionSeconds,
          volume,
          queue,
          saved_at: '2026-04-19T00:00:00.000Z',
        })
      );

      const result = await service.addToNextUp({
        userId: 'user-1',
        trackId: FOURTH_QUEUE_TRACK_ID,
        insertAfterQueueItemId: QUEUE_ITEM_ID,
      });

      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 12.5,
        volume: 0.7,
        queue: [expect.any(Object), expect.any(Object), expect.any(Object)],
      });
      expect(result.queue).toHaveLength(3);
      expect(result.queue[0]).toEqual(existingQueue[0]);
      expectGeneratedNextUpInsertionItem(result.queue[1], {
        track_id: FOURTH_QUEUE_TRACK_ID,
      });
      expect(result.queue[2]).toEqual(existingQueue[1]);
    });

    it('defaults insertion to after all next_up items and before context items', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: SECOND_QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
          queue_bucket: 'context',
          source_type: 'playlist',
          source_id: PLAYLIST_ID,
          source_position: 5,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 22,
        volume: 0.5,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(
        async ({ trackId, positionSeconds, volume, queue }) => ({
          track_id: trackId,
          position_seconds: positionSeconds,
          volume,
          queue,
          saved_at: '2026-04-19T00:00:00.000Z',
        })
      );

      const result = await service.addToNextUp({
        userId: 'user-1',
        trackId: FOURTH_QUEUE_TRACK_ID,
      });

      expect(result.queue.map((queueItem) => queueItem.queue_item_id)).toEqual([
        QUEUE_ITEM_ID,
        SECOND_QUEUE_ITEM_ID,
        result.queue[2].queue_item_id,
        THIRD_QUEUE_ITEM_ID,
      ]);
      expectGeneratedNextUpInsertionItem(result.queue[2], {
        track_id: FOURTH_QUEUE_TRACK_ID,
      });
      expect(result.queue[3]).toEqual(existingQueue[2]);
    });

    it('preserves the order of existing context items during default insertion', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
          queue_bucket: 'context',
          source_type: 'playlist',
          source_id: PLAYLIST_ID,
          source_position: 5,
        }),
        buildQueueItem({
          queue_item_id: FOURTH_QUEUE_ITEM_ID,
          track_id: FOURTH_QUEUE_TRACK_ID,
          queue_bucket: 'context',
          source_type: 'album',
          source_id: PLAYLIST_ID,
          source_position: 6,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 44,
        volume: 0.8,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(
        async ({ trackId, positionSeconds, volume, queue }) => ({
          track_id: trackId,
          position_seconds: positionSeconds,
          volume,
          queue,
          saved_at: '2026-04-19T00:00:00.000Z',
        })
      );

      const result = await service.addToNextUp({
        userId: 'user-1',
        trackId: SECOND_QUEUE_TRACK_ID,
      });

      expectGeneratedNextUpInsertionItem(result.queue[1], {
        track_id: SECOND_QUEUE_TRACK_ID,
      });
      expect(result.queue[2]).toEqual(existingQueue[1]);
      expect(result.queue[3]).toEqual(existingQueue[2]);
    });

    it('rejects malformed track_id values', async () => {
      await expect(
        service.addToNextUp({
          userId: 'user-1',
          trackId: 'not-a-uuid',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'track_id must be a valid UUID.',
      });

      expect(playbackModel.findTrackByIdForPlaybackState).not.toHaveBeenCalled();
      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('returns TRACK_NOT_FOUND when the requested track does not exist', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue(null);

      await expect(
        service.addToNextUp({
          userId: 'user-1',
          trackId: SECOND_QUEUE_TRACK_ID,
        })
      ).rejects.toMatchObject({
        code: 'TRACK_NOT_FOUND',
        statusCode: 404,
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns RESOURCE_PRIVATE when the requested track exists but is inaccessible', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: SECOND_QUEUE_TRACK_ID,
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
        service.addToNextUp({
          userId: 'user-1',
          trackId: SECOND_QUEUE_TRACK_ID,
        })
      ).rejects.toMatchObject({
        code: 'RESOURCE_PRIVATE',
        statusCode: 403,
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('rejects missing track_id', async () => {
      await expect(
        service.addToNextUp({
          userId: 'user-1',
          trackId: null,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'track_id is required.',
      });
    });

    it('rejects malformed insert_after_queue_item_id values', async () => {
      await expect(
        service.addToNextUp({
          userId: 'user-1',
          trackId: SECOND_QUEUE_TRACK_ID,
          insertAfterQueueItemId: 'bad-anchor',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'insert_after_queue_item_id must be a valid UUID.',
      });

      expect(playbackModel.findTrackByIdForPlaybackState).not.toHaveBeenCalled();
      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('returns QUEUE_ITEM_NOT_FOUND when the referenced insertion anchor is unknown', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 15,
        volume: 0.6,
        queue: [buildQueueItem()],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.addToNextUp({
          userId: 'user-1',
          trackId: SECOND_QUEUE_TRACK_ID,
          insertAfterQueueItemId: SECOND_QUEUE_ITEM_ID,
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_ITEM_NOT_FOUND',
        statusCode: 404,
        message: 'Queue item not found.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeQueueItem', () => {
    it('removes one matching queue item and returns the updated queue', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: SECOND_QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 44.5,
        volume: 0.8,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(
        async ({ trackId, positionSeconds, volume, queue }) => ({
          track_id: trackId,
          position_seconds: positionSeconds,
          volume,
          queue,
          saved_at: '2026-04-19T00:00:00.000Z',
        })
      );

      const result = await service.removeQueueItem({
        userId: 'user-1',
        queueItemId: SECOND_QUEUE_ITEM_ID,
      });

      expect(playerStateModel.findStateRowByUserId).toHaveBeenCalledWith('user-1');
      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 44.5,
        volume: 0.8,
        queue: [existingQueue[0], existingQueue[2]],
      });
      expect(result).toEqual({
        queue: [existingQueue[0], existingQueue[2]],
      });
    });

    it('removes only the matching occurrence when duplicate track_ids exist in the queue', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 18,
        volume: 0.6,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(async ({ queue, ...rest }) => ({
        track_id: rest.trackId,
        position_seconds: rest.positionSeconds,
        volume: rest.volume,
        queue,
        saved_at: '2026-04-19T00:00:00.000Z',
      }));

      const result = await service.removeQueueItem({
        userId: 'user-1',
        queueItemId: SECOND_QUEUE_ITEM_ID,
      });

      expect(result.queue).toEqual([existingQueue[0], existingQueue[2]]);
      expect(result.queue[0].track_id).toBe(QUEUE_TRACK_ID);
      expect(result.queue[0].queue_item_id).toBe(QUEUE_ITEM_ID);
    });

    it('removes only the first matched occurrence when corrupted duplicate queue_item_id values exist', async () => {
      const corruptedQueueItemId = QUEUE_ITEM_ID;
      const existingQueue = [
        buildQueueItem({
          queue_item_id: corruptedQueueItemId,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: corruptedQueueItemId,
          track_id: SECOND_QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 10,
        volume: 0.7,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(async ({ queue, ...rest }) => ({
        track_id: rest.trackId,
        position_seconds: rest.positionSeconds,
        volume: rest.volume,
        queue,
        saved_at: '2026-04-19T00:00:00.000Z',
      }));

      const result = await service.removeQueueItem({
        userId: 'user-1',
        queueItemId: corruptedQueueItemId,
      });

      expect(result.queue).toEqual([existingQueue[1], existingQueue[2]]);
      expect(result.queue[0].queue_item_id).toBe(corruptedQueueItemId);
      expect(result.queue[0].track_id).toBe(SECOND_QUEUE_TRACK_ID);
    });

    it('preserves current track_id, position_seconds, volume, and remaining queue order when saving', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: SECOND_QUEUE_TRACK_ID,
          queue_bucket: 'context',
          source_type: 'playlist',
          source_id: PLAYLIST_ID,
          source_position: 4,
        }),
        buildQueueItem({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          track_id: THIRD_QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 99.25,
        volume: 0.45,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockImplementation(async ({ queue, ...rest }) => ({
        track_id: rest.trackId,
        position_seconds: rest.positionSeconds,
        volume: rest.volume,
        queue,
        saved_at: '2026-04-19T00:00:00.000Z',
      }));

      const result = await service.removeQueueItem({
        userId: 'user-1',
        queueItemId: SECOND_QUEUE_ITEM_ID,
      });

      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 99.25,
        volume: 0.45,
        queue: [existingQueue[0], existingQueue[2]],
      });
      expect(result.queue).toEqual([existingQueue[0], existingQueue[2]]);
    });

    it('keeps generated legacy queue_item_id values stable for surviving items after deletion', async () => {
      const legacyQueue = [QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID];
      const rawPlayerState = {
        track_id: TRACK_ID,
        position_seconds: 14,
        volume: 0.9,
        queue: legacyQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      };

      playerStateModel.findByUserId.mockResolvedValue(rawPlayerState);

      const previewState = await service.getPlayerState({ userId: 'user-1' });

      playerStateModel.findStateRowByUserId.mockResolvedValue(rawPlayerState);
      playerStateModel.upsert.mockImplementation(async ({ queue, ...rest }) => ({
        track_id: rest.trackId,
        position_seconds: rest.positionSeconds,
        volume: rest.volume,
        queue,
        saved_at: '2026-04-19T00:00:00.000Z',
      }));

      const result = await service.removeQueueItem({
        userId: 'user-1',
        queueItemId: previewState.queue[1].queue_item_id,
      });

      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].queue_item_id).toBe(previewState.queue[0].queue_item_id);
      expect(result.queue[0].track_id).toBe(QUEUE_TRACK_ID);
      expect(playerStateModel.upsert.mock.calls[0][0].queue[0].queue_item_id).toBe(
        previewState.queue[0].queue_item_id
      );
    });

    it('returns QUEUE_ITEM_NOT_FOUND when no player state row exists', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue(null);

      await expect(
        service.removeQueueItem({
          userId: 'user-1',
          queueItemId: QUEUE_ITEM_ID,
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_ITEM_NOT_FOUND',
        statusCode: 404,
        message: 'Queue item not found.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns QUEUE_ITEM_NOT_FOUND when the stored queue is empty', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 0,
        volume: 1,
        queue: [],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.removeQueueItem({
          userId: 'user-1',
          queueItemId: QUEUE_ITEM_ID,
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_ITEM_NOT_FOUND',
        statusCode: 404,
        message: 'Queue item not found.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns QUEUE_ITEM_NOT_FOUND when the queue item id is unknown', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 12,
        volume: 0.7,
        queue: [buildQueueItem()],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.removeQueueItem({
          userId: 'user-1',
          queueItemId: SECOND_QUEUE_ITEM_ID,
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_ITEM_NOT_FOUND',
        statusCode: 404,
        message: 'Queue item not found.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('rejects malformed queue_item_id values', async () => {
      await expect(
        service.removeQueueItem({
          userId: 'user-1',
          queueItemId: 'not-a-uuid',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'queue_item_id must be a valid UUID.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects unauthorized queue item removal when userId is missing', async () => {
      await expect(
        service.removeQueueItem({
          userId: null,
          queueItemId: QUEUE_ITEM_ID,
        })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });
  });

  it('accepts a legacy queue UUID array and returns normalized queue-item objects', async () => {
    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
    playerStateModel.upsert.mockImplementation(
      async ({ trackId, positionSeconds, volume, queue }) => ({
        track_id: trackId,
        position_seconds: positionSeconds,
        volume,
        queue,
        saved_at: '2026-04-05T00:00:00.000Z',
      })
    );
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue(null);

    const state = await service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 21.5,
      volume: 0.4,
      queue: [QUEUE_TRACK_ID],
    });

    expect(playerStateModel.findExistingTrackIds).toHaveBeenCalledWith([TRACK_ID, QUEUE_TRACK_ID]);
    expect(playerStateModel.upsert).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 21.5,
      volume: 0.4,
      queue: [expect.any(Object)],
    });
    expectGeneratedQueueItem(playerStateModel.upsert.mock.calls[0][0].queue[0]);
    expectGeneratedQueueItem(state.queue[0]);
    expect(playbackModel.findLatestListeningHistoryEntryByUserAndTrack).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      playedAfter: expect.any(String),
    });
    expect(playbackModel.updateListeningHistoryProgress).not.toHaveBeenCalled();
  });

  it('accepts rich queue item objects and preserves provided metadata', async () => {
    const queueItem = buildQueueItem({
      queue_item_id: SECOND_QUEUE_ITEM_ID,
      queue_bucket: 'context',
      source_type: 'playlist',
      source_id: PLAYLIST_ID,
      source_position: 5,
    });

    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
    playerStateModel.upsert.mockImplementation(
      async ({ trackId, positionSeconds, volume, queue }) => ({
        track_id: trackId,
        position_seconds: positionSeconds,
        volume,
        queue,
        saved_at: '2026-04-05T00:00:00.000Z',
      })
    );
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue(null);

    const state = await service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 21.5,
      volume: 0.4,
      queue: [queueItem],
    });

    expect(playerStateModel.upsert.mock.calls[0][0].queue).toEqual([queueItem]);
    expect(state.queue).toEqual([queueItem]);
  });

  it('generates missing queue_item_id and added_at for queue object input', async () => {
    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
    playerStateModel.upsert.mockImplementation(
      async ({ trackId, positionSeconds, volume, queue }) => ({
        track_id: trackId,
        position_seconds: positionSeconds,
        volume,
        queue,
        saved_at: '2026-04-05T00:00:00.000Z',
      })
    );
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue(null);

    const state = await service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 8,
      queue: [{ track_id: QUEUE_TRACK_ID }],
    });

    expectGeneratedQueueItem(playerStateModel.upsert.mock.calls[0][0].queue[0]);
    expectGeneratedQueueItem(state.queue[0]);
  });

  it('defaults optional fields when saving player state', async () => {
    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);
    playerStateModel.upsert.mockResolvedValue({ track_id: TRACK_ID });
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue(null);

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

  it('allows duplicate track_ids in the queue and preserves their order', async () => {
    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID, QUEUE_TRACK_ID]);
    playerStateModel.upsert.mockImplementation(
      async ({ trackId, positionSeconds, volume, queue }) => ({
        track_id: trackId,
        position_seconds: positionSeconds,
        volume,
        queue,
        saved_at: '2026-04-05T00:00:00.000Z',
      })
    );
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue(null);

    const state = await service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 15,
      queue: [QUEUE_TRACK_ID, QUEUE_TRACK_ID],
    });

    expect(playerStateModel.findExistingTrackIds).toHaveBeenCalledWith([TRACK_ID, QUEUE_TRACK_ID]);
    expect(state.queue).toHaveLength(2);
    expect(state.queue[0].track_id).toBe(QUEUE_TRACK_ID);
    expect(state.queue[1].track_id).toBe(QUEUE_TRACK_ID);
    expect(state.queue[0].queue_item_id).not.toBe(state.queue[1].queue_item_id);
  });

  it('updates the newest matching listening-history progress when the current position moves forward', async () => {
    const state = {
      track_id: TRACK_ID,
      position_seconds: 121.9,
      volume: 0.4,
      queue: [],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);
    playerStateModel.upsert.mockResolvedValue(state);
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue({
      id: 'history-2',
      user_id: 'user-1',
      track_id: TRACK_ID,
      duration_played: 90,
      played_at: '2026-04-05T00:00:00.000Z',
    });
    playbackModel.updateListeningHistoryProgress.mockResolvedValue({
      id: 'history-2',
      duration_played: 121,
    });

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 121.9,
        volume: 0.4,
        queue: [],
      })
    ).resolves.toEqual(state);

    expect(playbackModel.updateListeningHistoryProgress).toHaveBeenCalledWith({
      historyId: 'history-2',
      progressSeconds: 121,
    });
  });

  it('does not reduce stored listening-history progress when the user seeks backward', async () => {
    const state = {
      track_id: TRACK_ID,
      position_seconds: 50,
      volume: 0.4,
      queue: [],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);
    playerStateModel.upsert.mockResolvedValue(state);
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue({
      id: 'history-2',
      user_id: 'user-1',
      track_id: TRACK_ID,
      duration_played: 100,
      played_at: '2026-04-05T00:00:00.000Z',
    });
    playbackModel.updateListeningHistoryProgress.mockResolvedValue({
      id: 'history-2',
      duration_played: 100,
    });

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 50,
        volume: 0.4,
        queue: [],
      })
    ).resolves.toEqual(state);

    expect(playerStateModel.upsert).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 50,
      volume: 0.4,
      queue: [],
    });
    expect(playbackModel.updateListeningHistoryProgress).toHaveBeenCalledWith({
      historyId: 'history-2',
      progressSeconds: 50,
    });
  });

  it('does not fail or create history when no matching listening-history row exists', async () => {
    const state = {
      track_id: TRACK_ID,
      position_seconds: 21.5,
      volume: 0.4,
      queue: [],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);
    playerStateModel.upsert.mockResolvedValue(state);
    playbackModel.findLatestListeningHistoryEntryByUserAndTrack.mockResolvedValue(null);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 21.5,
        volume: 0.4,
        queue: [],
      })
    ).resolves.toEqual(state);

    expect(playbackModel.findLatestListeningHistoryEntryByUserAndTrack).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      playedAfter: expect.any(String),
    });
    expect(playbackModel.updateListeningHistoryProgress).not.toHaveBeenCalled();
    expect(playbackModel.insertListeningHistory).not.toHaveBeenCalled();
  });

  it('rejects unauthorized save attempts when userId is missing', async () => {
    await expect(
      service.savePlayerState({
        userId: null,
        trackId: TRACK_ID,
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

    expect(playerStateModel.findExistingTrackIds).not.toHaveBeenCalled();
    expect(playbackModel.findLatestListeningHistoryEntryByUserAndTrack).not.toHaveBeenCalled();
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
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: undefined,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
  });

  it('rejects non-numeric position_seconds values', async () => {
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

    expect(playerStateModel.findExistingTrackIds).not.toHaveBeenCalled();
    expect(playerStateModel.upsert).not.toHaveBeenCalled();
    expect(playbackModel.findLatestListeningHistoryEntryByUserAndTrack).not.toHaveBeenCalled();
  });

  it('returns TRACK_NOT_FOUND when the provided track does not exist', async () => {
    playerStateModel.findExistingTrackIds.mockResolvedValue([]);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND', statusCode: 404 });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
    expect(playbackModel.findLatestListeningHistoryEntryByUserAndTrack).not.toHaveBeenCalled();
  });

  it('rejects malformed legacy queue item UUIDs', async () => {
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

  it('rejects invalid queue item object shapes', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: [{}],
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      message: 'queue item track_id is required.',
    });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid queue enum values', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: [{ track_id: QUEUE_TRACK_ID, queue_bucket: 'later' }],
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      message: 'queue item queue_bucket must be one of: next_up, context.',
    });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-existent queue track_ids', async () => {
    playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: [{ track_id: SECOND_QUEUE_TRACK_ID }],
      })
    ).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND', statusCode: 404 });

    expect(playerStateModel.upsert).not.toHaveBeenCalled();
  });
});
