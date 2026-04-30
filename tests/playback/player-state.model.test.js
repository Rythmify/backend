const model = require('../../src/models/player-state.model');
const db = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('player-state.model', () => {
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

  it('trackExists returns true when the track exists and false otherwise', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await expect(model.trackExists('track-1')).resolves.toBe(true);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM tracks'), ['track-1']);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.trackExists('missing-track')).resolves.toBe(false);
  });

  it('findExistingTrackIds returns the matching track ids from a batch lookup', async () => {
    const trackIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];

    db.query.mockResolvedValueOnce({
      rows: [{ id: trackIds[0] }],
    });

    await expect(model.findExistingTrackIds(trackIds)).resolves.toEqual([trackIds[0]]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ANY'), [trackIds]);
  });

  it('findExistingTrackIds returns an empty array without querying when no track ids are provided', async () => {
    await expect(model.findExistingTrackIds([])).resolves.toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns the first saved player state row', async () => {
    const row = {
      track_id: 'track-1',
      position_seconds: 14.2,
      volume: 0.9,
      queue: [queueItem],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findByUserId('user-1')).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM player_state'), ['user-1']);
  });

  it('returns queue-only player state rows even when track_id is null', async () => {
    const row = {
      track_id: null,
      position_seconds: 0,
      volume: 1,
      queue: [queueItem],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findByUserId('user-1')).resolves.toEqual(row);
  });

  it('returns null when no player state row exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.findByUserId('user-1')).resolves.toBeNull();
  });

  it('returns the full stored player state row even when track_id is null', async () => {
    const row = {
      track_id: null,
      position_seconds: 0,
      volume: 1,
      queue: [queueItem],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findStateRowByUserId('user-1')).resolves.toEqual(row);
    expect(db.query.mock.calls[0][0]).toContain('FROM player_state');
    expect(db.query.mock.calls[0][0]).not.toContain('track_id IS NOT NULL');
    expect(db.query.mock.calls[0][1]).toEqual(['user-1']);
  });

  it('upsert inserts or updates player state and returns the saved row', async () => {
    const row = {
      track_id: 'track-1',
      position_seconds: 19.5,
      volume: 0.7,
      queue: [queueItem],
      saved_at: '2026-04-05T00:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.upsert({
        userId: 'user-1',
        trackId: 'track-1',
        positionSeconds: 19.5,
        volume: 0.7,
        queue: [queueItem],
      })
    ).resolves.toEqual(row);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (user_id)'), [
      'user-1',
      'track-1',
      19.5,
      0.7,
      JSON.stringify([queueItem]),
    ]);
  });

  it('upsertIfNewer saves synced state only when the incoming timestamp is newer', async () => {
    const row = {
      track_id: 'track-1',
      position_seconds: 44.5,
      volume: 0.6,
      queue: [],
      saved_at: '2026-04-06T12:05:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.upsertIfNewer({
        userId: 'user-1',
        trackId: 'track-1',
        positionSeconds: 44.5,
        volume: 0.6,
        queue: [],
        updatedAt: '2026-04-06T12:05:00.000Z',
      })
    ).resolves.toEqual(row);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE player_state.updated_at <= EXCLUDED.updated_at'),
      ['user-1', 'track-1', 44.5, 0.6, JSON.stringify([]), '2026-04-06T12:05:00.000Z']
    );
  });

  it('upsertIfNewer returns null when a newer state is already stored', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.upsertIfNewer({
        userId: 'user-1',
        trackId: 'track-1',
        positionSeconds: 44.5,
        volume: 0.6,
        queue: [],
        updatedAt: '2026-04-06T12:05:00.000Z',
      })
    ).resolves.toBeNull();
  });
});
