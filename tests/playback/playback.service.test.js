const service = require('../../src/services/playback.service');
const model = require('../../src/models/player-state.model');

jest.mock('../../src/models/player-state.model');

beforeEach(() => jest.clearAllMocks());

describe('playback.service', () => {
  it('returns the saved player state for the authenticated user', async () => {
    const state = {
      track_id: 'track-1',
      position_seconds: 42.75,
      volume: 0.6,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    model.findByUserId.mockResolvedValue(state);

    await expect(service.getPlayerState({ userId: 'user-1' })).resolves.toEqual(state);
    expect(model.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('returns null when the user has no saved state', async () => {
    model.findByUserId.mockResolvedValue(null);

    await expect(service.getPlayerState({ userId: 'user-1' })).resolves.toBeNull();
  });

  it('throws unauthorized when userId is missing', async () => {
    await expect(service.getPlayerState({ userId: null })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });
});
