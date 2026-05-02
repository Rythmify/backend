const service = require('../../../src/services/album-likes.service');
const albumLikeModel = require('../../../src/models/album-like.model');

jest.mock('../../../src/models/album-like.model');

describe('Album Likes Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlbumLikers', () => {
    it('throws if albumId is missing or empty', async () => {
      await expect(service.getAlbumLikers('')).rejects.toThrow('Album ID is required');
      await expect(service.getAlbumLikers(null)).rejects.toThrow('Album ID is required');
    });

    it('uses defaults for invalid limits and offsets', async () => {
      albumLikeModel.getAlbumLikers.mockResolvedValue([]);
      await service.getAlbumLikers('a1', 0, -1);
      expect(albumLikeModel.getAlbumLikers).toHaveBeenCalledWith('a1', 20, 0);

      await service.getAlbumLikers('a1', 101, -10);
      expect(albumLikeModel.getAlbumLikers).toHaveBeenCalledWith('a1', 20, 0);
    });

    it('returns likers successfully', async () => {
      albumLikeModel.getAlbumLikers.mockResolvedValue([{ id: 1 }]);
      const res = await service.getAlbumLikers('a1', 10, 5);
      expect(albumLikeModel.getAlbumLikers).toHaveBeenCalledWith('a1', 10, 5);
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('likeAlbum', () => {
    it('throws if userId is missing', async () => {
      await expect(service.likeAlbum('', 'a1')).rejects.toThrow('User ID is required');
    });

    it('throws if albumId is missing', async () => {
      await expect(service.likeAlbum('u1', '')).rejects.toThrow('Album ID is required');
    });

    it('likes album successfully', async () => {
      albumLikeModel.likeAlbum.mockResolvedValue({ created: true, like: { id: 1, user_id: 'u1', album_id: 'a1', created_at: 'now' } });
      const res = await service.likeAlbum('u1', 'a1');
      expect(res).toEqual({
        likeId: 1,
        userId: 'u1',
        albumId: 'a1',
        createdAt: 'now',
        isNew: true
      });
    });
  });

  describe('unlikeAlbum', () => {
    it('throws if userId is missing', async () => {
      await expect(service.unlikeAlbum('', 'a1')).rejects.toThrow('User ID is required');
    });

    it('throws if albumId is missing', async () => {
      await expect(service.unlikeAlbum('u1', '')).rejects.toThrow('Album ID is required');
    });

    it('throws 404 if like not found', async () => {
      albumLikeModel.unlikeAlbum.mockResolvedValue(false);
      await expect(service.unlikeAlbum('u1', 'a1')).rejects.toThrow('Like not found');
    });

    it('unlikes album successfully', async () => {
      albumLikeModel.unlikeAlbum.mockResolvedValue(true);
      const res = await service.unlikeAlbum('u1', 'a1');
      expect(res).toBe(true);
    });
  });

  describe('getUserLikedAlbums', () => {
    it('throws if userId is missing', async () => {
      await expect(service.getUserLikedAlbums('')).rejects.toThrow('User ID is required');
    });

    it('uses defaults for invalid limits and offsets', async () => {
      albumLikeModel.getUserLikedAlbums.mockResolvedValue([]);
      await service.getUserLikedAlbums('u1', 0, -1);
      expect(albumLikeModel.getUserLikedAlbums).toHaveBeenCalledWith('u1', 20, 0);
    });

    it('returns liked albums successfully', async () => {
      albumLikeModel.getUserLikedAlbums.mockResolvedValue([{ id: 1 }]);
      const res = await service.getUserLikedAlbums('u1', 10, 5);
      expect(albumLikeModel.getUserLikedAlbums).toHaveBeenCalledWith('u1', 10, 5);
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('isAlbumLikedByUser', () => {
    it('returns false if userId is missing', async () => {
      expect(await service.isAlbumLikedByUser(null, 'a1')).toBe(false);
    });

    it('returns true if album is liked by user', async () => {
      albumLikeModel.isAlbumLikedByUser.mockResolvedValue(true);
      expect(await service.isAlbumLikedByUser('u1', 'a1')).toBe(true);
    });
  });

  describe('getAlbumLikeCount', () => {
    it('returns 0 if albumId is missing', async () => {
      expect(await service.getAlbumLikeCount(null)).toBe(0);
    });

    it('returns count successfully', async () => {
      albumLikeModel.getAlbumLikeCount.mockResolvedValue(5);
      expect(await service.getAlbumLikeCount('a1')).toBe(5);
    });
  });
});
