const service = require('../../src/services/playback.service');
const model = require('../../src/models/player-state.model');

jest.mock('../../src/models/player-state.model');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const QUEUE_TRACK_ID = '22222222-2222-4222-8222-222222222222';

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

  it('saves player state successfully', async () => {
    const state = {
      track_id: 'track-1',
      position_seconds: 21.5,
      volume: 0.4,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    model.trackExists.mockResolvedValue(true);
    model.upsert.mockResolvedValue(state);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 21.5,
        volume: 0.4,
        queue: [QUEUE_TRACK_ID],
      })
    ).resolves.toEqual(state);

    expect(model.upsert).toHaveBeenCalledWith({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 21.5,
      volume: 0.4,
      queue: [QUEUE_TRACK_ID],
    });
  });

  it('defaults optional fields when saving player state', async () => {
    model.trackExists.mockResolvedValue(true);
    model.upsert.mockResolvedValue({ track_id: 'track-1' });

    await service.savePlayerState({
      userId: 'user-1',
      trackId: TRACK_ID,
      positionSeconds: 8,
    });

    expect(model.upsert).toHaveBeenCalledWith({
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
    model.trackExists.mockResolvedValue(true);
    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: undefined,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
  });

  it('rejects invalid volume outside the allowed range', async () => {
    model.trackExists.mockResolvedValue(true);
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

    expect(model.trackExists).not.toHaveBeenCalled();
    expect(model.upsert).not.toHaveBeenCalled();
  });

  it('returns TRACK_NOT_FOUND when the provided track does not exist', async () => {
    model.trackExists.mockResolvedValue(false);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
      })
    ).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND', statusCode: 404 });

    expect(model.upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed queue item UUIDs', async () => {
    model.trackExists.mockResolvedValue(true);

    await expect(
      service.savePlayerState({
        userId: 'user-1',
        trackId: TRACK_ID,
        positionSeconds: 10,
        queue: ['bad-queue-id'],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });

    expect(model.upsert).not.toHaveBeenCalled();
  });
});
