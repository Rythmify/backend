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
 // ========================================
  // deleteMyAvatar tests
  // ========================================
  describe('deleteMyAvatar', () => {
    it('should call service with user id', async () => {
      const { req, res } = createMocks();
      res.status.mockReturnThis();
      usersService.deleteMyAvatar.mockResolvedValue({ profile_picture: null });

      await usersController.deleteMyAvatar(req, res);

      expect(usersService.deleteMyAvatar).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle 404 no avatar', async () => {
      const { req, res } = createMocks();
      const error = new Error('No avatar to delete');
      error.statusCode = 404;
      usersService.deleteMyAvatar.mockRejectedValue(error);

      try {
        await usersController.deleteMyAvatar(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  // ========================================
  // getMe tests
  // ========================================
  describe('getMe', () => {
    it('should return user profile', async () => {
      const { req, res } = createMocks();
      res.status.mockReturnThis();
      usersService.getMe.mockResolvedValue(fixtures.mockUser);

      await usersController.getMe(req, res);

      expect(usersService.getMe).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockUser,
        message: 'Own profile returned successfully.',
      });
    });

    it('should handle service errors', async () => {
      const { req, res } = createMocks();
      const error = new Error('User not found');
      error.statusCode = 404;
      usersService.getMe.mockRejectedValue(error);

      try {
        await usersController.getMe(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  // ========================================
  // getUserById tests
  // ========================================
  describe('getUserById', () => {
    it('should return user profile by id', async () => {
      const { req, res } = createMocks();
      req.params = { user_id: 'user-456' };
      res.status.mockReturnThis();
      usersService.getUserById.mockResolvedValue(fixtures.mockUser);

      await usersController.getUserById(req, res);

      expect(usersService.getUserById).toHaveBeenCalledWith('user-456', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockUser,
        message: 'User profile returned successfully.',
      });
    });

    it('should handle 404 user not found', async () => {
      const { req, res } = createMocks();
      req.params = { user_id: 'user-999' };
      const error = new Error('User not found');
      error.statusCode = 404;
      usersService.getUserById.mockRejectedValue(error);

      try {
        await usersController.getUserById(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  // ========================================
  // updateMe tests
  // ========================================
  describe('updateMe', () => {
    it('should update profile with valid data', async () => {
      const { req, res } = createMocks();
      req.body = { display_name: 'New Name', bio: 'New bio' };
      res.status.mockReturnThis();
      usersService.updateMe.mockResolvedValue({
        ...fixtures.mockUser,
        display_name: 'New Name',
        bio: 'New bio',
      });

      await usersController.updateMe(req, res);

      expect(usersService.updateMe).toHaveBeenCalledWith('user-123', {
        display_name: 'New Name',
        bio: 'New bio',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should update only provided fields', async () => {
      const { req, res } = createMocks();
      req.body = { username: 'newusername' };
      res.status.mockReturnThis();
      usersService.updateMe.mockResolvedValue(fixtures.mockUser);

      await usersController.updateMe(req, res);

      expect(usersService.updateMe).toHaveBeenCalledWith('user-123', {
        username: 'newusername',
      });
    });

    it('should handle service errors', async () => {
      const { req, res } = createMocks();
      req.body = { display_name: 'New Name' };
      const error = new Error('Validation failed');
      error.statusCode = 400;
      usersService.updateMe.mockRejectedValue(error);

      try {
        await usersController.updateMe(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
      }
    });
  });

  // ========================================
  // updateMyAccount tests
  // ========================================
  describe('updateMyAccount', () => {
    it('should update account with date_of_birth and gender', async () => {
      const { req, res } = createMocks();
      req.body = { date_of_birth: '1990-01-01', gender: 'female' };
      res.status.mockReturnThis();
      usersService.updateMyAccount.mockResolvedValue({
        ...fixtures.mockUser,
        date_of_birth: '1990-01-01',
        gender: 'female',
      });

      await usersController.updateMyAccount(req, res);

      expect(usersService.updateMyAccount).toHaveBeenCalledWith('user-123', {
        date_of_birth: '1990-01-01',
        gender: 'female',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should update only provided account fields', async () => {
      const { req, res } = createMocks();
      req.body = { gender: 'male' };
      res.status.mockReturnThis();
      usersService.updateMyAccount.mockResolvedValue(fixtures.mockUser);

      await usersController.updateMyAccount(req, res);

      expect(usersService.updateMyAccount).toHaveBeenCalledWith('user-123', {
        gender: 'male',
      });
    });
  });

  // ========================================
  // switchRole tests
  // ========================================
  describe('switchRole', () => {
    it('should switch user role', async () => {
      const { req, res } = createMocks();
      req.body = { role: 'artist' };
      res.status.mockReturnThis();
      usersService.switchRole.mockResolvedValue({
        ...fixtures.mockUser,
        role: 'artist',
      });

      await usersController.switchRole(req, res);

      expect(usersService.switchRole).toHaveBeenCalledWith('user-123', 'artist');
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle invalid role', async () => {
      const { req, res } = createMocks();
      req.body = { role: 'invalid_role' };
      const error = new Error('Invalid role');
      error.statusCode = 400;
      usersService.switchRole.mockRejectedValue(error);

      try {
        await usersController.switchRole(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
      }
    });
  });

  // ========================================
  // updatePrivacy tests
  // ========================================
  describe('updatePrivacy', () => {
    it('should throw 400 if is_private is missing', async () => {
      const { req, res } = createMocks();
      req.body = {};

      try {
        await usersController.updatePrivacy(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('is_private field is required');
      }
    });

    it('should set profile to private', async () => {
      const { req, res } = createMocks();
      req.body = { is_private: true };
      res.status.mockReturnThis();
      usersService.updatePrivacy.mockResolvedValue({
        ...fixtures.mockUser,
        is_private: true,
      });

      await usersController.updatePrivacy(req, res);

      expect(usersService.updatePrivacy).toHaveBeenCalledWith('user-123', true);
      expect(res.json).toHaveBeenCalled();
    });

    it('should set profile to public', async () => {
      const { req, res } = createMocks();
      req.body = { is_private: false };
      res.status.mockReturnThis();
      usersService.updatePrivacy.mockResolvedValue({
        ...fixtures.mockUser,
        is_private: false,
      });

      await usersController.updatePrivacy(req, res);

      expect(usersService.updatePrivacy).toHaveBeenCalledWith('user-123', false);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ========================================
  // getMyGenres tests
  // ========================================
  describe('getMyGenres', () => {
    it('should return favorite genres', async () => {
      const { req, res } = createMocks();
      res.status.mockReturnThis();
      const mockGenres = ['Rock', 'Jazz', 'Pop'];
      usersService.getMyGenres.mockResolvedValue(mockGenres);

      await usersController.getMyGenres(req, res);

      expect(usersService.getMyGenres).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        data: mockGenres,
        message: 'Favorite genres returned successfully.',
      });
    });

    it('should return empty array if no genres', async () => {
      const { req, res } = createMocks();
      res.status.mockReturnThis();
      usersService.getMyGenres.mockResolvedValue([]);

      await usersController.getMyGenres(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [],
        message: 'Favorite genres returned successfully.',
      });
    });
  });

  // ========================================
  // replaceMyGenres tests
  // ========================================
  describe('replaceMyGenres', () => {
    it('should throw 400 if genres is not array', async () => {
      const { req, res } = createMocks();
      req.body = { genres: 'Rock' };

      try {
        await usersController.replaceMyGenres(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('genres must be an array');
      }
    });

    it('should throw 400 if genres exceeds 10 items', async () => {
      const { req, res } = createMocks();
      req.body = {
        genres: Array(11).fill('Genre'),
      };

      try {
        await usersController.replaceMyGenres(req, res);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('Maximum of 10 genres allowed');
      }
    });

    it('should update genres with valid data', async () => {
      const { req, res } = createMocks();
      const genres = ['Rock', 'Jazz', 'Pop'];
      req.body = { genres };
      res.status.mockReturnThis();
      usersService.replaceMyGenres.mockResolvedValue(genres);

      await usersController.replaceMyGenres(req, res);

      expect(usersService.replaceMyGenres).toHaveBeenCalledWith('user-123', genres);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ========================================
  // completeOnboarding tests
  // ========================================
  describe('completeOnboarding', () => {
    it('should complete onboarding with all fields', async () => {
      const { req, res } = createMocks();
      req.body = {
        display_name: 'John Doe',
        gender: 'male',
        date_of_birth: '1990-01-01',
        bio: 'Music lover',
        city: 'New York',
        country: 'USA',
      };
      res.status.mockReturnThis();
      usersService.completeOnboarding.mockResolvedValue({
        ...fixtures.mockUser,
        ...req.body,
      });

      await usersController.completeOnboarding(req, res);

      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-123', {
        display_name: 'John Doe',
        gender: 'male',
        date_of_birth: '1990-01-01',
        bio: 'Music lover',
        city: 'New York',
        country: 'USA',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should complete onboarding with partial fields', async () => {
      const { req, res } = createMocks();
      req.body = { display_name: 'Jane Doe', bio: 'Artist' };
      res.status.mockReturnThis();
      usersService.completeOnboarding.mockResolvedValue(fixtures.mockUser);

      await usersController.completeOnboarding(req, res);

      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-123', {
        display_name: 'Jane Doe',
        bio: 'Artist',
      });
    });

    it('should handle empty body', async () => {
      const { req, res } = createMocks();
      req.body = {};
      res.status.mockReturnThis();
      usersService.completeOnboarding.mockResolvedValue(fixtures.mockUser);

      await usersController.completeOnboarding(req, res);

      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-123', {});
      expect(res.json).toHaveBeenCalled();
    });
  });

  