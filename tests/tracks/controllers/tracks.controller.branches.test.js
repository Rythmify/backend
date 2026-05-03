// ============================================================
// tests/tracks/controllers/tracks.controller.branches.test.js
// Coverage Target: 100%
// ============================================================

const tracksController = require('../../../src/controllers/tracks.controller');
const tracksService = require('../../../src/services/tracks.service');
const geoUtils = require('../../../src/utils/geo-restrictions');

jest.mock('../../../src/services/tracks.service');
jest.mock('../../../src/utils/geo-restrictions');

describe('Tracks Controller - Branch Coverage Expansion', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {}, user: {}, files: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    geoUtils.getRequestCountryCode.mockReturnValue(null);
  });

  describe('uploadTrack Branches', () => {
    it('handles missing cover image file', async () => {
        req.files.audio_file = [{ originalname: 'a.mp3' }];
        req.body.title = 'T';
        tracksService.uploadTrack.mockResolvedValue({ id: 't1' });
        
        await tracksController.uploadTrack(req, res);
        expect(tracksService.uploadTrack).toHaveBeenCalledWith(expect.objectContaining({ coverImageFile: null }));
    });
  });

  describe('getTrackById Branches', () => {
    it('handles missing query and user sub fallback', async () => {
        req.params.track_id = 't1';
        req.query = null;
        req.user = { sub: 's1' };
        tracksService.getTrackById.mockResolvedValue({ id: 't1' });
        
        await tracksController.getTrackById(req, res);
        expect(tracksService.getTrackById).toHaveBeenCalledWith('t1', 's1', null);
    });

    it('adds countryCode if available', async () => {
        req.params.track_id = 't1';
        req.user = { id: 'u1' };
        geoUtils.getRequestCountryCode.mockReturnValue('US');
        tracksService.getTrackById.mockResolvedValue({ id: 't1' });
        
        await tracksController.getTrackById(req, res);
        expect(tracksService.getTrackById).toHaveBeenCalledWith('t1', 'u1', null, 'US');
    });
  });

  describe('updateTrack Branches', () => {
    it('throws if file provided in updateTrack (not cover)', async () => {
        req.file = { originalname: 'x.jpg' };
        await expect(tracksController.updateTrack(req, res))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('getRelatedTracks Branches', () => {
    it('uses default pagination if query missing', async () => {
        req.params.track_id = 't1';
        req.query = {};
        tracksService.getRelatedTracks.mockResolvedValue({ tracks: [], pagination: {} });
        
        await tracksController.getRelatedTracks(req, res);
        expect(tracksService.getRelatedTracks).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
    });
  });
});
