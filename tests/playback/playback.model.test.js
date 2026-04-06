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
});
