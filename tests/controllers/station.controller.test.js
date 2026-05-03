const stationController = require('../../src/controllers/station.controller');
const stationService = require('../../src/services/station.service');

jest.mock('../../src/services/station.service', () => ({
  likeStation: jest.fn(),
  unlikeStation: jest.fn(),
  getUserSavedStations: jest.fn(),
}));

describe('station controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = { params: {}, query: {}, user: null };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('likeStation', () => {
    it('throws when the request is unauthenticated', async () => {
      await expect(stationController.likeStation(req, res)).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTH_TOKEN_MISSING',
      });
    });

    it('throws when artist_id is not a UUID', async () => {
      req.user = { sub: 'u1' };
      req.params.artist_id = 'not-a-uuid';

      await expect(stationController.likeStation(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('returns 201 for a new saved station', async () => {
      req.user = { sub: 'u1' };
      req.params.artist_id = '123e4567-e89b-12d3-a456-426614174000';
      stationService.likeStation.mockResolvedValue({
        is_new: true,
        station_id: 'station-1',
        artist_id: '123e4567-e89b-12d3-a456-426614174000',
      });

      await stationController.likeStation(req, res);

      expect(stationService.likeStation).toHaveBeenCalledWith(
        'u1',
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Station saved.',
          data: expect.objectContaining({ is_new: true }),
        })
      );
    });

    it('returns 200 when the station already exists', async () => {
      req.user = { sub: 'u1' };
      req.params.artist_id = '123e4567-e89b-12d3-a456-426614174000';
      stationService.likeStation.mockResolvedValue({ is_new: false, station_id: 'station-1' });

      await stationController.likeStation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('unlikeStation', () => {
    it('throws when artist_id is invalid', async () => {
      req.user = { sub: 'u1' };
      req.params.artist_id = 'bad-id';

      await expect(stationController.unlikeStation(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('returns 200 after removing a station', async () => {
      req.user = { sub: 'u1' };
      req.params.artist_id = '123e4567-e89b-12d3-a456-426614174000';
      stationService.unlikeStation.mockResolvedValue({ unliked: true });

      await stationController.unlikeStation(req, res);

      expect(stationService.unlikeStation).toHaveBeenCalledWith(
        'u1',
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Station removed.' })
      );
    });
  });

  describe('getUserSavedStations', () => {
    it('throws when the request is unauthenticated', async () => {
      await expect(stationController.getUserSavedStations(req, res)).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTH_TOKEN_MISSING',
      });
    });

    it('uses default pagination when query params are missing', async () => {
      req.user = { sub: 'u1' };
      stationService.getUserSavedStations.mockResolvedValue({ items: [{ id: 's1' }], total: 1 });

      await stationController.getUserSavedStations(req, res);

      expect(stationService.getUserSavedStations).toHaveBeenCalledWith('u1', {
        limit: 20,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ id: 's1' }],
          meta: { limit: 20, offset: 0, total: 1 },
        })
      );
    });

    it('clamps limit and offset to safe bounds', async () => {
      req.user = { sub: 'u1' };
      req.query = { limit: '999', offset: '-12' };
      stationService.getUserSavedStations.mockResolvedValue({ items: [], total: 0 });

      await stationController.getUserSavedStations(req, res);

      expect(stationService.getUserSavedStations).toHaveBeenCalledWith('u1', {
        limit: 50,
        offset: 0,
      });
    });

    it('raises low pagination values to the minimum allowed bounds', async () => {
      req.user = { sub: 'u1' };
      req.query = { limit: '0', offset: '5' };
      stationService.getUserSavedStations.mockResolvedValue({ items: [], total: 0 });

      await stationController.getUserSavedStations(req, res);

      expect(stationService.getUserSavedStations).toHaveBeenCalledWith('u1', {
        limit: 1,
        offset: 5,
      });
    });
  });
});