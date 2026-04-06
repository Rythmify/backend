const model = require('../../src/models/playback.model');
const db = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('playback.model', () => {
  it('returns the playback-state track row when found', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'ready',
      is_public: true,
      is_hidden: false,
      secret_token: null,
      user_id: 'user-1',
      stream_url: 'stream-url',
      preview_url: 'preview-url',
      audio_url: 'audio-url',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
      enable_app_playback: true,
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.findTrackByIdForPlaybackState('11111111-1111-4111-8111-111111111111')
    ).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM tracks t'),
      ['11111111-1111-4111-8111-111111111111']
    );
  });

  it('returns null when no playback-state track row exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.findTrackByIdForPlaybackState('11111111-1111-4111-8111-111111111111')
    ).resolves.toBeNull();
  });

  it('inserts a listening history row for a successful authenticated play', async () => {
    const row = {
      id: 'history-1',
      user_id: 'user-1',
      track_id: '11111111-1111-4111-8111-111111111111',
      duration_played: 0,
      played_at: '2026-04-06T10:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.insertListeningHistory({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
      })
    ).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO listening_history'),
      ['user-1', '11111111-1111-4111-8111-111111111111', 0, null]
    );
  });

  it('returns recently played entries with the expected nested track summary shape', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Latest Track',
      genre: 'Pop',
      duration: 180,
      cover_image: 'cover-1.jpg',
      user_id: 'artist-1',
      play_count: 12,
      like_count: 4,
      stream_url: 'stream-1',
      last_played_at: '2026-04-06T12:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findRecentlyPlayedByUserId('user-1')).resolves.toEqual([
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
    ]);
  });

  it('queries deduplicated recently played tracks newest first with conservative visibility filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.findRecentlyPlayedByUserId('user-1');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT ON (lh.track_id)'),
      ['user-1', 20]
    );

    const recentHistoryQuery = db.query.mock.calls[0][0];

    expect(recentHistoryQuery).toContain('FROM listening_history lh');
    expect(recentHistoryQuery).toContain('AND t.deleted_at IS NULL');
    expect(recentHistoryQuery).toContain("AND t.status = 'ready'");
    expect(recentHistoryQuery).toContain('t.user_id = $1');
    expect(recentHistoryQuery).toContain('(t.is_public = true AND t.is_hidden = false)');
    expect(recentHistoryQuery).toContain('ORDER BY lh.track_id, lh.played_at DESC');
    expect(recentHistoryQuery).toContain(
      'ORDER BY deduplicated_history.last_played_at DESC, t.id ASC'
    );
    expect(recentHistoryQuery).toContain('LIMIT $2');
  });

  it('passes through a custom limit for recently played queries', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.findRecentlyPlayedByUserId('user-1', 5);

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['user-1', 5]);
  });
});
