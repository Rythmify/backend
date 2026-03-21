// ============================================================
// tests/user/controllers/users.controller.test.js
// Unit tests for users controller layer (HTTP handlers)
// ============================================================

const fixtures = require('../helpers/test-fixtures');

// Mock service layer before importing controller
jest.mock('../../../src/services/users.service', () => ({
  getMe: jest.fn(),
  getUserById: jest.fn(),
  updateMe: jest.fn(),
  updateMyAccount: jest.fn(),
  switchRole: jest.fn(),
  updatePrivacy: jest.fn(),
  getMyWebProfile: jest.fn(),
  addWebProfile: jest.fn(),
  deleteWebProfile: jest.fn(),
  uploadMyAvatar: jest.fn(),
  uploadMyCoverPhoto: jest.fn(),
  deleteMyCoverPhoto: jest.fn(),
  deleteMyAvatar: jest.fn(),
  getMyGenres: jest.fn(),
  replaceMyGenres: jest.fn(),
  completeOnboarding: jest.fn(),
}));

const usersService = require('../../../src/services/users.service');
const usersController = require('../../../src/controllers/users.controller');

// Helper to create mock req/res
const createMocks = () => {
  const req = {
    user: { sub: 'user-123' },
    body: {},
    params: {},
    file: null,
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return { req, res };
};

describe('Users Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // getMyWebProfile tests
  // ========================================
  describe('getMyWebProfile', () => {
    it('should return 200 with web profiles', async () => {
      const { req, res } = createMocks();
      res.status.mockReturnThis();
      usersService.getMyWebProfile.mockResolvedValue(fixtures.mockWebProfiles);

      await usersController.getMyWebProfile(req, res);

      expect(usersService.getMyWebProfile).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockWebProfiles,
        message: 'Web profiles returned successfully.',
      });
    });

    it('should handle service errors', async () => {
      const { req, res } = createMocks();
      const error = new Error('User not found');
      error.statusCode = 404;
      usersService.getMyWebProfile.mockRejectedValue(error);

      try {
        await usersController.getMyWebProfile(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err).toEqual(error);
      }
    });
  });

  // ========================================
  // addWebProfile tests
  // ========================================
  describe('addWebProfile', () => {
    it('should create profile with valid data', async () => {
      const { req, res } = createMocks();
      req.body = { platform: 'Twitter', url: 'https://twitter.com/user' };
      res.status.mockReturnThis();
      usersService.addWebProfile.mockResolvedValue(fixtures.mockWebProfile);

      await usersController.addWebProfile(req, res);

      expect(usersService.addWebProfile).toHaveBeenCalledWith('user-123', 'Twitter', 'https://twitter.com/user');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockWebProfile,
        message: 'Web profile link created.',
      });
    });

    it('should handle service conflict error', async () => {
      const { req, res } = createMocks();
      req.body = { platform: 'Twitter', url: 'https://twitter.com/user' };
      const error = new Error('A profile for this platform already exists.');
      error.statusCode = 409;
      usersService.addWebProfile.mockRejectedValue(error);

      try {
        await usersController.addWebProfile(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }
    });
  });

  // ========================================
  // deleteWebProfile tests
  // ========================================
  describe('deleteWebProfile', () => {
    it('should delete profile with correct profile_id', async () => {
      const { req, res } = createMocks();
      req.params = { profile_id: 'profile-1' };
      res.status.mockReturnThis();
      usersService.deleteWebProfile.mockResolvedValue({ id: 'profile-1' });

      await usersController.deleteWebProfile(req, res);

      expect(usersService.deleteWebProfile).toHaveBeenCalledWith('user-123', 'profile-1');
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle 404 profile not found', async () => {
      const { req, res } = createMocks();
      req.params = { profile_id: 'profile-999' };
      const error = new Error('Web profile not found');
      error.statusCode = 404;
      usersService.deleteWebProfile.mockRejectedValue(error);

      try {
        await usersController.deleteWebProfile(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('should handle 403 permission denied', async () => {
      const { req, res } = createMocks();
      req.params = { profile_id: 'profile-1' };
      const error = new Error('You are not allowed to delete this profile.');
      error.statusCode = 403;
      usersService.deleteWebProfile.mockRejectedValue(error);

      try {
        await usersController.deleteWebProfile(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  // ========================================
  // uploadMyAvatar tests
  // ========================================
  describe('uploadMyAvatar', () => {
    it('should throw 400 if no file provided', async () => {
      const { req, res } = createMocks();
      req.file = null;

      try {
        await usersController.uploadMyAvatar(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('No image file provided');
      }
    });

    it('should upload avatar if file provided', async () => {
      const { req, res } = createMocks();
      req.file = { filename: 'avatar.jpg' };
      res.status.mockReturnThis();
      usersService.uploadMyAvatar.mockResolvedValue({
        ...fixtures.mockUser,
        profile_picture: 'https://cdn.rythmify.com/avatars/user-123.jpg',
      });

      await usersController.uploadMyAvatar(req, res);

      expect(usersService.uploadMyAvatar).toHaveBeenCalledWith('user-123', req.file);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ========================================
  // uploadMyCoverPhoto tests
  // ========================================
  describe('uploadMyCoverPhoto', () => {
    it('should throw 400 if no file provided', async () => {
      const { req, res } = createMocks();
      req.file = null;

      try {
        await usersController.uploadMyCoverPhoto(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('No image file provided');
      }
    });

    it('should upload cover photo if file provided', async () => {
      const { req, res } = createMocks();
      req.file = { filename: 'cover.jpg' };
      res.status.mockReturnThis();
      usersService.uploadMyCoverPhoto.mockResolvedValue({
        ...fixtures.mockUser,
        cover_photo: 'https://cdn.rythmify.com/covers/user-123.jpg',
      });

      await usersController.uploadMyCoverPhoto(req, res);

      expect(usersService.uploadMyCoverPhoto).toHaveBeenCalledWith('user-123', req.file);
      expect(res.json).toHaveBeenCalled();
    });
  });
});
  