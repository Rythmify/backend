const controller = require('../../../src/controllers/album-reposts.controller');
const albumRepostsService = require('../../../src/services/album-reposts.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/album-reposts.service');

describe('Album Reposts Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      user: { id: 'u1' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getAlbumReposters', () => {
    it('throws validation error if limit is NaN', async () => {
      req.params.album_id = 'a1';
      req.query = { limit: 'invalid' };
      await expect(controller.getAlbumReposters(req, res)).rejects.toThrow(AppError);
    });

    it('gets reposters successfully', async () => {
      req.params.album_id = 'a1';
      albumRepostsService.getAlbumReposters.mockResolvedValue({ items: [] });
      await controller.getAlbumReposters(req, res);
      expect(albumRepostsService.getAlbumReposters).toHaveBeenCalledWith('a1', 20, 0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { items: [] } }));
    });
  });

  describe('repostAlbum', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.repostAlbum(req, res)).rejects.toThrow(AppError);
    });

    it('returns 201 if new repost', async () => {
      req.params.album_id = 'a1';
      albumRepostsService.repostAlbum.mockResolvedValue({
        isNew: true,
        repostId: 'r1',
        userId: 'u1',
        albumId: 'a1',
        createdAt: 'now'
      });
      await controller.repostAlbum(req, res);
      expect(albumRepostsService.repostAlbum).toHaveBeenCalledWith('u1', 'a1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Album reposted successfully',
        data: { repost_id: 'r1', user_id: 'u1', album_id: 'a1', created_at: 'now' }
      }));
    });

    it('returns 200 if already reposted', async () => {
      req.params.album_id = 'a1';
      albumRepostsService.repostAlbum.mockResolvedValue({
        isNew: false,
        repostId: 'r1',
        userId: 'u1',
        albumId: 'a1',
        createdAt: 'now'
      });
      await controller.repostAlbum(req, res);
      expect(albumRepostsService.repostAlbum).toHaveBeenCalledWith('u1', 'a1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Album already reposted',
      }));
    });
  });

  describe('removeRepost', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.removeRepost(req, res)).rejects.toThrow(AppError);
    });

    it('removes repost successfully', async () => {
      req.params.album_id = 'a1';
      albumRepostsService.removeRepost.mockResolvedValue(true);
      await controller.removeRepost(req, res);
      expect(albumRepostsService.removeRepost).toHaveBeenCalledWith('u1', 'a1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getMyRepostedAlbums', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.getMyRepostedAlbums(req, res)).rejects.toThrow(AppError);
    });

    it('throws validation error if offset is NaN', async () => {
      req.query = { offset: 'invalid' };
      await expect(controller.getMyRepostedAlbums(req, res)).rejects.toThrow(AppError);
    });

    it('gets reposted albums successfully', async () => {
      albumRepostsService.getUserRepostedAlbums.mockResolvedValue({ items: [] });
      await controller.getMyRepostedAlbums(req, res);
      expect(albumRepostsService.getUserRepostedAlbums).toHaveBeenCalledWith('u1', 20, 0);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
