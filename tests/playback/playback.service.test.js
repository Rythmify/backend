const { validate: isUuid } = require('uuid');
const service = require('../../src/services/playback.service');
const playerStateModel = require('../../src/models/player-state.model');
const playbackModel = require('../../src/models/playback.model');
const playlistsService = require('../../src/services/playlists.service');
const feedService = require('../../src/services/feed.service');
const trackLikesService = require('../../src/services/track-likes.service');
const trackRepostsService = require('../../src/services/track-reposts.service');
const tracksService = require('../../src/services/tracks.service');
const usersService = require('../../src/services/users.service');
const userModel = require('../../src/models/user.model');

jest.mock('../../src/models/player-state.model');
jest.mock('../../src/models/playback.model');
jest.mock('../../src/services/playlists.service');
jest.mock('../../src/services/feed.service');
jest.mock('../../src/services/track-likes.service');
jest.mock('../../src/services/track-reposts.service');
jest.mock('../../src/services/tracks.service');
jest.mock('../../src/services/users.service');
jest.mock('../../src/models/user.model');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const QUEUE_TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_QUEUE_TRACK_ID = '33333333-3333-4333-8333-333333333333';
const THIRD_QUEUE_TRACK_ID = '77777777-7777-4777-8777-777777777777';
const FOURTH_QUEUE_TRACK_ID = '88888888-8888-4888-8888-888888888888';
const PLAYLIST_ID = '44444444-4444-4444-8444-444444444444';
const ALBUM_ID = '12121212-1212-4212-8212-121212121212';
const GENRE_ID = '13131313-1313-4313-8313-131313131313';
const TARGET_USER_ID = '14141414-1414-4414-8414-141414141414';
const AUTH_USER_ID = '15151515-1515-4515-8515-151515151515';
const MIX_ID = 'mix_genre_16161616-1616-4616-8616-161616161616';
const QUEUE_ITEM_ID = '55555555-5555-4555-8555-555555555555';
const SECOND_QUEUE_ITEM_ID = '66666666-6666-4666-8666-666666666666';
const THIRD_QUEUE_ITEM_ID = '99999999-9999-4999-8999-999999999999';
const FOURTH_QUEUE_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUEUE_ITEM_ADDED_AT = '2026-04-18T20:00:00.000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const LOWERCASE_HEX_UUID = 'abcdefab-cdef-abcd-abcd-abcdefabcdef';
const UPPERCASE_HEX_UUID = 'ABCDEFAB-CDEF-ABCD-ABCD-ABCDEFABCDEF';
const LOWERCASE_QUEUE_TRACK_ID = 'deadbeef-cafe-babe-dead-beefabcdef12';
const UPPERCASE_QUEUE_ITEM_ID = 'FACEBEEF-CAFE-BABE-DEAD-BEEFABCDEF12';
const LOWERCASE_SOURCE_ID = 'feedface-cafe-babe-dead-beefabcdef34';
const UPPERCASE_SOURCE_TRACK_ID = 'BADC0FFE-CAFE-BABE-DEAD-BEEFABCDEF56';
const LOWERCASE_TARGET_USER_ID = 'badc0ffe-cafe-babe-dead-beefabcdef78';
const MALFORMED_UUID_CASES = [
  ['too-short', '1234'],
  ['missing-hyphens', 'abcdefabcdefabcdabcdabcdefabcdef'],
  ['non-hex', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'],
];

const buildTrackResponseMetadata = (trackId, overrides = {}) => ({
  stream_url: trackId ? `stream-${trackId}` : null,
  track_title: trackId ? `Title ${trackId.slice(0, 8)}` : null,
  artist_name: trackId ? `Artist ${trackId.slice(0, 4)}` : null,
  duration: trackId ? 180 : null,
  ...overrides,
});

const buildTrackMetadataRow = (trackId, overrides = {}) => ({
  id: trackId,
  title: `Title ${trackId.slice(0, 8)}`,
  duration: 180,
  stream_url: `stream-${trackId}`,
  audio_url: `audio-${trackId}`,
  user_id: 'artist-1',
  artist_name: `Artist ${trackId.slice(0, 4)}`,
  ...overrides,
});

const buildTrackMetadataRows = (trackIds, overridesById = {}) =>
  [...new Set(trackIds)]
    .map((trackId) => {
      if (!trackId || overridesById[trackId] === null) {
        return null;
      }

      return buildTrackMetadataRow(trackId, overridesById[trackId] || {});
    })
    .filter(Boolean);

const buildQueueItem = (overrides = {}) => {
  const trackId = Object.prototype.hasOwnProperty.call(overrides, 'track_id')
    ? overrides.track_id
    : QUEUE_TRACK_ID;

  return {
    queue_item_id: QUEUE_ITEM_ID,
    track_id: trackId,
    queue_bucket: 'next_up',
    source_type: 'track',
    source_id: null,
    source_title: null,
    source_position: null,
    added_at: QUEUE_ITEM_ADDED_AT,
    ...buildTrackResponseMetadata(trackId),
    ...overrides,
  };
};

const buildPlayerState = (overrides = {}) => {
  const trackId = Object.prototype.hasOwnProperty.call(overrides, 'track_id')
    ? overrides.track_id
    : TRACK_ID;

  return {
    track_id: trackId,
    position_seconds: 42.75,
    volume: 0.6,
    queue: [buildQueueItem()],
    saved_at: '2026-04-05T00:00:00.000Z',
    ...buildTrackResponseMetadata(trackId),
    ...overrides,
  };
};

const stripTrackResponseMetadata = ({ stream_url, track_title, artist_name, duration, ...rest }) =>
  rest;

const stripQueueTrackMetadata = (queueItems) => queueItems.map(stripTrackResponseMetadata);

const expectGeneratedQueueItem = (queueItem, overrides = {}) => {
  const expectedTrackId = overrides.track_id ?? QUEUE_TRACK_ID;
  const shouldAssertMetadata =
    ['stream_url', 'track_title', 'artist_name', 'duration'].some((fieldName) =>
      Object.prototype.hasOwnProperty.call(queueItem, fieldName)
    ) ||
    ['stream_url', 'track_title', 'artist_name', 'duration'].some((fieldName) =>
      Object.prototype.hasOwnProperty.call(overrides, fieldName)
    );

  expect(queueItem).toMatchObject({
    track_id: expectedTrackId,
    queue_bucket: 'next_up',
    source_type: 'track',
    source_id: null,
    source_title: null,
    source_position: null,
    ...(shouldAssertMetadata ? buildTrackResponseMetadata(expectedTrackId) : {}),
    ...overrides,
  });
  expect(isUuid(queueItem.queue_item_id)).toBe(true);
  expect(new Date(queueItem.added_at).toISOString()).toBe(queueItem.added_at);
};

const expectGeneratedNextUpInsertionItem = (queueItem, overrides = {}) => {
  const expectedTrackId = overrides.track_id ?? queueItem.track_id;
  const shouldAssertMetadata =
    ['stream_url', 'track_title', 'artist_name', 'duration'].some((fieldName) =>
      Object.prototype.hasOwnProperty.call(queueItem, fieldName)
    ) ||
    ['stream_url', 'track_title', 'artist_name', 'duration'].some((fieldName) =>
      Object.prototype.hasOwnProperty.call(overrides, fieldName)
    );

  expect(queueItem).toMatchObject({
    track_id: expectedTrackId,
    queue_bucket: 'next_up',
    source_type: 'track',
    source_id: null,
    source_title: null,
    source_position: null,
    ...(shouldAssertMetadata ? buildTrackResponseMetadata(expectedTrackId) : {}),
    ...overrides,
  });
  expect(isUuid(queueItem.queue_item_id)).toBe(true);
  expect(new Date(queueItem.added_at).toISOString()).toBe(queueItem.added_at);
};

beforeEach(() => {
  jest.clearAllMocks();
  playbackModel.findTrackMetadataByIds.mockImplementation(async (trackIds) =>
    buildTrackMetadataRows(trackIds)
  );
});

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

    it('accepts all-zero UUID-shaped track ids', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: ZERO_UUID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.playTrack({ trackId: ZERO_UUID })).resolves.toEqual({
        track_id: ZERO_UUID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });

      expect(playbackModel.findTrackByIdForPlaybackState).toHaveBeenCalledWith(ZERO_UUID);
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

    it('accepts uppercase UUID-shaped track ids without RFC bit checks', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: UPPERCASE_HEX_UUID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });

      await expect(service.getPlaybackState({ trackId: UPPERCASE_HEX_UUID })).resolves.toEqual({
        track_id: UPPERCASE_HEX_UUID,
        state: 'playable',
        stream_url: 'stream-url',
        preview_url: null,
        reason: null,
      });

      expect(playbackModel.findTrackByIdForPlaybackState).toHaveBeenCalledWith(UPPERCASE_HEX_UUID);
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
    const state = buildPlayerState();

    playerStateModel.findByUserId.mockResolvedValue(state);

    await expect(service.getPlayerState({ userId: 'user-1' })).resolves.toEqual(state);
    expect(playerStateModel.findByUserId).toHaveBeenCalledWith('user-1');
    expect(playbackModel.findTrackMetadataByIds).toHaveBeenCalledWith([TRACK_ID, QUEUE_TRACK_ID]);
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

  it('returns null enrichment fields when referenced player-state tracks are missing', async () => {
    playerStateModel.findByUserId.mockResolvedValue({
      track_id: TRACK_ID,
      position_seconds: 42.75,
      volume: 0.6,
      queue: [buildQueueItem({ track_id: QUEUE_TRACK_ID })],
      saved_at: '2026-04-05T00:00:00.000Z',
    });
    playbackModel.findTrackMetadataByIds.mockResolvedValue([]);

    const state = await service.getPlayerState({ userId: 'user-1' });

    expect(state).toEqual({
      track_id: TRACK_ID,
      position_seconds: 42.75,
      volume: 0.6,
      queue: [
        buildQueueItem({
          track_id: QUEUE_TRACK_ID,
          stream_url: null,
          track_title: null,
          artist_name: null,
          duration: null,
        }),
      ],
      saved_at: '2026-04-05T00:00:00.000Z',
      stream_url: null,
      track_title: null,
      artist_name: null,
      duration: null,
    });
  });

  it('batch-loads getPlayerState metadata once even when current and queued track ids repeat', async () => {
    playerStateModel.findByUserId.mockResolvedValue({
      track_id: TRACK_ID,
      position_seconds: 42.75,
      volume: 0.6,
      queue: [
        buildQueueItem({ track_id: QUEUE_TRACK_ID }),
        buildQueueItem({ queue_item_id: SECOND_QUEUE_ITEM_ID, track_id: TRACK_ID }),
      ],
      saved_at: '2026-04-05T00:00:00.000Z',
    });

    await service.getPlayerState({ userId: 'user-1' });

    expect(playbackModel.findTrackMetadataByIds).toHaveBeenCalledTimes(1);
    expect(playbackModel.findTrackMetadataByIds).toHaveBeenCalledWith([TRACK_ID, QUEUE_TRACK_ID]);
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
            comment_count: 7,
            repost_count: 2,
            stream_url: 'stream-1',
            audio_url: 'audio-1',
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
            comment_count: 1,
            repost_count: 5,
            stream_url: 'stream-2',
            audio_url: 'audio-2',
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
    it('calls the model and returns the cleared row count when history exists', async () => {
      playbackModel.softDeleteListeningHistoryByUserId.mockResolvedValue(3);

      await expect(service.clearListeningHistory({ userId: 'user-1' })).resolves.toBe(3);
      expect(playbackModel.softDeleteListeningHistoryByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns zero when the user has no listening history', async () => {
      playbackModel.softDeleteListeningHistoryByUserId.mockResolvedValue(0);

      await expect(service.clearListeningHistory({ userId: 'user-1' })).resolves.toBe(0);
      expect(playbackModel.softDeleteListeningHistoryByUserId).toHaveBeenCalledWith('user-1');
    });

    it('throws unauthorized when userId is missing', async () => {
      await expect(service.clearListeningHistory({ userId: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playbackModel.softDeleteListeningHistoryByUserId).not.toHaveBeenCalled();
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
            comment_count: 7,
            repost_count: 2,
            stream_url: 'stream-1',
            audio_url: 'audio-1',
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
            comment_count: 7,
            repost_count: 2,
            stream_url: 'stream-1',
            audio_url: 'audio-1',
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

    it('rejects history events with missing played_at', async () => {
      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [{ track_id: TRACK_ID }],
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'played_at is required.',
      });
    });

    it('rejects history events with invalid played_at values', async () => {
      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [{ track_id: TRACK_ID, played_at: 'not-a-date' }],
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'played_at must be a valid datetime.',
      });
    });

    it('rejects history events with negative duration_played_seconds', async () => {
      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [
            {
              track_id: TRACK_ID,
              played_at: getRecentTimestampIso(-60 * 1000),
              duration_played_seconds: -1,
            },
          ],
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'duration_played_seconds must be an integer greater than or equal to 0.',
      });
    });

    it('rejects history events that are more than 7 days old', async () => {
      await expect(
        service.syncPlayback({
          userId: 'user-1',
          historyEvents: [
            {
              track_id: TRACK_ID,
              played_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'played_at must not be more than 7 days in the past.',
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

    it('rejects missing current_state.state_updated_at', async () => {
      playerStateModel.findExistingTrackIds.mockResolvedValue([TRACK_ID]);

      await expect(
        service.syncPlayback({
          userId: 'user-1',
          currentState: {
            track_id: TRACK_ID,
            position_seconds: 12.5,
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'current_state.state_updated_at is required.',
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

    it('accepts lowercase and all-zero UUID-shaped values in sync payloads', async () => {
      const playedAt = getRecentTimestampIso(-60 * 1000);
      const stateUpdatedAt = getRecentTimestampIso();

      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        ...publicReadyTrack,
        id: LOWERCASE_HEX_UUID,
      });
      playbackModel.findRecentListeningHistoryEntry.mockResolvedValue(null);
      playbackModel.insertListeningHistory.mockResolvedValue({
        id: 'history-1',
        user_id: 'user-1',
        track_id: LOWERCASE_HEX_UUID,
        duration_played: 45,
        played_at: playedAt,
      });
      playerStateModel.findExistingTrackIds.mockResolvedValue([
        ZERO_UUID,
        LOWERCASE_QUEUE_TRACK_ID,
      ]);
      playerStateModel.upsertIfNewer.mockImplementation(async ({ trackId, queue, updatedAt }) => ({
        track_id: trackId,
        position_seconds: 12.5,
        volume: 1,
        queue,
        saved_at: updatedAt,
      }));

      const result = await service.syncPlayback({
        userId: 'user-1',
        historyEvents: [
          {
            track_id: LOWERCASE_HEX_UUID,
            played_at: playedAt,
            duration_played_seconds: 45,
          },
        ],
        currentState: {
          track_id: ZERO_UUID,
          position_seconds: 12.5,
          queue: [LOWERCASE_QUEUE_TRACK_ID],
          state_updated_at: stateUpdatedAt,
        },
      });

      expect(playbackModel.findTrackByIdForPlaybackState).toHaveBeenCalledWith(LOWERCASE_HEX_UUID);
      expect(playerStateModel.findExistingTrackIds).toHaveBeenCalledWith([
        ZERO_UUID,
        LOWERCASE_QUEUE_TRACK_ID,
      ]);
      expect(result.current_state).toMatchObject({
        track_id: ZERO_UUID,
        position_seconds: 12.5,
        volume: 1,
      });
      expect(result.current_state.queue[0].track_id).toBe(LOWERCASE_QUEUE_TRACK_ID);
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
          ...buildTrackResponseMetadata(TRACK_ID),
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
      const currentSavedState = buildPlayerState({
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
      });

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

  describe('addQueueContext', () => {
    beforeEach(() => {
      playerStateModel.findStateRowByUserId.mockReset();
      playerStateModel.upsert.mockReset();
      playbackModel.findTrackByIdForPlaybackState.mockReset();
      playbackModel.findListeningHistoryByUserId.mockReset();
      playlistsService.getPlaylist.mockReset();
      feedService.getTrendingByGenre.mockReset();
      feedService.getMixById.mockReset();
      feedService.getStationTracks.mockReset();
      trackLikesService.getUserLikedTracks.mockReset();
      trackRepostsService.getUserRepostedTracks.mockReset();
      tracksService.getMyTracks.mockReset();
      usersService.getUserTracks.mockReset();
      userModel.findById.mockReset();

      playerStateModel.findStateRowByUserId.mockResolvedValue(null);
    });

    const mockPlayableTracks = (trackIds, overridesById = {}) => {
      const trackIdSet = new Set(trackIds);

      playbackModel.findTrackByIdForPlaybackState.mockImplementation(async (trackId) => {
        if (!trackIdSet.has(trackId) && !overridesById[trackId]) {
          return null;
        }

        return {
          id: trackId,
          user_id: 'artist-1',
          status: 'ready',
          is_public: true,
          is_hidden: false,
          secret_token: null,
          stream_url: `stream-${trackId}`,
          preview_url: null,
          enable_app_playback: true,
          ...overridesById[trackId],
        };
      });
    };

    const mockSavedPlayerStateUpsert = () => {
      playerStateModel.upsert.mockImplementation(
        async ({ trackId, positionSeconds, volume, queue }) => ({
          track_id: trackId,
          position_seconds: positionSeconds,
          volume,
          queue,
          saved_at: '2026-04-19T00:00:00.000Z',
        })
      );
    };

    it('queues a single track into next_up and preserves the existing context bucket order', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: FOURTH_QUEUE_TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 22,
        volume: 0.5,
        queue: [
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
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'track',
        sourceId: FOURTH_QUEUE_TRACK_ID,
      });

      expect(result.track_id).toBe(TRACK_ID);
      expect(result.position_seconds).toBe(22);
      expect(result.queue.map((queueItem) => queueItem.queue_item_id)).toEqual([
        QUEUE_ITEM_ID,
        SECOND_QUEUE_ITEM_ID,
        result.queue[2].queue_item_id,
        THIRD_QUEUE_ITEM_ID,
      ]);
      expectGeneratedNextUpInsertionItem(result.queue[2], {
        track_id: FOURTH_QUEUE_TRACK_ID,
      });
      expect(result.queue[2].source_id).toBeNull();
      expect(result.queue[3]).toMatchObject({
        queue_item_id: THIRD_QUEUE_ITEM_ID,
        queue_bucket: 'context',
      });
    });

    it('creates a queue-only state when queuing a single track into an empty player state', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: SECOND_QUEUE_TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });
      playerStateModel.findStateRowByUserId.mockResolvedValue(null);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'track',
        sourceId: SECOND_QUEUE_TRACK_ID,
      });

      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: AUTH_USER_ID,
        trackId: null,
        positionSeconds: 0,
        volume: 1,
        queue: [expect.any(Object)],
      });
      expect(result.queue).toHaveLength(1);
      expectGeneratedNextUpInsertionItem(result.queue[0], {
        track_id: SECOND_QUEUE_TRACK_ID,
      });
    });

    it('accepts UUID-shaped track source_id values without RFC bit checks', async () => {
      playbackModel.findTrackByIdForPlaybackState.mockResolvedValue({
        id: UPPERCASE_SOURCE_TRACK_ID,
        user_id: 'owner-1',
        status: 'ready',
        is_public: true,
        is_hidden: false,
        secret_token: null,
        stream_url: 'stream-url',
        preview_url: null,
        enable_app_playback: true,
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'track',
        sourceId: UPPERCASE_SOURCE_TRACK_ID,
      });

      expect(playbackModel.findTrackByIdForPlaybackState).toHaveBeenCalledWith(
        UPPERCASE_SOURCE_TRACK_ID
      );
      expect(result.queue[0]).toMatchObject({
        track_id: UPPERCASE_SOURCE_TRACK_ID,
        source_type: 'track',
        source_id: null,
      });
    });

    it('rejects source_type track when interaction_type is play', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'play',
          sourceType: 'track',
          sourceId: SECOND_QUEUE_TRACK_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'source_type track only supports interaction_type next_up.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('rejects target_user_id for source_type track', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'track',
          sourceId: SECOND_QUEUE_TRACK_ID,
          targetUserId: TARGET_USER_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'target_user_id is not supported for source_type track.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects unauthorized queue-context requests when userId is missing', async () => {
      await expect(
        service.addQueueContext({
          userId: null,
          interactionType: 'next_up',
          sourceType: 'track',
          sourceId: SECOND_QUEUE_TRACK_ID,
        })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
        message: 'Authenticated user is required.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects missing interaction_type', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          sourceType: 'playlist',
          sourceId: PLAYLIST_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'interaction_type is required.',
      });
    });

    it('rejects missing source_type', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceId: PLAYLIST_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'source_type is required.',
      });
    });

    it('rejects source_id for user-scoped source types', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'liked_tracks',
          sourceId: PLAYLIST_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message:
          'source_id is not supported for source_type liked_tracks. Use target_user_id instead.',
      });
    });

    it('rejects target_user_id for non-user-scoped context types', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'playlist',
          sourceId: PLAYLIST_ID,
          targetUserId: TARGET_USER_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'target_user_id is not supported for source_type playlist.',
      });
    });

    it('rejects missing source_id for track, playlist, and mix contexts', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'track',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'source_id is required.',
      });

      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'play',
          sourceType: 'playlist',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'source_id is required.',
      });

      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'mix',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'source_id is required.',
      });
    });

    it('plays a playlist on an empty state and stores the remaining tracks as context', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Morning Rotation',
        subtype: 'playlist',
        tracks: [
          { track_id: QUEUE_TRACK_ID },
          { track_id: SECOND_QUEUE_TRACK_ID },
          { track_id: THIRD_QUEUE_TRACK_ID },
        ],
      });
      mockPlayableTracks([QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID, THIRD_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'play',
        sourceType: 'playlist',
        sourceId: PLAYLIST_ID,
      });

      expect(playlistsService.getPlaylist).toHaveBeenCalledWith({
        playlistId: PLAYLIST_ID,
        userId: AUTH_USER_ID,
        secretToken: null,
        includeTracks: true,
      });
      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: AUTH_USER_ID,
        trackId: QUEUE_TRACK_ID,
        positionSeconds: 0,
        volume: 1,
        queue: [expect.any(Object), expect.any(Object)],
      });
      expect(result.track_id).toBe(QUEUE_TRACK_ID);
      expect(result).toMatchObject(buildTrackResponseMetadata(QUEUE_TRACK_ID));
      expect(result.queue).toHaveLength(2);
      expect(result.queue[0]).toMatchObject({
        track_id: SECOND_QUEUE_TRACK_ID,
        queue_bucket: 'context',
        source_type: 'playlist',
        source_id: PLAYLIST_ID,
        source_title: 'Morning Rotation',
        source_position: 2,
        ...buildTrackResponseMetadata(SECOND_QUEUE_TRACK_ID),
      });
      expect(result.queue[1]).toMatchObject({
        track_id: THIRD_QUEUE_TRACK_ID,
        queue_bucket: 'context',
        source_type: 'playlist',
        source_id: PLAYLIST_ID,
        source_title: 'Morning Rotation',
        source_position: 3,
        ...buildTrackResponseMetadata(THIRD_QUEUE_TRACK_ID),
      });
    });

    it('returns USER_NOT_FOUND for user-scoped contexts when the target user does not exist', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'liked_tracks',
          targetUserId: TARGET_USER_ID,
        })
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
        message: 'User not found',
      });
    });

    it('returns PLAYLIST_NOT_FOUND when playlist source_type resolves to an album-like subtype', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Actually An Album',
        subtype: 'album',
        tracks: [{ track_id: QUEUE_TRACK_ID }],
      });

      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'play',
          sourceType: 'playlist',
          sourceId: PLAYLIST_ID,
        })
      ).rejects.toMatchObject({
        code: 'PLAYLIST_NOT_FOUND',
        statusCode: 404,
        message: 'Playlist not found.',
      });
    });

    it('returns ALBUM_NOT_FOUND when album source_type resolves to a playlist subtype', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: ALBUM_ID,
        name: 'Actually A Playlist',
        subtype: 'playlist',
        tracks: [{ track_id: QUEUE_TRACK_ID }],
      });

      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'play',
          sourceType: 'album',
          sourceId: ALBUM_ID,
        })
      ).rejects.toMatchObject({
        code: 'ALBUM_NOT_FOUND',
        statusCode: 404,
        message: 'Album not found.',
      });
    });

    it('inserts next_up context items before an existing context bucket', async () => {
      feedService.getTrendingByGenre.mockResolvedValue({
        genre_id: GENRE_ID,
        genre_name: 'Electronic',
        tracks: [{ id: THIRD_QUEUE_TRACK_ID }, { id: FOURTH_QUEUE_TRACK_ID }],
        pagination: { limit: 100, offset: 0, total: 2 },
      });
      mockPlayableTracks([THIRD_QUEUE_TRACK_ID, FOURTH_QUEUE_TRACK_ID]);
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 18,
        volume: 0.55,
        queue: [
          buildQueueItem({
            queue_item_id: THIRD_QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
            queue_bucket: 'context',
            source_type: 'playlist',
            source_id: PLAYLIST_ID,
            source_title: 'Old Playlist',
            source_position: 2,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'genre',
        sourceId: GENRE_ID,
      });

      expect(result.track_id).toBe(TRACK_ID);
      expect(result.position_seconds).toBe(18);
      expect(result.queue).toHaveLength(3);
      expect(result.queue[0]).toMatchObject({
        track_id: THIRD_QUEUE_TRACK_ID,
        queue_bucket: 'next_up',
        source_type: 'genre',
        source_id: GENRE_ID,
        source_title: 'Electronic',
        source_position: 1,
      });
      expect(result.queue[1]).toMatchObject({
        track_id: FOURTH_QUEUE_TRACK_ID,
        queue_bucket: 'next_up',
        source_type: 'genre',
        source_id: GENRE_ID,
        source_title: 'Electronic',
        source_position: 2,
      });
      expect(result.queue[2]).toEqual(
        expect.objectContaining({
          queue_item_id: THIRD_QUEUE_ITEM_ID,
          queue_bucket: 'context',
          source_title: 'Old Playlist',
        })
      );
    });

    it('preserves next_up items and replaces only the context bucket on play', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: ALBUM_ID,
        name: 'Deep Cuts',
        subtype: 'album',
        tracks: [{ track_id: FOURTH_QUEUE_TRACK_ID }, { track_id: THIRD_QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([FOURTH_QUEUE_TRACK_ID, THIRD_QUEUE_TRACK_ID]);
      const existingNextUpItem = buildQueueItem({
        queue_item_id: QUEUE_ITEM_ID,
        track_id: QUEUE_TRACK_ID,
      });

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 40,
        volume: 0.9,
        queue: [
          existingNextUpItem,
          buildQueueItem({
            queue_item_id: SECOND_QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
            queue_bucket: 'context',
            source_type: 'playlist',
            source_id: PLAYLIST_ID,
            source_title: 'Old Playlist',
            source_position: 3,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'play',
        sourceType: 'album',
        sourceId: ALBUM_ID,
      });

      expect(result.track_id).toBe(FOURTH_QUEUE_TRACK_ID);
      expect(result.position_seconds).toBe(0);
      expect(result.volume).toBe(0.9);
      expect(result.queue).toHaveLength(2);
      expect(result.queue[0]).toEqual(existingNextUpItem);
      expect(result.queue[1]).toMatchObject({
        track_id: THIRD_QUEUE_TRACK_ID,
        queue_bucket: 'context',
        source_type: 'album',
        source_id: ALBUM_ID,
        source_title: 'Deep Cuts',
        source_position: 2,
      });
    });

    it('preserves next_up items with context source types when replacing play context', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: ALBUM_ID,
        name: 'Deep Cuts',
        subtype: 'album',
        tracks: [{ track_id: FOURTH_QUEUE_TRACK_ID }, { track_id: THIRD_QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([FOURTH_QUEUE_TRACK_ID, THIRD_QUEUE_TRACK_ID]);
      const playlistNextUpItem = buildQueueItem({
        queue_item_id: QUEUE_ITEM_ID,
        track_id: QUEUE_TRACK_ID,
        queue_bucket: 'next_up',
        source_type: 'playlist',
        source_id: PLAYLIST_ID,
        source_title: 'Queued Playlist',
        source_position: 4,
      });
      const genreNextUpItem = buildQueueItem({
        queue_item_id: SECOND_QUEUE_ITEM_ID,
        track_id: SECOND_QUEUE_TRACK_ID,
        queue_bucket: 'next_up',
        source_type: 'genre',
        source_id: GENRE_ID,
        source_title: 'Queued Genre',
        source_position: 7,
      });

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 40,
        volume: 0.9,
        queue: [
          playlistNextUpItem,
          genreNextUpItem,
          buildQueueItem({
            queue_item_id: THIRD_QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
            queue_bucket: 'context',
            source_type: 'playlist',
            source_id: PLAYLIST_ID,
            source_title: 'Old Playlist',
            source_position: 3,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'play',
        sourceType: 'album',
        sourceId: ALBUM_ID,
      });

      expect(result.track_id).toBe(FOURTH_QUEUE_TRACK_ID);
      expect(result.position_seconds).toBe(0);
      expect(result.queue).toHaveLength(3);
      expect(result.queue[0]).toMatchObject({
        queue_item_id: QUEUE_ITEM_ID,
        queue_bucket: 'next_up',
        source_type: 'playlist',
        source_id: PLAYLIST_ID,
      });
      expect(result.queue[1]).toMatchObject({
        queue_item_id: SECOND_QUEUE_ITEM_ID,
        queue_bucket: 'next_up',
        source_type: 'genre',
        source_id: GENRE_ID,
      });
      expect(result.queue[2]).toMatchObject({
        track_id: THIRD_QUEUE_TRACK_ID,
        queue_bucket: 'context',
        source_type: 'album',
        source_id: ALBUM_ID,
      });
      expect(result.queue.map((queueItem) => queueItem.queue_item_id)).not.toContain(
        THIRD_QUEUE_ITEM_ID
      );
    });

    it('returns the current state without writing when the play context is already loaded', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Morning Rotation Renamed',
        subtype: 'playlist',
        tracks: [{ track_id: QUEUE_TRACK_ID }, { track_id: SECOND_QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID]);
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: QUEUE_TRACK_ID,
        position_seconds: 91,
        volume: 0.7,
        queue: [
          buildQueueItem({
            queue_item_id: THIRD_QUEUE_ITEM_ID,
            track_id: THIRD_QUEUE_TRACK_ID,
            queue_bucket: 'next_up',
          }),
          buildQueueItem({
            queue_item_id: SECOND_QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
            queue_bucket: 'context',
            source_type: 'playlist',
            source_id: PLAYLIST_ID,
            source_title: 'Morning Rotation',
            source_position: 2,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'play',
        sourceType: 'playlist',
        sourceId: PLAYLIST_ID,
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
      expect(result.track_id).toBe(QUEUE_TRACK_ID);
      expect(result.position_seconds).toBe(91);
      expect(result.queue.map((queueItem) => queueItem.queue_item_id)).toEqual([
        THIRD_QUEUE_ITEM_ID,
        SECOND_QUEUE_ITEM_ID,
      ]);
      expect(result.queue[1]).toMatchObject({
        track_id: SECOND_QUEUE_TRACK_ID,
        queue_bucket: 'context',
        source_type: 'playlist',
        source_id: PLAYLIST_ID,
        source_position: 2,
      });
    });

    it('returns the current state without writing when a single-track play context is already loaded', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Single Track Rotation',
        subtype: 'playlist',
        tracks: [{ track_id: QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([QUEUE_TRACK_ID]);
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: QUEUE_TRACK_ID,
        position_seconds: 37,
        volume: 0.7,
        queue: [
          buildQueueItem({
            queue_item_id: THIRD_QUEUE_ITEM_ID,
            track_id: THIRD_QUEUE_TRACK_ID,
            queue_bucket: 'next_up',
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'play',
        sourceType: 'playlist',
        sourceId: PLAYLIST_ID,
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
      expect(result.track_id).toBe(QUEUE_TRACK_ID);
      expect(result.position_seconds).toBe(37);
      expect(result.queue.map((queueItem) => queueItem.queue_item_id)).toEqual([
        THIRD_QUEUE_ITEM_ID,
      ]);
    });

    it('replaces context when the same source type resolves with a different source_id', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Morning Rotation',
        subtype: 'playlist',
        tracks: [{ track_id: QUEUE_TRACK_ID }, { track_id: SECOND_QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID]);
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: QUEUE_TRACK_ID,
        position_seconds: 91,
        volume: 0.7,
        queue: [
          buildQueueItem({
            queue_item_id: SECOND_QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
            queue_bucket: 'context',
            source_type: 'playlist',
            source_id: ALBUM_ID,
            source_title: 'Other Playlist',
            source_position: 2,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'play',
        sourceType: 'playlist',
        sourceId: PLAYLIST_ID,
      });

      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: AUTH_USER_ID,
        trackId: QUEUE_TRACK_ID,
        positionSeconds: 0,
        volume: 0.7,
        queue: [expect.any(Object)],
      });
      expect(result.position_seconds).toBe(0);
      expect(result.queue).toHaveLength(1);
      expect(result.queue[0]).toMatchObject({
        track_id: SECOND_QUEUE_TRACK_ID,
        queue_bucket: 'context',
        source_type: 'playlist',
        source_id: PLAYLIST_ID,
      });
    });

    it('appends multiple next_up context operations to the end of the next_up bucket', async () => {
      feedService.getTrendingByGenre.mockResolvedValue({
        genre_id: GENRE_ID,
        genre_name: 'Electronic',
        tracks: [{ id: THIRD_QUEUE_TRACK_ID }],
        pagination: { limit: 100, offset: 0, total: 1 },
      });
      feedService.getMixById.mockResolvedValue({
        mix_id: MIX_ID,
        title: 'Electronic Mix',
        tracks: [{ id: FOURTH_QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([THIRD_QUEUE_TRACK_ID, FOURTH_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      playerStateModel.findStateRowByUserId.mockResolvedValueOnce({
        track_id: TRACK_ID,
        position_seconds: 10,
        volume: 0.4,
        queue: [],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      const firstResult = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'genre',
        sourceId: GENRE_ID,
      });

      playerStateModel.findStateRowByUserId.mockResolvedValueOnce({
        track_id: TRACK_ID,
        position_seconds: 10,
        volume: 0.4,
        queue: firstResult.queue,
        saved_at: '2026-04-19T00:00:00.000Z',
      });
      const secondResult = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'mix',
        sourceId: MIX_ID,
      });

      expect(secondResult.queue).toHaveLength(2);
      expect(secondResult.queue[0]).toMatchObject({
        track_id: THIRD_QUEUE_TRACK_ID,
        queue_bucket: 'next_up',
        source_type: 'genre',
        source_id: GENRE_ID,
      });
      expect(secondResult.queue[1]).toMatchObject({
        track_id: FOURTH_QUEUE_TRACK_ID,
        queue_bucket: 'next_up',
        source_type: 'mix',
        source_id: MIX_ID,
      });
    });

    it('filters inaccessible tracks from a playlist context while preserving playable items', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Mixed Visibility',
        subtype: 'playlist',
        tracks: [
          { track_id: QUEUE_TRACK_ID },
          { track_id: SECOND_QUEUE_TRACK_ID },
          { track_id: THIRD_QUEUE_TRACK_ID },
        ],
      });
      mockPlayableTracks([QUEUE_TRACK_ID], {
        [SECOND_QUEUE_TRACK_ID]: null,
        [THIRD_QUEUE_TRACK_ID]: {
          is_public: false,
          secret_token: 'secret-123',
        },
      });
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'playlist',
        sourceId: PLAYLIST_ID,
      });

      expect(result.queue).toHaveLength(1);
      expect(result.queue[0]).toMatchObject({
        track_id: QUEUE_TRACK_ID,
        source_type: 'playlist',
        source_position: 1,
      });
    });

    it('allows duplicate tracks and gives each occurrence a distinct queue_item_id', async () => {
      playbackModel.findListeningHistoryByUserId
        .mockResolvedValueOnce([
          { id: 'history-1', track: { id: QUEUE_TRACK_ID } },
          { id: 'history-2', track: { id: QUEUE_TRACK_ID } },
        ])
        .mockResolvedValueOnce([]);
      mockPlayableTracks([QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();
      userModel.findById.mockResolvedValue({
        id: AUTH_USER_ID,
        display_name: 'Listener',
        username: 'listener',
      });

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'listening_history',
      });

      expect(result.queue).toHaveLength(2);
      expect(result.queue[0].track_id).toBe(QUEUE_TRACK_ID);
      expect(result.queue[1].track_id).toBe(QUEUE_TRACK_ID);
      expect(result.queue[0].queue_item_id).not.toBe(result.queue[1].queue_item_id);
      expect(result.queue[0].source_position).toBe(1);
      expect(result.queue[1].source_position).toBe(2);
    });

    it('defaults target_user_id to the authenticated user for liked_tracks, reposts, and user_tracks', async () => {
      userModel.findById.mockResolvedValue({
        id: AUTH_USER_ID,
        display_name: 'Listener',
        username: 'listener',
      });
      trackLikesService.getUserLikedTracks.mockResolvedValue({
        items: [{ id: QUEUE_TRACK_ID }],
        total: 1,
        limit: 100,
        offset: 0,
      });
      trackRepostsService.getUserRepostedTracks.mockResolvedValue({
        items: [{ id: SECOND_QUEUE_TRACK_ID }],
        total: 1,
        limit: 100,
        offset: 0,
      });
      tracksService.getMyTracks.mockResolvedValue({
        data: [{ id: THIRD_QUEUE_TRACK_ID }],
        pagination: { limit: 100, offset: 0, total: 1 },
      });
      mockPlayableTracks([QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID, THIRD_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'liked_tracks',
      });
      expect(trackLikesService.getUserLikedTracks).toHaveBeenCalledWith(AUTH_USER_ID, 100, 0);
      expect(playerStateModel.upsert.mock.calls[0][0].queue[0]).toMatchObject({
        source_type: 'liked_tracks',
        source_id: AUTH_USER_ID,
        source_title: 'Your liked tracks',
      });

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: null,
        position_seconds: 0,
        volume: 1,
        queue: [],
        saved_at: '2026-04-19T00:00:00.000Z',
      });
      await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'reposts',
      });
      expect(trackRepostsService.getUserRepostedTracks).toHaveBeenCalledWith(AUTH_USER_ID, 100, 0);
      expect(playerStateModel.upsert.mock.calls[1][0].queue[0]).toMatchObject({
        source_type: 'reposts',
        source_id: AUTH_USER_ID,
        source_title: 'Your reposts',
      });

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: null,
        position_seconds: 0,
        volume: 1,
        queue: [],
        saved_at: '2026-04-19T00:00:00.000Z',
      });
      await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'user_tracks',
      });
      expect(tracksService.getMyTracks).toHaveBeenCalledWith(AUTH_USER_ID, {
        limit: 100,
        offset: 0,
      });
      expect(playerStateModel.upsert.mock.calls[2][0].queue[0]).toMatchObject({
        source_type: 'user_tracks',
        source_id: AUTH_USER_ID,
        source_title: 'Your tracks',
      });
    });

    it('uses the target user display name for another user scoped context', async () => {
      userModel.findById.mockResolvedValue({
        id: TARGET_USER_ID,
        display_name: 'Curator',
        username: 'curator_1',
      });
      trackLikesService.getUserLikedTracks.mockResolvedValue({
        items: [{ id: QUEUE_TRACK_ID }],
        total: 1,
        limit: 100,
        offset: 0,
      });
      mockPlayableTracks([QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'liked_tracks',
        targetUserId: TARGET_USER_ID,
      });

      expect(trackLikesService.getUserLikedTracks).toHaveBeenCalledWith(TARGET_USER_ID, 100, 0);
      expect(result.queue[0]).toMatchObject({
        source_type: 'liked_tracks',
        source_id: TARGET_USER_ID,
        source_title: "Curator's liked tracks",
      });
    });

    it('rejects listening_history for another user', async () => {
      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'next_up',
          sourceType: 'listening_history',
          targetUserId: TARGET_USER_ID,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'listening_history only supports the authenticated user.',
      });

      expect(playbackModel.findListeningHistoryByUserId).not.toHaveBeenCalled();
    });

    it('accepts non-UUID mix source_id values', async () => {
      feedService.getMixById.mockResolvedValue({
        mix_id: MIX_ID,
        title: 'Electronic Mix',
        tracks: [{ id: QUEUE_TRACK_ID }, { id: SECOND_QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'mix',
        sourceId: MIX_ID,
      });

      expect(feedService.getMixById).toHaveBeenCalledWith(AUTH_USER_ID, MIX_ID);
      expect(result.queue[0]).toMatchObject({
        source_type: 'mix',
        source_id: MIX_ID,
        source_title: 'Electronic Mix',
      });
    });

    it('returns QUEUE_CONTEXT_EMPTY when the source resolves but no track is playable', async () => {
      playlistsService.getPlaylist.mockResolvedValue({
        playlist_id: PLAYLIST_ID,
        name: 'Unavailable Playlist',
        subtype: 'playlist',
        tracks: [{ track_id: QUEUE_TRACK_ID }],
      });
      mockPlayableTracks([], {
        [QUEUE_TRACK_ID]: {
          enable_app_playback: false,
        },
      });

      await expect(
        service.addQueueContext({
          userId: AUTH_USER_ID,
          interactionType: 'play',
          sourceType: 'playlist',
          sourceId: PLAYLIST_ID,
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_CONTEXT_EMPTY',
        statusCode: 404,
        message: 'Resolved queue context contains no playable tracks.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('persists queue-only state for next_up when no current track exists', async () => {
      userModel.findById.mockResolvedValue({
        id: AUTH_USER_ID,
        display_name: 'Listener',
        username: 'listener',
      });
      trackLikesService.getUserLikedTracks.mockResolvedValue({
        items: [{ id: QUEUE_TRACK_ID }, { id: SECOND_QUEUE_TRACK_ID }],
        total: 2,
        limit: 100,
        offset: 0,
      });
      mockPlayableTracks([QUEUE_TRACK_ID, SECOND_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'liked_tracks',
      });

      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: AUTH_USER_ID,
        trackId: null,
        positionSeconds: 0,
        volume: 1,
        queue: [expect.any(Object), expect.any(Object)],
      });
      expect(result.track_id).toBeNull();
      expect(result.queue).toHaveLength(2);
      expect(result.queue[0].queue_bucket).toBe('next_up');
      expect(result.queue[1].queue_bucket).toBe('next_up');
    });

    it('paginates station contexts beyond the first page', async () => {
      const stationTracksPageOne = Array.from({ length: 100 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      }));
      const stationTracksPageTwo = [{ id: QUEUE_TRACK_ID }];

      feedService.getStationTracks
        .mockResolvedValueOnce({
          station: { artist_id: TARGET_USER_ID, name: 'Target Station' },
          data: stationTracksPageOne,
          pagination: { limit: 100, offset: 0, total: 101 },
        })
        .mockResolvedValueOnce({
          station: { artist_id: TARGET_USER_ID, name: 'Target Station' },
          data: stationTracksPageTwo,
          pagination: { limit: 100, offset: 100, total: 101 },
        });
      mockPlayableTracks([QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'station',
        sourceId: TARGET_USER_ID,
      });

      expect(feedService.getStationTracks).toHaveBeenNthCalledWith(
        2,
        TARGET_USER_ID,
        { limit: 100, offset: 100 },
        AUTH_USER_ID
      );
      expect(result.queue[0]).toMatchObject({
        source_type: 'station',
        source_id: TARGET_USER_ID,
        source_title: 'Target Station',
        track_id: QUEUE_TRACK_ID,
      });
    });

    it('paginates genre contexts beyond the first page', async () => {
      const genreTracksPageOne = Array.from({ length: 100 }, (_, index) => ({
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      }));
      const genreTracksPageTwo = [{ id: SECOND_QUEUE_TRACK_ID }];

      feedService.getTrendingByGenre
        .mockResolvedValueOnce({
          genre_id: GENRE_ID,
          genre_name: 'Electronic',
          tracks: genreTracksPageOne,
          pagination: { limit: 100, offset: 0, total: 101 },
        })
        .mockResolvedValueOnce({
          genre_id: GENRE_ID,
          genre_name: 'Electronic',
          tracks: genreTracksPageTwo,
          pagination: { limit: 100, offset: 100, total: 101 },
        });
      mockPlayableTracks([SECOND_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'genre',
        sourceId: GENRE_ID,
      });

      expect(feedService.getTrendingByGenre).toHaveBeenNthCalledWith(
        2,
        GENRE_ID,
        { limit: 100, offset: 100 },
        AUTH_USER_ID
      );
      expect(result.queue[0]).toMatchObject({
        source_type: 'genre',
        source_id: GENRE_ID,
        source_title: 'Electronic',
        track_id: SECOND_QUEUE_TRACK_ID,
      });
    });

    it('loads public user_tracks through usersService for another user', async () => {
      userModel.findById.mockResolvedValue({
        id: TARGET_USER_ID,
        display_name: null,
        username: 'guest_artist',
      });
      usersService.getUserTracks.mockResolvedValue({
        data: [{ id: THIRD_QUEUE_TRACK_ID }],
        pagination: { limit: 100, offset: 0, total: 1 },
      });
      mockPlayableTracks([THIRD_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'user_tracks',
        targetUserId: TARGET_USER_ID,
      });

      expect(usersService.getUserTracks).toHaveBeenCalledWith({
        userId: TARGET_USER_ID,
        limit: 100,
        offset: 0,
      });
      expect(result.queue[0]).toMatchObject({
        source_type: 'user_tracks',
        source_id: TARGET_USER_ID,
        source_title: "guest_artist's tracks",
      });
    });

    it('accepts UUID-shaped target_user_id values without RFC bit checks', async () => {
      userModel.findById.mockResolvedValue({
        id: LOWERCASE_TARGET_USER_ID,
        display_name: 'Guest Artist',
        username: 'guest_artist',
      });
      usersService.getUserTracks.mockResolvedValue({
        data: [{ id: THIRD_QUEUE_TRACK_ID }],
        pagination: { limit: 100, offset: 0, total: 1 },
      });
      mockPlayableTracks([THIRD_QUEUE_TRACK_ID]);
      mockSavedPlayerStateUpsert();

      const result = await service.addQueueContext({
        userId: AUTH_USER_ID,
        interactionType: 'next_up',
        sourceType: 'user_tracks',
        targetUserId: LOWERCASE_TARGET_USER_ID,
      });

      expect(usersService.getUserTracks).toHaveBeenCalledWith({
        userId: LOWERCASE_TARGET_USER_ID,
        limit: 100,
        offset: 0,
      });
      expect(result.queue[0]).toMatchObject({
        source_type: 'user_tracks',
        source_id: LOWERCASE_TARGET_USER_ID,
      });
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
        queue: stripQueueTrackMetadata([existingQueue[0], existingQueue[2]]),
      });
      expect(result).toEqual({
        queue: [existingQueue[0], existingQueue[2]],
      });
    });

    it('accepts all-zero UUID-shaped queue_item_id values', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: ZERO_UUID,
          track_id: QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 44.5,
        volume: 0.8,
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
        queueItemId: ZERO_UUID,
      });

      expect(result).toEqual({ queue: [] });
      expect(playerStateModel.findStateRowByUserId).toHaveBeenCalledWith('user-1');
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
        queue: stripQueueTrackMetadata([existingQueue[0], existingQueue[2]]),
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

  describe('reorderPlayerQueue', () => {
    it('reorders a multi-item queue into a different valid order', async () => {
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

      const result = await service.reorderPlayerQueue({
        userId: 'user-1',
        reorderRequest: {
          items: [
            { queue_item_id: THIRD_QUEUE_ITEM_ID, position: 1 },
            { queue_item_id: QUEUE_ITEM_ID, position: 2 },
            { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 3 },
          ],
        },
      });

      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 99.25,
        volume: 0.45,
        queue: stripQueueTrackMetadata([existingQueue[2], existingQueue[0], existingQueue[1]]),
      });
      expect(result).toEqual({
        queue: [existingQueue[2], existingQueue[0], existingQueue[1]],
      });
    });

    it('reorders duplicate tracks correctly by queue_item_id', async () => {
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

      const result = await service.reorderPlayerQueue({
        userId: 'user-1',
        reorderRequest: {
          items: [
            { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 1 },
            { queue_item_id: THIRD_QUEUE_ITEM_ID, position: 2 },
            { queue_item_id: QUEUE_ITEM_ID, position: 3 },
          ],
        },
      });

      expect(result.queue).toEqual([existingQueue[1], existingQueue[2], existingQueue[0]]);
      expect(result.queue[0].track_id).toBe(QUEUE_TRACK_ID);
      expect(result.queue[0].queue_item_id).toBe(SECOND_QUEUE_ITEM_ID);
    });

    it('accepts uppercase UUID-shaped queue_item_id values in reorder payloads', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: UPPERCASE_QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: SECOND_QUEUE_TRACK_ID,
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

      const result = await service.reorderPlayerQueue({
        userId: 'user-1',
        reorderRequest: {
          items: [
            { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 1 },
            { queue_item_id: UPPERCASE_QUEUE_ITEM_ID, position: 2 },
          ],
        },
      });

      expect(result.queue).toEqual([existingQueue[1], existingQueue[0]]);
    });

    it('returns a validation error for invalid queue_item_id values', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [{ queue_item_id: 'not-a-uuid', position: 1 }],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'queue_item_id must be a valid UUID.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects non-object reorder payloads', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: [],
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'Request body must be an object.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects reorder payloads without items', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {},
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'items is required.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects reorder payloads whose items is not an array', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: { items: 'not-an-array' },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'items must be an array.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects reorder payloads with empty items arrays', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: { items: [] },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'items must not be empty.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects reorder payloads with non-object items', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: { items: ['bad-item'] },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'items[0] must be an object.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('rejects reorder payloads with positions below 1', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [{ queue_item_id: QUEUE_ITEM_ID, position: 0 }],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'position must be an integer greater than or equal to 1.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('returns a validation error for duplicate queue_item_id values in the request', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [
              { queue_item_id: QUEUE_ITEM_ID, position: 1 },
              { queue_item_id: QUEUE_ITEM_ID, position: 2 },
            ],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'queue_item_id values must be unique.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('returns a validation error for duplicate positions in the request', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [
              { queue_item_id: QUEUE_ITEM_ID, position: 1 },
              { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 1 },
            ],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'position values must be unique.',
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });

    it('returns a validation error when positions are not contiguous', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 18,
        volume: 0.6,
        queue: [buildQueueItem(), buildQueueItem({ queue_item_id: SECOND_QUEUE_ITEM_ID })],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [
              { queue_item_id: QUEUE_ITEM_ID, position: 1 },
              { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 3 },
            ],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'position values must form a complete contiguous set from 1 to queue length.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns a validation error when request length does not match current queue length', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 18,
        volume: 0.6,
        queue: [
          buildQueueItem(),
          buildQueueItem({ queue_item_id: SECOND_QUEUE_ITEM_ID }),
          buildQueueItem({ queue_item_id: THIRD_QUEUE_ITEM_ID }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [
              { queue_item_id: QUEUE_ITEM_ID, position: 1 },
              { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 2 },
            ],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'items must include every current queue item exactly once.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns a validation error when the request contains an unknown queue_item_id', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 12,
        volume: 0.7,
        queue: [buildQueueItem()],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [{ queue_item_id: SECOND_QUEUE_ITEM_ID, position: 1 }],
          },
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'items must include every current queue item exactly once.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns QUEUE_NOT_FOUND when no player state row exists', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue(null);

      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [{ queue_item_id: QUEUE_ITEM_ID, position: 1 }],
          },
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_NOT_FOUND',
        statusCode: 404,
        message: 'Queue not found.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns QUEUE_NOT_FOUND when the normalized queue is empty', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 0,
        volume: 1,
        queue: [],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [{ queue_item_id: QUEUE_ITEM_ID, position: 1 }],
          },
        })
      ).rejects.toMatchObject({
        code: 'QUEUE_NOT_FOUND',
        statusCode: 404,
        message: 'Queue not found.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns success without upsert when the requested order already matches the current order', async () => {
      const existingQueue = [
        buildQueueItem({
          queue_item_id: QUEUE_ITEM_ID,
          track_id: QUEUE_TRACK_ID,
        }),
        buildQueueItem({
          queue_item_id: SECOND_QUEUE_ITEM_ID,
          track_id: SECOND_QUEUE_TRACK_ID,
        }),
      ];

      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 44.5,
        volume: 0.8,
        queue: existingQueue,
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      const result = await service.reorderPlayerQueue({
        userId: 'user-1',
        reorderRequest: {
          items: [
            { queue_item_id: QUEUE_ITEM_ID, position: 1 },
            { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 2 },
          ],
        },
      });

      expect(result).toEqual({
        queue: existingQueue,
      });
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('keeps generated legacy queue_item_id values stable after reordering', async () => {
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

      const result = await service.reorderPlayerQueue({
        userId: 'user-1',
        reorderRequest: {
          items: [
            { queue_item_id: previewState.queue[1].queue_item_id, position: 1 },
            { queue_item_id: previewState.queue[0].queue_item_id, position: 2 },
          ],
        },
      });

      expect(result.queue).toHaveLength(2);
      expect(result.queue[0].queue_item_id).toBe(previewState.queue[1].queue_item_id);
      expect(result.queue[1].queue_item_id).toBe(previewState.queue[0].queue_item_id);
      expect(playerStateModel.upsert.mock.calls[0][0].queue[0].queue_item_id).toBe(
        previewState.queue[1].queue_item_id
      );
    });

    it('returns an internal error when the stored normalized queue contains duplicate queue_item_id values', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 10,
        volume: 0.7,
        queue: [
          buildQueueItem({
            queue_item_id: QUEUE_ITEM_ID,
            track_id: QUEUE_TRACK_ID,
          }),
          buildQueueItem({
            queue_item_id: QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      await expect(
        service.reorderPlayerQueue({
          userId: 'user-1',
          reorderRequest: {
            items: [
              { queue_item_id: QUEUE_ITEM_ID, position: 1 },
              { queue_item_id: SECOND_QUEUE_ITEM_ID, position: 2 },
            ],
          },
        })
      ).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        message: 'Stored queue contains duplicate queue_item_id values.',
      });

      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('rejects unauthorized reorder requests when userId is missing', async () => {
      await expect(
        service.reorderPlayerQueue({
          userId: null,
          reorderRequest: {
            items: [{ queue_item_id: QUEUE_ITEM_ID, position: 1 }],
          },
        })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(playerStateModel.findStateRowByUserId).not.toHaveBeenCalled();
    });
  });

  describe('clearPlayerQueue', () => {
    it('clears an existing queue while preserving current track_id, position_seconds, and volume', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 44.5,
        volume: 0.8,
        queue: [
          buildQueueItem({
            queue_item_id: QUEUE_ITEM_ID,
            track_id: QUEUE_TRACK_ID,
          }),
          buildQueueItem({
            queue_item_id: SECOND_QUEUE_ITEM_ID,
            track_id: SECOND_QUEUE_TRACK_ID,
          }),
        ],
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 44.5,
        volume: 0.8,
        queue: [],
        saved_at: '2026-04-19T00:00:00.000Z',
      });

      const result = await service.clearPlayerQueue({ userId: 'user-1' });

      expect(playerStateModel.findStateRowByUserId).toHaveBeenCalledWith('user-1');
      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 44.5,
        volume: 0.8,
        queue: [],
      });
      expect(result).toEqual({
        queue: [],
      });
    });

    it('returns an empty queue without creating a player_state row when none exists', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue(null);

      const result = await service.clearPlayerQueue({ userId: 'user-1' });

      expect(result).toEqual({
        queue: [],
      });
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('returns an empty queue as a true no-op when the stored queue is already empty', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 0,
        volume: 1,
        queue: [],
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      const result = await service.clearPlayerQueue({ userId: 'user-1' });

      expect(result).toEqual({
        queue: [],
      });
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('treats null stored queues as already empty and avoids unnecessary upserts', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 8,
        volume: 0.7,
        queue: null,
        saved_at: '2026-04-18T20:10:00.000Z',
      });

      const result = await service.clearPlayerQueue({ userId: 'user-1' });

      expect(result).toEqual({
        queue: [],
      });
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    });

    it('remains safe and idempotent across repeated clears', async () => {
      playerStateModel.findStateRowByUserId
        .mockResolvedValueOnce({
          track_id: TRACK_ID,
          position_seconds: 16,
          volume: 0.55,
          queue: [buildQueueItem()],
          saved_at: '2026-04-18T20:10:00.000Z',
        })
        .mockResolvedValueOnce({
          track_id: TRACK_ID,
          position_seconds: 16,
          volume: 0.55,
          queue: [],
          saved_at: '2026-04-19T00:00:00.000Z',
        });
      playerStateModel.upsert.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 16,
        volume: 0.55,
        queue: [],
        saved_at: '2026-04-19T00:00:00.000Z',
      });

      await expect(service.clearPlayerQueue({ userId: 'user-1' })).resolves.toEqual({
        queue: [],
      });
      await expect(service.clearPlayerQueue({ userId: 'user-1' })).resolves.toEqual({
        queue: [],
      });

      expect(playerStateModel.upsert).toHaveBeenCalledTimes(1);
    });

    it('clears malformed stored queue payloads by overwriting them with an empty array', async () => {
      playerStateModel.findStateRowByUserId.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 21,
        volume: 0.65,
        queue: { legacy: 'bad-payload' },
        saved_at: '2026-04-18T20:10:00.000Z',
      });
      playerStateModel.upsert.mockResolvedValue({
        track_id: TRACK_ID,
        position_seconds: 21,
        volume: 0.65,
        queue: [],
        saved_at: '2026-04-19T00:00:00.000Z',
      });

      const result = await service.clearPlayerQueue({ userId: 'user-1' });

      expect(result).toEqual({
        queue: [],
      });
      expect(playerStateModel.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 21,
        volume: 0.65,
        queue: [],
      });
    });

    it('rejects unauthorized queue clear requests when userId is missing', async () => {
      await expect(service.clearPlayerQueue({ userId: null })).rejects.toMatchObject({
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

    expect(playerStateModel.upsert.mock.calls[0][0].queue).toEqual([
      stripTrackResponseMetadata(queueItem),
    ]);
    expect(state.queue).toEqual([queueItem]);
  });

  it('accepts UUID-shaped track, queue item, and source ids without RFC bit checks', async () => {
    const queueItem = buildQueueItem({
      queue_item_id: UPPERCASE_QUEUE_ITEM_ID,
      track_id: ZERO_UUID,
      queue_bucket: 'context',
      source_type: 'playlist',
      source_id: LOWERCASE_SOURCE_ID,
      source_position: 5,
    });

    playerStateModel.findExistingTrackIds.mockResolvedValue([LOWERCASE_HEX_UUID, ZERO_UUID]);
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
      trackId: LOWERCASE_HEX_UUID,
      positionSeconds: 21.5,
      volume: 0.4,
      queue: [queueItem],
    });

    expect(playerStateModel.findExistingTrackIds).toHaveBeenCalledWith([
      LOWERCASE_HEX_UUID,
      ZERO_UUID,
    ]);
    expect(playerStateModel.upsert.mock.calls[0][0]).toMatchObject({
      trackId: LOWERCASE_HEX_UUID,
      queue: [stripTrackResponseMetadata(queueItem)],
    });
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
    const state = buildPlayerState({
      position_seconds: 121.9,
      volume: 0.4,
      queue: [],
    });

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
    const state = buildPlayerState({
      position_seconds: 50,
      volume: 0.4,
      queue: [],
    });

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
    const state = buildPlayerState({
      position_seconds: 21.5,
      volume: 0.4,
      queue: [],
    });

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

  it.each(MALFORMED_UUID_CASES)(
    'rejects %s UUID shapes when saving player state',
    async (_caseName, invalidTrackId) => {
      await expect(
        service.savePlayerState({
          userId: 'user-1',
          trackId: invalidTrackId,
          positionSeconds: 10,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'track_id must be a valid UUID.',
      });

      expect(playerStateModel.findExistingTrackIds).not.toHaveBeenCalled();
      expect(playerStateModel.upsert).not.toHaveBeenCalled();
    }
  );

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

  it('rejects non-object queue items before normalization', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: [42],
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      message: 'Each queue item must be a UUID string or object.',
    });
  });

  it('rejects non-string queue item source_type values', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: [{ track_id: QUEUE_TRACK_ID, source_type: 123 }],
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
    });
  });

  it('rejects negative queue item source_position values', async () => {
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: [{ track_id: QUEUE_TRACK_ID, source_position: -1 }],
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      message: 'queue item source_position must be an integer greater than or equal to 0.',
    });
  });

  it('accepts aliased and free-form queue source ids where supported', async () => {
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
      queue: [
        {
          track_id: QUEUE_TRACK_ID,
          source_type: 'system_mix',
          source_id: 'daily:for-you',
        },
      ],
    });

    expect(state.queue[0]).toMatchObject({
      source_type: 'mix',
      source_id: 'daily:for-you',
    });
  });

  it('treats blank queue item source_type as null and regenerates invalid added_at values', async () => {
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
      queue: [
        {
          track_id: QUEUE_TRACK_ID,
          source_type: '',
          added_at: 'not-a-real-date',
        },
      ],
    });

    expect(state.queue[0].source_type).toBeNull();
    expect(state.queue[0].added_at).not.toBe('not-a-real-date');
    expect(new Date(state.queue[0].added_at).toISOString()).toBe(state.queue[0].added_at);
  });
});
