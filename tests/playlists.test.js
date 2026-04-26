// ============================================================
// tests/playlists.test.js — Unit & integration tests
// Mirrors: src/routes/playlists.routes.js + src/services/playlists.service.js
// ============================================================
const request = require('supertest');
const app = require('../app');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const LIMIT_ERROR = {
  statusCode: 403,
  code: 'SUBSCRIPTION_PLAYLIST_LIMIT_REACHED',
  message: 'Free plan allows up to 2 playlists. Upgrade to premium to create more.',
};

const loadPlaylistServiceWithMocks = ({ plan = { playlist_limit: 2 }, playlistCount = 0 } = {}) => {
  jest.resetModules();

  const createdPlaylist = {
    id: '22222222-2222-2222-2222-222222222222',
    user_id: USER_ID,
    name: 'New Playlist',
    is_public: true,
    secret_token: 'secret-token',
    type: 'regular',
    subtype: 'playlist',
  };
  const playlistModel = {
    countUserRegularPlaylists: jest.fn().mockResolvedValue(playlistCount),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(createdPlaylist),
  };
  const subscriptionsService = {
    getEffectiveActivePlanForUser: jest.fn().mockResolvedValue(plan),
  };

  jest.doMock('../src/models/playlist.model', () => playlistModel);
  jest.doMock('../src/services/subscriptions.service', () => subscriptionsService);
  jest.doMock('../src/services/storage.service', () => ({
    uploadImage: jest.fn(),
    deleteAllVersionsByUrl: jest.fn(),
  }));
  jest.doMock('../src/models/user.model', () => ({}));
  jest.doMock('../src/models/follow.model', () => ({}));
  jest.doMock('../src/models/playlist-like.model', () => ({
    isPlaylistLikedByUser: jest.fn(),
  }));
  jest.doMock('../src/config/db', () => ({
    query: jest.fn(),
    connect: jest.fn(),
  }));
  jest.doMock('../src/models/feed.model', () => ({
    findTracksByGenreId: jest.fn(),
    getDailyTracks: jest.fn(),
    getWeeklyTracks: jest.fn(),
  }));
  jest.doMock('../src/models/track.model', () => ({
    findRelatedTracks: jest.fn(),
  }));

  return {
    service: require('../src/services/playlists.service'),
    playlistModel,
    subscriptionsService,
  };
};

const loadPlaylistModelWithDbMock = () => {
  jest.resetModules();

  const db = {
    query: jest.fn().mockResolvedValue({ rows: [{ total: 2 }] }),
  };
  jest.doMock('../src/config/db', () => db);

  return {
    model: require('../src/models/playlist.model'),
    db,
  };
};

describe('playlists module', () => {
  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('countUserRegularPlaylists counts all active regular containers regardless of subtype', async () => {
    const { model, db } = loadPlaylistModelWithDbMock();

    await expect(model.countUserRegularPlaylists(USER_ID)).resolves.toBe(2);

    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('FROM playlists');
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain("type = 'regular'");
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).not.toContain('subtype');
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [USER_ID]);
  });

  it('rejects free playlist creation when existing regular containers include a converted album', async () => {
    const { service, playlistModel } = loadPlaylistServiceWithMocks({
      plan: { playlist_limit: 2 },
      playlistCount: 2,
    });

    await expect(
      service.createPlaylist({
        userId: USER_ID,
        name: 'Another Playlist',
        isPublic: true,
      })
    ).rejects.toMatchObject(LIMIT_ERROR);

    expect(playlistModel.countUserRegularPlaylists).toHaveBeenCalledWith(USER_ID);
    expect(playlistModel.create).not.toHaveBeenCalled();
  });

  it('still rejects free playlist creation after subtype conversion keeps the user at the limit', async () => {
    const { service, playlistModel } = loadPlaylistServiceWithMocks({
      plan: { playlist_limit: 2 },
      playlistCount: 2,
    });

    await expect(
      service.createPlaylist({
        userId: USER_ID,
        name: 'Post Conversion Playlist',
        isPublic: false,
      })
    ).rejects.toMatchObject(LIMIT_ERROR);

    expect(playlistModel.countUserRegularPlaylists).toHaveBeenCalledWith(USER_ID);
    expect(playlistModel.create).not.toHaveBeenCalled();
  });

  it('allows premium users with unlimited playlist_limit to create playlists', async () => {
    const { service, playlistModel } = loadPlaylistServiceWithMocks({
      plan: { playlist_limit: null },
      playlistCount: 99,
    });

    await expect(
      service.createPlaylist({
        userId: USER_ID,
        name: 'Premium Playlist',
        isPublic: true,
      })
    ).resolves.toMatchObject({
      playlist: {
        playlist_id: '22222222-2222-2222-2222-222222222222',
        subtype: 'playlist',
        type: 'regular',
      },
    });

    expect(playlistModel.countUserRegularPlaylists).not.toHaveBeenCalled();
    expect(playlistModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        name: 'Premium Playlist',
        subtype: 'playlist',
      })
    );
  });
});
