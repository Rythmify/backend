// ============================================================
// tests/users/controllers/users.controller.branches.test.js
// Coverage Target: 100%
// ============================================================

const usersController = require('../../../src/controllers/users.controller');
const usersService = require('../../../src/services/users.service');
const geoUtils = require('../../../src/utils/geo-restrictions');

jest.mock('../../../src/services/users.service');
jest.mock('../../../src/utils/geo-restrictions');

describe('Users Controller - Branch Coverage Expansion', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {}, user: { sub: 's1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    geoUtils.getRequestCountryCode.mockReturnValue(null);
  });

  describe('parsePagination Branches', () => {
    it('uses defaults for non-numeric limit/offset', async () => {
        req.query = { limit: 'abc', offset: 'xyz' };
        usersService.getMyGenres.mockResolvedValue([]);
        await usersController.getMyGenres(req, res);
        expect(usersService.getMyGenres).toHaveBeenCalledWith('s1', { limit: 20, offset: 0 });
    });

    it('clamps limit and offset', async () => {
        req.query = { limit: '200', offset: '-50' };
        usersService.getMyGenres.mockResolvedValue([]);
        await usersController.getMyGenres(req, res);
        expect(usersService.getMyGenres).toHaveBeenCalledWith('s1', { limit: 100, offset: 0 });
    });
  });

  describe('getUserLikedTracks Branches', () => {
    it('handles all user identity fallbacks', async () => {
        req.params.user_id = 'u1';
        req.user = { user_id: 'sub1' };
        usersService.getUserLikedTracks.mockResolvedValue({ data: [], pagination: {} });
        
        await usersController.getUserLikedTracks(req, res);
        expect(usersService.getUserLikedTracks).toHaveBeenCalledWith(expect.objectContaining({ requesterUserId: 'sub1' }));
    });
  });

  describe('updateMe Branches', () => {
    it('handles partial field updates', async () => {
        req.body = { display_name: 'New' }; // Other fields undefined
        usersService.updateMe.mockResolvedValue({});
        await usersController.updateMe(req, res);
        expect(usersService.updateMe).toHaveBeenCalledWith('s1', { display_name: 'New' });
    });
  });

  describe('replaceMyGenres Branches', () => {
    it('throws if genres is not an array', async () => {
        req.body = { genres: 'not-array' };
        await expect(usersController.replaceMyGenres(req, res))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('throws if genres length exceeds 10', async () => {
        req.body = { genres: new Array(11).fill('g') };
        await expect(usersController.replaceMyGenres(req, res))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('updatePrivacy Branches', () => {
    it('throws if is_private is undefined', async () => {
        req.body = {};
        await expect(usersController.updatePrivacy(req, res))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });
});
