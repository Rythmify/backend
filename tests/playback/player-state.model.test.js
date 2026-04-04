const model = require('../../src/models/player-state.model');
const db = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('player-state.model', () => {
  it('trackExists returns true when the track exists and false otherwise', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await expect(model.trackExists('track-1')).resolves.toBe(true);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM tracks'), ['track-1']);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.trackExists('missing-track')).resolves.toBe(false);
  });

  it('returns the first saved player state row', async () => {
    const row = {
      track_id: 'track-1',
      position_seconds: 14.2,
      volume: 0.9,
      queue: ['track-2', 'track-3'],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findByUserId('user-1')).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM player_state'),
      ['user-1']
    );
  });

  it('returns null when no playable player state exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.findByUserId('user-1')).resolves.toBeNull();
  });

  it('upsert inserts or updates player state and returns the saved row', async () => {
    const row = {
      track_id: 'track-1',
      position_seconds: 19.5,
      volume: 0.7,
      queue: ['track-2'],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.upsert({
        userId: 'user-1',
        trackId: 'track-1',
        positionSeconds: 19.5,
        volume: 0.7,
        queue: ['track-2'],
      })
    ).resolves.toEqual(row);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id)'),
      ['user-1', 'track-1', 19.5, 0.7, JSON.stringify(['track-2'])]
    );
  });
});
