const service = require('../../../src/services/album-reposts.service');
const albumRepostModel = require('../../../src/models/album-repost.model');

jest.mock('../../../src/models/album-repost.model');

describe('Album Reposts Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlbumReposters', () => {
    it('throws if albumId is missing or empty', async () => {
      await expect(service.getAlbumReposters('')).rejects.toThrow('Album ID is required');
      await expect(service.getAlbumReposters(null)).rejects.toThrow('Album ID is required');
    });

    it('uses defaults for invalid limits and offsets', async () => {
      albumRepostModel.getAlbumReposters.mockResolvedValue([]);
      await service.getAlbumReposters('a1', 0, -1);
      expect(albumRepostModel.getAlbumReposters).toHaveBeenCalledWith('a1', 20, 0);

      await service.getAlbumReposters('a1', 101, -10);
      expect(albumRepostModel.getAlbumReposters).toHaveBeenCalledWith('a1', 20, 0);
    });

    it('returns reposters successfully', async () => {
      albumRepostModel.getAlbumReposters.mockResolvedValue([{ id: 1 }]);
      const res = await service.getAlbumReposters('a1', 10, 5);
      expect(albumRepostModel.getAlbumReposters).toHaveBeenCalledWith('a1', 10, 5);
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('repostAlbum', () => {
    it('throws if userId is missing', async () => {
      await expect(service.repostAlbum('', 'a1')).rejects.toThrow('User ID is required');
    });

    it('throws if albumId is missing', async () => {
      await expect(service.repostAlbum('u1', '')).rejects.toThrow('Album ID is required');
    });

    it('throws if user tries to repost own album', async () => {
      albumRepostModel.getAlbumOwner.mockResolvedValue('u1');
      await expect(service.repostAlbum('u1', 'a1')).rejects.toThrow('Cannot repost your own album');
    });

    it('reposts album successfully', async () => {
      albumRepostModel.getAlbumOwner.mockResolvedValue('u2');
      albumRepostModel.repostAlbum.mockResolvedValue({ created: true, repost: { id: 1, user_id: 'u1', album_id: 'a1', created_at: 'now' } });
      const res = await service.repostAlbum('u1', 'a1');
      expect(res).toEqual({
        repostId: 1,
        userId: 'u1',
        albumId: 'a1',
        createdAt: 'now',
        isNew: true
      });
    });
  });

  describe('removeRepost', () => {
    it('throws if userId is missing', async () => {
      await expect(service.removeRepost('', 'a1')).rejects.toThrow('User ID is required');
    });

    it('throws if albumId is missing', async () => {
      await expect(service.removeRepost('u1', '')).rejects.toThrow('Album ID is required');
    });

    it('throws 404 if repost not found', async () => {
      albumRepostModel.removeRepost.mockResolvedValue(false);
      await expect(service.removeRepost('u1', 'a1')).rejects.toThrow('Repost not found');
    });

    it('removes repost successfully', async () => {
      albumRepostModel.removeRepost.mockResolvedValue(true);
      const res = await service.removeRepost('u1', 'a1');
      expect(res).toBe(true);
    });
  });

  describe('getUserRepostedAlbums', () => {
    it('throws if userId is missing', async () => {
      await expect(service.getUserRepostedAlbums('')).rejects.toThrow('User ID is required');
    });

    it('uses defaults for invalid limits and offsets', async () => {
      albumRepostModel.getUserRepostedAlbums.mockResolvedValue([]);
      await service.getUserRepostedAlbums('u1', 0, -1);
      expect(albumRepostModel.getUserRepostedAlbums).toHaveBeenCalledWith('u1', 20, 0);
    });

    it('returns reposted albums successfully', async () => {
      albumRepostModel.getUserRepostedAlbums.mockResolvedValue([{ id: 1 }]);
      const res = await service.getUserRepostedAlbums('u1', 10, 5);
      expect(albumRepostModel.getUserRepostedAlbums).toHaveBeenCalledWith('u1', 10, 5);
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('isAlbumRepostedByUser', () => {
    it('returns false if userId is missing', async () => {
      expect(await service.isAlbumRepostedByUser(null, 'a1')).toBe(false);
    });

    it('returns true if album is reposted by user', async () => {
      albumRepostModel.isAlbumRepostedByUser.mockResolvedValue(true);
      expect(await service.isAlbumRepostedByUser('u1', 'a1')).toBe(true);
    });
  });

  describe('getAlbumRepostCount', () => {
    it('returns 0 if albumId is missing', async () => {
      expect(await service.getAlbumRepostCount(null)).toBe(0);
    });

    it('returns count successfully', async () => {
      albumRepostModel.getAlbumRepostCount.mockResolvedValue(5);
      expect(await service.getAlbumRepostCount('a1')).toBe(5);
    });
  });
});
