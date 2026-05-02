const controller = require('../../../src/controllers/playback.controller');
const playbackService = require('../../../src/services/playback.service');
const api = require('../../../src/utils/api-response');

jest.mock('../../../src/services/playback.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

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

beforeEach(() => jest.clearAllMocks());

describe('playback.controller', () => {
  it('forwards play params and returns the resolved play payload', async () => {
    const req = {
      params: { track_id: '11111111-1111-4111-8111-111111111111' },
      query: { secret_token: 'secret-123' },
      user: { sub: 'user-1' },
    };
    const res = mkRes();
    const playResult = {
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'playable',
      stream_url: 'stream-url',
      preview_url: null,
      reason: null,
    };

    playbackService.playTrack.mockResolvedValue(playResult);

    await controller.playTrack(req, res);

    expect(playbackService.playTrack).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: 'user-1',
      secretToken: 'secret-123',
    });
    expect(api.success).toHaveBeenCalledWith(res, playResult, 'Track play resolved successfully.');
  });

  it('forwards playback-state params and returns the resolved state', async () => {
    const req = {
      params: { track_id: '11111111-1111-4111-8111-111111111111' },
      query: { secret_token: 'secret-123' },
      user: { sub: 'user-1' },
    };
    const res = mkRes();
    const playbackState = {
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'playable',
      stream_url: 'stream-url',
      preview_url: null,
      reason: null,
    };

    playbackService.getPlaybackState.mockResolvedValue(playbackState);

    await controller.getPlaybackState(req, res);

    expect(playbackService.getPlaybackState).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: 'user-1',
      secretToken: 'secret-123',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      playbackState,
      'Playback state fetched successfully.'
    );
  });

  it('allows anonymous playback-state requests', async () => {
    const req = {
      params: { track_id: '11111111-1111-4111-8111-111111111111' },
      query: {},
      user: null,
    };
    const res = mkRes();

    playbackService.getPlaybackState.mockResolvedValue({
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'processing',
      stream_url: null,
      preview_url: null,
      reason: 'track_processing',
    });

    await controller.getPlaybackState(req, res);

    expect(playbackService.getPlaybackState).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: null,
      secretToken: null,
    });
  });

  it('allows anonymous play requests', async () => {
    const req = {
      params: { track_id: '11111111-1111-4111-8111-111111111111' },
      query: {},
      user: null,
    };
    const res = mkRes();

    playbackService.playTrack.mockResolvedValue({
      track_id: '11111111-1111-4111-8111-111111111111',
      state: 'preview',
      stream_url: null,
      preview_url: 'preview-url',
      reason: 'preview_only',
    });

    await controller.playTrack(req, res);

    expect(playbackService.playTrack).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: null,
      secretToken: null,
    });
  });

  it('returns unauthorized when req.user is missing', async () => {
    const req = {};
    const res = mkRes();

    await controller.getPlayerState(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.getPlayerState).not.toHaveBeenCalled();
  });

  it('calls service and returns saved player state', async () => {
    const req = { user: { sub: 'user-1' } };
    const res = mkRes();
    const state = {
      track_id: 'track-1',
      position_seconds: 12.5,
      volume: 0.8,
      queue: [queueItem],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playbackService.getPlayerState.mockResolvedValue(state);

    await controller.getPlayerState(req, res);

    expect(playbackService.getPlayerState).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(api.success).toHaveBeenCalledWith(res, state, 'Player state fetched successfully.');
  });

  it('returns data null when no saved state exists', async () => {
    const req = { user: { sub: 'user-1' } };
    const res = mkRes();

    playbackService.getPlayerState.mockResolvedValue(null);

    await controller.getPlayerState(req, res);

    expect(api.success).toHaveBeenCalledWith(res, null, 'Player state fetched successfully.');
  });

  it('calls service and returns paginated recently played entries', async () => {
    const req = { user: { sub: 'user-1' }, query: { limit: '10', offset: '20' } };
    const res = mkRes();
    const history = {
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
          },
          last_played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
      pagination: {
        limit: 10,
        offset: 20,
        total: 57,
      },
    };

    playbackService.getRecentlyPlayed.mockResolvedValue(history);

    await controller.getRecentlyPlayed(req, res);

    expect(playbackService.getRecentlyPlayed).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: '10',
      offset: '20',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      history.data,
      'Recently played fetched successfully.',
      200,
      history.pagination
    );
  });

  it('returns unauthorized for recently played when req.user is missing', async () => {
    const req = {};
    const res = mkRes();

    await controller.getRecentlyPlayed(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.getRecentlyPlayed).not.toHaveBeenCalled();
  });

  it('calls service and returns 204 with no body for cleared listening history', async () => {
    const req = { user: { sub: 'user-1' } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    playbackService.clearListeningHistory.mockResolvedValue(3);

    await controller.clearListeningHistory(req, res);

    expect(playbackService.clearListeningHistory).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });

  it('returns unauthorized for clear history when req.user is missing', async () => {
    const req = {};
    const res = mkRes();

    await controller.clearListeningHistory(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.clearListeningHistory).not.toHaveBeenCalled();
  });

  it('calls service and returns paginated listening history', async () => {
    const req = {
      user: { sub: 'user-1' },
      query: { limit: '5', offset: '10' },
    };
    const res = mkRes();
    const history = {
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
    };

    playbackService.getListeningHistory.mockResolvedValue(history);

    await controller.getListeningHistory(req, res);

    expect(playbackService.getListeningHistory).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: '5',
      offset: '10',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      history.data,
      'Listening history fetched successfully.',
      200,
      history.pagination
    );
    expect(api.success.mock.calls[0][1].items).toBeUndefined();
  });

  it('returns unauthorized for listening history when req.user is missing', async () => {
    const req = { query: {} };
    const res = mkRes();

    await controller.getListeningHistory(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.getListeningHistory).not.toHaveBeenCalled();
  });

  it('calls service and returns playback sync results', async () => {
    const req = {
      user: { sub: 'user-1' },
      body: {
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
      },
    };
    const res = mkRes();
    const syncResult = {
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
    };

    playbackService.syncPlayback.mockResolvedValue(syncResult);

    await controller.syncPlayback(req, res);

    expect(playbackService.syncPlayback).toHaveBeenCalledWith({
      userId: 'user-1',
      historyEvents: req.body.history_events,
      currentState: req.body.current_state,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      syncResult,
      'Playback sync completed successfully.'
    );
  });

  it('returns unauthorized for playback sync when req.user is missing', async () => {
    const req = { body: {} };
    const res = mkRes();

    await controller.syncPlayback(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.syncPlayback).not.toHaveBeenCalled();
  });

  it('forwards player state payload to the service and returns the saved state', async () => {
    const req = {
      user: { sub: 'user-1' },
      body: {
        track_id: 'track-1',
        position_seconds: 33.25,
        volume: 0.5,
        queue: ['track-2'],
      },
    };
    const res = mkRes();
    const state = {
      track_id: 'track-1',
      position_seconds: 33.25,
      volume: 0.5,
      queue: [queueItem],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    playbackService.savePlayerState.mockResolvedValue(state);

    await controller.savePlayerState(req, res);

    expect(playbackService.savePlayerState).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: 'track-1',
      positionSeconds: 33.25,
      volume: 0.5,
      queue: ['track-2'],
    });
    expect(api.success).toHaveBeenCalledWith(res, state, 'Player state saved successfully.');
  });

  it('returns unauthorized for save when req.user is missing', async () => {
    const req = { body: { track_id: 'track-1', position_seconds: 10 } };
    const res = mkRes();

    await controller.savePlayerState(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.savePlayerState).not.toHaveBeenCalled();
  });

  it('forwards queue-context payload to the service and returns the saved player state', async () => {
    const req = {
      user: { sub: '15151515-1515-4515-8515-151515151515' },
      body: {
        interaction_type: 'play',
        source_type: 'playlist',
        source_id: '44444444-4444-4444-8444-444444444444',
        target_user_id: null,
      },
    };
    const res = mkRes();
    const playerStateResult = {
      track_id: '22222222-2222-4222-8222-222222222222',
      position_seconds: 0,
      volume: 0.7,
      queue: [queueItem],
      saved_at: '2026-04-19T00:00:00.000Z',
    };

    playbackService.addQueueContext.mockResolvedValue(playerStateResult);

    await controller.addQueueContext(req, res);

    expect(playbackService.addQueueContext).toHaveBeenCalledWith({
      userId: '15151515-1515-4515-8515-151515151515',
      interactionType: 'play',
      sourceType: 'playlist',
      sourceId: '44444444-4444-4444-8444-444444444444',
      targetUserId: null,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      playerStateResult,
      'Player state updated successfully.'
    );
  });

  it('forwards single-track next_up queue-context payloads to the service', async () => {
    const req = {
      user: { sub: '15151515-1515-4515-8515-151515151515' },
      body: {
        interaction_type: 'next_up',
        source_type: 'track',
        source_id: '22222222-2222-4222-8222-222222222222',
      },
    };
    const res = mkRes();
    const playerStateResult = {
      track_id: '11111111-1111-4111-8111-111111111111',
      position_seconds: 12.5,
      volume: 0.7,
      queue: [queueItem],
      saved_at: '2026-04-19T00:00:00.000Z',
    };

    playbackService.addQueueContext.mockResolvedValue(playerStateResult);

    await controller.addQueueContext(req, res);

    expect(playbackService.addQueueContext).toHaveBeenCalledWith({
      userId: '15151515-1515-4515-8515-151515151515',
      interactionType: 'next_up',
      sourceType: 'track',
      sourceId: '22222222-2222-4222-8222-222222222222',
      targetUserId: undefined,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      playerStateResult,
      'Player state updated successfully.'
    );
  });

  it('returns unauthorized for queue-context updates when req.user is missing', async () => {
    const req = {
      body: {
        interaction_type: 'next_up',
        source_type: 'mix',
        source_id: 'mix_genre_16161616-1616-4616-8616-161616161616',
      },
    };
    const res = mkRes();

    await controller.addQueueContext(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.addQueueContext).not.toHaveBeenCalled();
  });

  it('forwards queue reorder requests to the service and returns the updated queue', async () => {
    const req = {
      user: { sub: 'user-1' },
      body: {
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
    };
    const res = mkRes();
    const queueResult = {
      queue: [queueItem],
    };

    playbackService.reorderPlayerQueue.mockResolvedValue(queueResult);

    await controller.reorderPlayerQueue(req, res);

    expect(playbackService.reorderPlayerQueue).toHaveBeenCalledWith({
      userId: 'user-1',
      reorderRequest: req.body,
    });
    expect(api.success).toHaveBeenCalledWith(res, queueResult, 'Queue updated successfully.');
  });

  it('returns unauthorized for queue reorder when req.user is missing', async () => {
    const req = {
      body: {
        items: [
          {
            queue_item_id: '55555555-5555-4555-8555-555555555555',
            position: 1,
          },
        ],
      },
    };
    const res = mkRes();

    await controller.reorderPlayerQueue(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.reorderPlayerQueue).not.toHaveBeenCalled();
  });

  it('forwards queue clear requests to the service and returns the empty queue payload', async () => {
    const req = {
      user: { sub: 'user-1' },
    };
    const res = mkRes();
    const queueResult = {
      queue: [],
    };

    playbackService.clearPlayerQueue.mockResolvedValue(queueResult);

    await controller.clearPlayerQueue(req, res);

    expect(playbackService.clearPlayerQueue).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(api.success).toHaveBeenCalledWith(res, queueResult, 'Queue cleared successfully.');
  });

  it('returns unauthorized for queue clear when req.user is missing', async () => {
    const req = {};
    const res = mkRes();

    await controller.clearPlayerQueue(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.clearPlayerQueue).not.toHaveBeenCalled();
  });

  it('forwards queue item removal params to the service and returns the updated queue', async () => {
    const req = {
      user: { sub: 'user-1' },
      params: {
        queue_item_id: '55555555-5555-4555-8555-555555555555',
      },
    };
    const res = mkRes();
    const queueResult = {
      queue: [queueItem],
    };

    playbackService.removeQueueItem.mockResolvedValue(queueResult);

    await controller.removeQueueItem(req, res);

    expect(playbackService.removeQueueItem).toHaveBeenCalledWith({
      userId: 'user-1',
      queueItemId: '55555555-5555-4555-8555-555555555555',
    });
    expect(api.success).toHaveBeenCalledWith(res, queueResult, 'Queue updated successfully.');
  });

  it('returns unauthorized for queue item removal when req.user is missing', async () => {
    const req = {
      params: {
        queue_item_id: '55555555-5555-4555-8555-555555555555',
      },
    };
    const res = mkRes();

    await controller.removeQueueItem(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    expect(playbackService.removeQueueItem).not.toHaveBeenCalled();
  });

  it.each([
    [
      'getPlaybackState',
      'getPlaybackState',
      {
        params: { track_id: '11111111-1111-4111-8111-111111111111' },
        query: { secret_token: 'secret-123' },
        user: { sub: 'user-1' },
        headers: { 'x-country-code': 'eg' },
      },
      {
        trackId: '11111111-1111-4111-8111-111111111111',
        requesterUserId: 'user-1',
        secretToken: 'secret-123',
        countryCode: 'EG',
      },
      { state: 'playable' },
    ],
    [
      'playTrack',
      'playTrack',
      {
        params: { track_id: '11111111-1111-4111-8111-111111111111' },
        query: {},
        user: { id: 'user-1' },
        headers: { 'X-Country-Code': 'us' },
      },
      {
        trackId: '11111111-1111-4111-8111-111111111111',
        requesterUserId: 'user-1',
        secretToken: null,
        countryCode: 'US',
      },
      { state: 'preview' },
    ],
    [
      'getPlayerState',
      'getPlayerState',
      {
        user: { user_id: 'user-1' },
        headers: { 'X-Country-Code': 'fr' },
      },
      {
        userId: 'user-1',
        countryCode: 'FR',
      },
      { queue: [] },
    ],
    [
      'getRecentlyPlayed',
      'getRecentlyPlayed',
      {
        user: { sub: 'user-1' },
        query: { limit: '2', offset: '4' },
        headers: { 'X-Country-Code': 'de' },
      },
      {
        userId: 'user-1',
        limit: '2',
        offset: '4',
        countryCode: 'DE',
      },
      { data: [], pagination: { limit: 2, offset: 4, total: 0 } },
    ],
    [
      'getListeningHistory',
      'getListeningHistory',
      {
        user: { sub: 'user-1' },
        query: { limit: '3', offset: '6' },
        headers: { 'X-Country-Code': 'it' },
      },
      {
        userId: 'user-1',
        limit: '3',
        offset: '6',
        countryCode: 'IT',
      },
      { data: [], pagination: { limit: 3, offset: 6, total: 0 } },
    ],
    [
      'syncPlayback',
      'syncPlayback',
      {
        user: { sub: 'user-1' },
        body: { history_events: [], current_state: null },
        headers: { 'X-Country-Code': 'es' },
      },
      {
        userId: 'user-1',
        historyEvents: [],
        currentState: null,
        countryCode: 'ES',
      },
      { history_events_received: 0 },
    ],
    [
      'savePlayerState',
      'savePlayerState',
      {
        user: { sub: 'user-1' },
        body: { track_id: 'track-1', position_seconds: 9, volume: 0.4, queue: [] },
        headers: { 'X-Country-Code': 'ca' },
      },
      {
        userId: 'user-1',
        trackId: 'track-1',
        positionSeconds: 9,
        volume: 0.4,
        queue: [],
        countryCode: 'CA',
      },
      { track_id: 'track-1' },
    ],
    [
      'addQueueContext',
      'addQueueContext',
      {
        user: { sub: 'user-1' },
        body: {
          interaction_type: 'play',
          source_type: 'track',
          source_id: 'track-1',
          target_user_id: 'artist-1',
        },
        headers: { 'X-Country-Code': 'br' },
      },
      {
        userId: 'user-1',
        interactionType: 'play',
        sourceType: 'track',
        sourceId: 'track-1',
        targetUserId: 'artist-1',
        countryCode: 'BR',
      },
      { queue: [] },
    ],
    [
      'reorderPlayerQueue',
      'reorderPlayerQueue',
      {
        user: { sub: 'user-1' },
        body: { items: [{ queue_item_id: 'queue-1', position: 1 }] },
        headers: { 'X-Country-Code': 'jp' },
      },
      {
        userId: 'user-1',
        reorderRequest: { items: [{ queue_item_id: 'queue-1', position: 1 }] },
        countryCode: 'JP',
      },
      { queue: [] },
    ],
    [
      'removeQueueItem',
      'removeQueueItem',
      {
        user: { sub: 'user-1' },
        params: { queue_item_id: 'queue-1' },
        headers: { 'X-Country-Code': 'mx' },
      },
      {
        userId: 'user-1',
        queueItemId: 'queue-1',
        countryCode: 'MX',
      },
      { queue: [] },
    ],
  ])('%s includes normalized countryCode when X-Country-Code is valid', async (
    controllerMethod,
    serviceMethod,
    req,
    expectedPayload,
    serviceResult
  ) => {
    const res = mkRes();
    playbackService[serviceMethod].mockResolvedValue(serviceResult);

    await controller[controllerMethod](req, res);

    expect(playbackService[serviceMethod]).toHaveBeenCalledWith(expectedPayload);
  });

  it('omits countryCode when X-Country-Code is invalid', async () => {
    const req = {
      params: { track_id: '11111111-1111-4111-8111-111111111111' },
      query: {},
      user: null,
      headers: { 'X-Country-Code': 'EGY' },
    };
    const res = mkRes();

    playbackService.playTrack.mockResolvedValue({ state: 'preview' });

    await controller.playTrack(req, res);

    expect(playbackService.playTrack).toHaveBeenCalledWith({
      trackId: '11111111-1111-4111-8111-111111111111',
      requesterUserId: null,
      secretToken: null,
    });
  });
});
