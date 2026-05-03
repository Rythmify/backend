const controller = require('../../../src/controllers/album-likes.controller');
const albumLikesService = require('../../../src/services/album-likes.service');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/services/album-likes.service');

describe('Album Likes Controller', () => {
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

  describe('getAlbumLikers', () => {
    it('throws validation error if limit is NaN', async () => {
      req.params.album_id = 'a1';
      req.query = { limit: 'invalid' };
      await expect(controller.getAlbumLikers(req, res)).rejects.toThrow(AppError);
    });

    it('gets likers successfully', async () => {
      req.params.album_id = 'a1';
      albumLikesService.getAlbumLikers.mockResolvedValue({ items: [] });
      await controller.getAlbumLikers(req, res);
      expect(albumLikesService.getAlbumLikers).toHaveBeenCalledWith('a1', 20, 0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { items: [] } }));
    });
  });

  describe('likeAlbum', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.likeAlbum(req, res)).rejects.toThrow(AppError);
    });

    it('returns 201 if new like', async () => {
      req.params.album_id = 'a1';
      albumLikesService.likeAlbum.mockResolvedValue({
        isNew: true,
        likeId: 'l1',
        userId: 'u1',
        albumId: 'a1',
        createdAt: 'now'
      });
      await controller.likeAlbum(req, res);
      expect(albumLikesService.likeAlbum).toHaveBeenCalledWith('u1', 'a1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Album liked successfully',
        data: { like_id: 'l1', user_id: 'u1', album_id: 'a1', created_at: 'now' }
      }));
    });

    it('returns 200 if already liked', async () => {
      req.params.album_id = 'a1';
      albumLikesService.likeAlbum.mockResolvedValue({
        isNew: false,
        likeId: 'l1',
        userId: 'u1',
        albumId: 'a1',
        createdAt: 'now'
      });
      await controller.likeAlbum(req, res);
      expect(albumLikesService.likeAlbum).toHaveBeenCalledWith('u1', 'a1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Album already liked',
      }));
    });
  });

  describe('unlikeAlbum', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.unlikeAlbum(req, res)).rejects.toThrow(AppError);
    });

    it('unlikes album successfully', async () => {
      req.params.album_id = 'a1';
      albumLikesService.unlikeAlbum.mockResolvedValue(true);
      await controller.unlikeAlbum(req, res);
      expect(albumLikesService.unlikeAlbum).toHaveBeenCalledWith('u1', 'a1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getMyLikedAlbums', () => {
    it('throws 401 if unauthenticated', async () => {
      req.user = null;
      await expect(controller.getMyLikedAlbums(req, res)).rejects.toThrow(AppError);
    });

    it('throws validation error if offset is NaN', async () => {
      req.query = { offset: 'invalid' };
      await expect(controller.getMyLikedAlbums(req, res)).rejects.toThrow(AppError);
    });

    it('gets liked albums successfully', async () => {
      albumLikesService.getUserLikedAlbums.mockResolvedValue({ items: [] });
      await controller.getMyLikedAlbums(req, res);
      expect(albumLikesService.getUserLikedAlbums).toHaveBeenCalledWith('u1', 20, 0);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
