// ============================================================
// tests/playlists/controllers/playlist-likes.controller.test.js
// ============================================================
const controller = require('../../../src/controllers/playlist-likes.controller');
const service = require('../../../src/services/playlist-likes.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/playlist-likes.service');

describe('Playlist Likes Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { playlist_id: 'pl-123' },
      query: {},
      user: { id: 'user-456' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getPlaylistLikers', () => {
    it('returns likers successfully', async () => {
      service.getPlaylistLikers.mockResolvedValue({ items: [], total: 0 });
      await controller.getPlaylistLikers(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws 400 if limit is NaN', async () => {
      req.query.limit = 'abc';
      await expect(controller.getPlaylistLikers(req, res)).rejects.toThrow('Limit and offset must be numbers');
    });
  });

  describe('likePlaylist', () => {
    it('returns 201 if isNew', async () => {
      service.likePlaylist.mockResolvedValue({ isNew: true, likeId: 'l1' });
      await controller.likePlaylist(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 200 if already liked', async () => {
      service.likePlaylist.mockResolvedValue({ isNew: false, likeId: 'l1' });
      await controller.likePlaylist(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws 401 if not authenticated', async () => {
      req.user = null;
      await expect(controller.likePlaylist(req, res)).rejects.toThrow('User not authenticated');
    });
  });

  describe('unlikePlaylist', () => {
    it('returns 204 on success', async () => {
      service.unlikePlaylist.mockResolvedValue(true);
      await controller.unlikePlaylist(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('throws 401 if not authenticated', async () => {
      req.user = null;
      await expect(controller.unlikePlaylist(req, res)).rejects.toThrow('User not authenticated');
    });
  });

  describe('getMyLikedPlaylists', () => {
    it('returns my liked playlists', async () => {
      service.getUserLikedPlaylists.mockResolvedValue([]);
      await controller.getMyLikedPlaylists(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws 401 if not authenticated', async () => {
      req.user = null;
      await expect(controller.getMyLikedPlaylists(req, res)).rejects.toThrow('User not authenticated');
    });

    it('throws 400 if offset is NaN', async () => {
      req.query.offset = 'xyz';
      await expect(controller.getMyLikedPlaylists(req, res)).rejects.toThrow('Limit and offset must be numbers');
    });
  });
});
