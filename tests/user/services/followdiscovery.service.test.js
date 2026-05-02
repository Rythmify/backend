const service = require('../../../src/services/followdiscovery.service');
const followDiscoveryModel = require('../../../src/models/followdiscovery.model');
const userModel = require('../../../src/models/user.model');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/followdiscovery.model', () => ({
  getMutualFollowSuggestions: jest.fn(),
  getArtistsByUserGenres: jest.fn(),
}));

jest.mock('../../../src/models/user.model', () => ({
  findById: jest.fn(),
}));

describe('FollowDiscovery - Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSuggestedUsers', () => {
    it('returns data and pagination for valid user', async () => {
      userModel.findById.mockResolvedValue({ id: 'user-1' });
      followDiscoveryModel.getMutualFollowSuggestions.mockResolvedValue({
        items: [{ id: 'u2' }, { id: 'u3' }],
        total: 2,
      });

      const result = await service.getSuggestedUsers('user-1', { limit: 20, offset: 0 });

      expect(userModel.findById).toHaveBeenCalledWith('user-1');
      expect(followDiscoveryModel.getMutualFollowSuggestions).toHaveBeenCalledWith('user-1', 20, 0);
      expect(result).toEqual({
        data: [{ id: 'u2' }, { id: 'u3' }],
        pagination: { limit: 20, offset: 0, total: 2 },
      });
    });

    it('throws RESOURCE_NOT_FOUND when user does not exist', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        service.getSuggestedUsers('missing-user', { limit: 10, offset: 5 })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(followDiscoveryModel.getMutualFollowSuggestions).not.toHaveBeenCalled();
    });

    it('throws when pagination is undefined (invalid input boundary)', async () => {
      userModel.findById.mockResolvedValue({ id: 'user-1' });

      await expect(service.getSuggestedUsers('user-1', undefined)).rejects.toThrow(TypeError);
      expect(followDiscoveryModel.getMutualFollowSuggestions).not.toHaveBeenCalled();
    });

    it('bubbles model failures', async () => {
      userModel.findById.mockResolvedValue({ id: 'user-1' });
      followDiscoveryModel.getMutualFollowSuggestions.mockRejectedValue(
        new AppError('DB unavailable', 500, 'DB_ERROR')
      );

      await expect(
        service.getSuggestedUsers('user-1', { limit: 5, offset: 0 })
      ).rejects.toMatchObject({
        statusCode: 500,
        code: 'DB_ERROR',
      });
    });

    it('supports large input values (passed through to model)', async () => {
      userModel.findById.mockResolvedValue({ id: 'user-1' });
      followDiscoveryModel.getMutualFollowSuggestions.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.getSuggestedUsers('user-1', { limit: 100000, offset: 99999 });

      expect(followDiscoveryModel.getMutualFollowSuggestions).toHaveBeenCalledWith(
        'user-1',
        100000,
        99999
      );
    });
  });

  describe('getSuggestedArtists', () => {
    it('returns artist suggestions with pagination', async () => {
      userModel.findById.mockResolvedValue({ id: 'user-1' });
      followDiscoveryModel.getArtistsByUserGenres.mockResolvedValue({
        items: [{ id: 'a1', top_genre: 'Jazz' }],
        total: 1,
      });

      const result = await service.getSuggestedArtists('user-1', { limit: 10, offset: 2 });

      expect(userModel.findById).toHaveBeenCalledWith('user-1');
      expect(followDiscoveryModel.getArtistsByUserGenres).toHaveBeenCalledWith('user-1', 10, 2);
      expect(result).toEqual({
        data: [{ id: 'a1', top_genre: 'Jazz' }],
        pagination: { limit: 10, offset: 2, total: 1 },
      });
    });

    it('throws RESOURCE_NOT_FOUND for unknown user', async () => {
      userModel.findById.mockResolvedValue(undefined);

      await expect(
        service.getSuggestedArtists('ghost-user', { limit: 20, offset: 0 })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(followDiscoveryModel.getArtistsByUserGenres).not.toHaveBeenCalled();
    });

    it('throws when pagination is null', async () => {
      userModel.findById.mockResolvedValue({ id: 'user-1' });

      await expect(service.getSuggestedArtists('user-1', null)).rejects.toThrow(TypeError);
      expect(followDiscoveryModel.getArtistsByUserGenres).not.toHaveBeenCalled();
    });

    it('bubbles unexpected rejected promises from user model', async () => {
      userModel.findById.mockRejectedValue(new Error('user query timeout'));

      await expect(service.getSuggestedArtists('user-1', { limit: 10, offset: 0 })).rejects.toThrow(
        'user query timeout'
      );
      expect(followDiscoveryModel.getArtistsByUserGenres).not.toHaveBeenCalled();
    });
  });
});
