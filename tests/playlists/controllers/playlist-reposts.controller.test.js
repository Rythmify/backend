// ============================================================
// tests/playlists/controllers/playlist-reposts.controller.test.js
// ============================================================
const controller = require('../../../src/controllers/playlist-reposts.controller');
const service = require('../../../src/services/playlist-reposts.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/playlist-reposts.service');

describe('Playlist Reposts Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { playlist_id: 'pl-1' },
      query: {},
      user: { id: 'user-1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getPlaylistReposters', () => {
    it('returns reposters successfully', async () => {
      service.getPlaylistReposters.mockResolvedValue([]);
      await controller.getPlaylistReposters(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws 400 if limit NaN', async () => {
      req.query.limit = 'abc';
      await expect(controller.getPlaylistReposters(req, res)).rejects.toThrow('Limit and offset must be numbers');
    });
  });

  describe('repostPlaylist', () => {
    it('returns 201 if isNew', async () => {
      service.repostPlaylist.mockResolvedValue({ isNew: true, repostId: 'r1' });
      await controller.repostPlaylist(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 200 if already reposted', async () => {
      service.repostPlaylist.mockResolvedValue({ isNew: false, repostId: 'r1' });
      await controller.repostPlaylist(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws 401 if no user', async () => {
      req.user = null;
      await expect(controller.repostPlaylist(req, res)).rejects.toThrow('User not authenticated');
    });
  });

  describe('removeRepost', () => {
    it('returns 204 on success', async () => {
      service.removeRepost.mockResolvedValue(true);
      await controller.removeRepost(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('throws 401 if no user', async () => {
      req.user = null;
      await expect(controller.removeRepost(req, res)).rejects.toThrow('User not authenticated');
    });
  });

  describe('getMyRepostedPlaylists', () => {
    it('returns reposted playlists', async () => {
      service.getUserRepostedPlaylists.mockResolvedValue([]);
      await controller.getMyRepostedPlaylists(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws 401 if no user', async () => {
      req.user = null;
      await expect(controller.getMyRepostedPlaylists(req, res)).rejects.toThrow('User not authenticated');
    });

    it('throws 400 if offset NaN', async () => {
      req.query.offset = 'abc';
      await expect(controller.getMyRepostedPlaylists(req, res)).rejects.toThrow('Limit and offset must be numbers');
    });
  });
});
