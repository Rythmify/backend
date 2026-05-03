/**
 * @fileoverview Unit tests for Station Service
 * Coverage Target: >95%
 */

const stationService = require('../../../src/services/station.service');
const stationModel = require('../../../src/models/station.model');
const userModel = require('../../../src/models/user.model');
const AppError = require('../../../src/utils/app-error');

jest.mock('../../../src/models/station.model');
jest.mock('../../../src/models/user.model');

describe('Station Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('likeStation', () => {
    it('should successfully like a station and return details', async () => {
      userModel.findById.mockResolvedValue({ id: 'a1', display_name: 'Artist Name' });
      stationModel.saveStation.mockResolvedValue({
        created: true,
        station: { id: 's1' },
      });

      const result = await stationService.likeStation('u1', 'a1');

      expect(userModel.findById).toHaveBeenCalledWith('a1');
      expect(stationModel.saveStation).toHaveBeenCalledWith('u1', 'a1');
      expect(result).toEqual({
        station_id: 's1',
        artist_id: 'a1',
        artist_name: 'Artist Name',
        is_new: true,
      });
    });

    it('should throw 404 if artist not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(stationService.likeStation('u1', 'a1')).rejects.toThrow(
        new AppError('Artist not found.', 404, 'RESOURCE_NOT_FOUND')
      );
    });

    it('should throw 404 if artist is soft-deleted', async () => {
      userModel.findById.mockResolvedValue({ id: 'a1', deleted_at: new Date() });

      await expect(stationService.likeStation('u1', 'a1')).rejects.toThrow(
        new AppError('Artist not found.', 404, 'RESOURCE_NOT_FOUND')
      );
    });
  });

  describe('unlikeStation', () => {
    it('should successfully unlike a station', async () => {
      stationModel.unsaveStation.mockResolvedValue(true);

      const result = await stationService.unlikeStation('u1', 'a1');

      expect(stationModel.unsaveStation).toHaveBeenCalledWith('u1', 'a1');
      expect(result).toEqual({ unliked: true });
    });
  });

  describe('getUserSavedStations', () => {
    it('should return paginated saved stations for a user', async () => {
      userModel.findById.mockResolvedValue({ id: 'u1' });
      const mockStations = { items: [{ id: 's1' }], total: 1 };
      stationModel.getUserSavedStations.mockResolvedValue(mockStations);

      const result = await stationService.getUserSavedStations('u1', { limit: 10, offset: 0 });

      expect(userModel.findById).toHaveBeenCalledWith('u1');
      expect(stationModel.getUserSavedStations).toHaveBeenCalledWith('u1', 10, 0);
      expect(result).toEqual(mockStations);
    });

    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        stationService.getUserSavedStations('u1', { limit: 10, offset: 0 })
      ).rejects.toThrow(new AppError('User not found.', 404, 'RESOURCE_NOT_FOUND'));
    });
  });
});
