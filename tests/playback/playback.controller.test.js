const controller = require('../../src/controllers/playback.controller');
const playbackService = require('../../src/services/playback.service');
const api = require('../../src/utils/api-response');

jest.mock('../../src/services/playback.service');
jest.mock('../../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('playback.controller', () => {
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
      queue: ['track-2'],
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
      queue: ['track-2'],
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
});
