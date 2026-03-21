// ============================================================
// tests/user/services/users.service.test.js
// Unit tests for users service layer (business logic)
// ============================================================

const fixtures = require('../helpers/test-fixtures');

// Mock the model layer before importing service
  jest.mock('../../../src/models/user.model', () => ({
  findById: jest.fn(),
  findFullById: jest.fn(),
  findPublicById: jest.fn(),
  findWebProfilesByUserId: jest.fn(),
  findWebProfileByPlatform: jest.fn(),
  createWebProfile: jest.fn(),
  deleteWebProfile: jest.fn(),
  findWebProfileById: jest.fn(),
  updateAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
  updateCoverPhoto: jest.fn(),
  deleteCoverPhoto: jest.fn(),
  updateProfile: jest.fn(),
  updateAccount: jest.fn(),
  updateRole: jest.fn(),
  updatePrivacy: jest.fn(),
  isFollowing: jest.fn(),
}));

const userModel = require('../../../src/models/user.model');
const usersService = require('../../../src/services/users.service');

describe('Users Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // getMyWebProfile tests
  // ========================================
  describe('getMyWebProfile', () => {
    it('should return empty array if no profiles exist', async () => {
      userModel.findWebProfilesByUserId.mockResolvedValue([]);

      const result = await usersService.getMyWebProfile('user-123');

      expect(result).toEqual([]);
      expect(userModel.findWebProfilesByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return all web profiles for user', async () => {
      userModel.findWebProfilesByUserId.mockResolvedValue(fixtures.mockWebProfiles);

      const result = await usersService.getMyWebProfile('user-123');

      expect(result).toEqual(fixtures.mockWebProfiles);
      expect(result).toHaveLength(2);
    });
  });

  // ========================================
  // addWebProfile tests
  // ========================================
  describe('addWebProfile', () => {
    it('should throw 409 if platform already exists', async () => {
      userModel.findWebProfileByPlatform.mockResolvedValue({ id: 'profile-1', platform: 'Twitter' });

      await expect(
        usersService.addWebProfile('user-123', 'Twitter', 'https://twitter.com/newuser')
      ).rejects.toThrow('A profile for this platform already exists.');

      expect(userModel.findWebProfileByPlatform).toHaveBeenCalledWith('user-123', 'Twitter');
      expect(userModel.createWebProfile).not.toHaveBeenCalled();
    });

    it('should create profile if platform does not exist', async () => {
      const newProfile = {
        id: 'profile-new',
        platform: 'LinkedIn',
        url: 'https://linkedin.com/in/user',
      };
      userModel.findWebProfileByPlatform.mockResolvedValue(null);
      userModel.createWebProfile.mockResolvedValue(newProfile);

      const result = await usersService.addWebProfile('user-123', 'LinkedIn', 'https://linkedin.com/in/user');

      expect(result).toEqual(newProfile);
      expect(userModel.createWebProfile).toHaveBeenCalledWith('user-123', 'LinkedIn', 'https://linkedin.com/in/user');
    });

    it('should throw 409 error with correct code', async () => {
      userModel.findWebProfileByPlatform.mockResolvedValue({ id: 'profile-1' });

      try {
        await usersService.addWebProfile('user-123', 'Twitter', 'https://twitter.com/user');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('RESOURCE_ALREADY_EXISTS');
      }
    });
  });

  // ========================================
  // deleteWebProfile tests
  // ========================================
  describe('deleteWebProfile', () => {
    it('should throw 404 if profile not found', async () => {
      userModel.findWebProfileById.mockResolvedValue(null);

      await expect(
        usersService.deleteWebProfile('user-123', 'profile-999')
      ).rejects.toThrow('Web profile not found');

      expect(userModel.deleteWebProfile).not.toHaveBeenCalled();
    });

    it('should throw 403 if user is not profile owner', async () => {
      userModel.findWebProfileById.mockResolvedValue({
        id: 'profile-1',
        user_id: 'different-user',
        platform: 'Twitter',
      });

      await expect(
        usersService.deleteWebProfile('user-123', 'profile-1')
      ).rejects.toThrow('You are not allowed to delete this profile.');

      expect(userModel.deleteWebProfile).not.toHaveBeenCalled();
    });

    it('should delete profile if user is owner', async () => {
      userModel.findWebProfileById.mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-123',
        platform: 'Twitter',
      });
      userModel.deleteWebProfile.mockResolvedValue({ id: 'profile-1' });

      const result = await usersService.deleteWebProfile('user-123', 'profile-1');

      expect(result).toEqual({ id: 'profile-1' });
      expect(userModel.deleteWebProfile).toHaveBeenCalledWith('profile-1');
    });

    it('should throw 403 error with correct code', async () => {
      userModel.findWebProfileById.mockResolvedValue({
        id: 'profile-1',
        user_id: 'different-user',
      });

      try {
        await usersService.deleteWebProfile('user-123', 'profile-1');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('PERMISSION_DENIED');
      }
    });
  });

  // ========================================
  // uploadMyAvatar tests
  // ========================================
  describe('uploadMyAvatar', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        usersService.uploadMyAvatar('user-999', { filename: 'avatar.jpg' })
      ).rejects.toThrow('User not found');

      expect(userModel.updateAvatar).not.toHaveBeenCalled();
    });

    it('should upload avatar with CDN URL', async () => {
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updateAvatar.mockResolvedValue({
        ...fixtures.mockUser,
        profile_picture: 'https://cdn.rythmify.com/avatars/user-123.jpg',
      });

      const result = await usersService.uploadMyAvatar('user-123', { filename: 'avatar.jpg' });

      expect(userModel.updateAvatar).toHaveBeenCalledWith('user-123', 'https://cdn.rythmify.com/avatars/user-123.jpg');
      expect(result.profile_picture).toBe('https://cdn.rythmify.com/avatars/user-123.jpg');
    });
  });

  // ========================================
  // deleteMyCoverPhoto tests
  // ========================================
  describe('deleteMyCoverPhoto', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(usersService.deleteMyCoverPhoto('user-999')).rejects.toThrow('User not found');

      expect(userModel.deleteCoverPhoto).not.toHaveBeenCalled();
    });

    it('should throw 404 if user has no cover photo', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, cover_photo: null });

      await expect(usersService.deleteMyCoverPhoto('user-123')).rejects.toThrow('No cover photo to delete');

      expect(userModel.deleteCoverPhoto).not.toHaveBeenCalled();
    });

    it('should delete cover photo if exists', async () => {
      userModel.findById.mockResolvedValue({
        ...fixtures.mockUser,
        cover_photo: 'https://cdn.example.com/cover.jpg',
      });
      userModel.deleteCoverPhoto.mockResolvedValue({ cover_photo: null });

      const result = await usersService.deleteMyCoverPhoto('user-123');

      expect(result).toEqual({ cover_photo: null });
      expect(userModel.deleteCoverPhoto).toHaveBeenCalledWith('user-123');
    });
  });

  // ========================================
  // deleteMyAvatar tests
  // ========================================
  describe('deleteMyAvatar', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(usersService.deleteMyAvatar('user-999')).rejects.toThrow('User not found');

      expect(userModel.deleteAvatar).not.toHaveBeenCalled();
    });

    it('should throw 404 if user has no avatar', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, profile_picture: null });

      await expect(usersService.deleteMyAvatar('user-123')).rejects.toThrow('No avatar to delete');

      expect(userModel.deleteAvatar).not.toHaveBeenCalled();
    });

    it('should delete avatar if exists', async () => {
      userModel.findById.mockResolvedValue({
        ...fixtures.mockUser,
        profile_picture: 'https://cdn.example.com/avatar.jpg',
      });
      userModel.deleteAvatar.mockResolvedValue({ profile_picture: null });

      const result = await usersService.deleteMyAvatar('user-123');

      expect(result).toEqual({ profile_picture: null });
      expect(userModel.deleteAvatar).toHaveBeenCalledWith('user-123');
    });
  });

  // ========================================
  // updateMyCoverPhoto tests
  // ========================================
  describe('updateMyCoverPhoto', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        usersService.uploadMyCoverPhoto('user-999', { filename: 'cover.jpg' })
      ).rejects.toThrow('User not found');

      expect(userModel.updateCoverPhoto).not.toHaveBeenCalled();
    });

    it('should update cover photo with CDN URL', async () => {
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updateCoverPhoto.mockResolvedValue({
        ...fixtures.mockUser,
        cover_photo: 'https://cdn.rythmify.com/covers/user-123.jpg',
      });

      const result = await usersService.uploadMyCoverPhoto('user-123', { filename: 'cover.jpg' });

      expect(userModel.updateCoverPhoto).toHaveBeenCalledWith('user-123', 'https://cdn.rythmify.com/covers/user-123.jpg');
      expect(result.cover_photo).toBe('https://cdn.rythmify.com/covers/user-123.jpg');
    });
  });
});
