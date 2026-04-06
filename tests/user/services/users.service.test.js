// ============================================================
// tests/user/services/users.service.test.js
// Unit tests for users service layer (business logic)
// ============================================================

const fixtures = require('../helpers/test-fixtures');

jest.mock('../../../src/models/user.model', () => ({
  findById: jest.fn(),
  findFullById: jest.fn(),
  findPublicById: jest.fn(),
  findByUsername: jest.fn(),
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
  findGenresByUserId: jest.fn(),
  replaceGenres: jest.fn(),
  completeOnboarding: jest.fn(),
  findContentSettingsByUserId: jest.fn(),
  updateContentSettings: jest.fn(),
  findPrivacySettingsByUserId: jest.fn(),
  updatePrivacySettings: jest.fn(),
}));

jest.mock('../../../src/models/track.model', () => ({
  findPublicTracksByUserId: jest.fn(),
}));

const userModel = require('../../../src/models/user.model');
const trackModel = require('../../../src/models/track.model');
const usersService = require('../../../src/services/users.service');

const VALID_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('Users Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // getMe
  // ========================================
  describe('getMe', () => {
    it('should return full user profile', async () => {
      userModel.findFullById.mockResolvedValue(fixtures.mockUser);
      const result = await usersService.getMe('user-123');
      expect(result).toEqual(fixtures.mockUser);
      expect(userModel.findFullById).toHaveBeenCalledWith('user-123');
    });

    it('should throw 404 if user not found', async () => {
      userModel.findFullById.mockResolvedValue(null);
      await expect(usersService.getMe('user-999')).rejects.toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  // ========================================
  // getUserById
  // ========================================
  describe('getUserById', () => {
    it('should return public profile if not private', async () => {
      userModel.findPublicById.mockResolvedValue({ ...fixtures.mockPublicUser, is_private: false });
      const result = await usersService.getUserById('user-456', 'user-123');
      expect(result).toBeDefined();
    });

    it('should throw 404 if user not found', async () => {
      userModel.findPublicById.mockResolvedValue(null);
      await expect(usersService.getUserById('user-999', 'user-123')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 403 if profile is private and no requester', async () => {
      userModel.findPublicById.mockResolvedValue({ ...fixtures.mockPublicUser, is_private: true });
      await expect(usersService.getUserById('user-456', null)).rejects.toMatchObject({
        statusCode: 403,
        code: 'RESOURCE_PRIVATE',
      });
    });

    it('should return profile if requester is the owner', async () => {
      userModel.findPublicById.mockResolvedValue({ ...fixtures.mockPublicUser, is_private: true });
      const result = await usersService.getUserById('user-123', 'user-123');
      expect(result).toBeDefined();
    });

    it('should return profile if requester is following the private user', async () => {
      userModel.findPublicById.mockResolvedValue({ ...fixtures.mockPublicUser, is_private: true });
      userModel.isFollowing.mockResolvedValue(true);
      const result = await usersService.getUserById('user-456', 'user-123');
      expect(result).toBeDefined();
    });

    it('should throw 403 if requester is not following private user', async () => {
      userModel.findPublicById.mockResolvedValue({ ...fixtures.mockPublicUser, is_private: true });
      userModel.isFollowing.mockResolvedValue(false);
      await expect(usersService.getUserById('user-456', 'user-123')).rejects.toMatchObject({
        statusCode: 403,
        code: 'RESOURCE_PRIVATE',
      });
    });
  });

  // ========================================
  // getUserTracks
  // ========================================
  describe('getUserTracks', () => {
    it('should return public tracks with default pagination', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, id: VALID_USER_ID });
      trackModel.findPublicTracksByUserId.mockResolvedValue({
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track One',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: VALID_USER_ID,
            play_count: 25,
            like_count: 10,
            stream_url: 'stream-1.mp3',
          },
        ],
        total: 1,
      });

      const result = await usersService.getUserTracks({ userId: VALID_USER_ID });

      expect(userModel.findById).toHaveBeenCalledWith(VALID_USER_ID);
      expect(trackModel.findPublicTracksByUserId).toHaveBeenCalledWith(VALID_USER_ID, {
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual({
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track One',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: VALID_USER_ID,
            play_count: 25,
            like_count: 10,
            stream_url: 'stream-1.mp3',
          },
        ],
        meta: {
          limit: 20,
          offset: 0,
          total: 1,
        },
      });
    });

    it('should return public tracks with custom pagination', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, id: VALID_USER_ID });
      trackModel.findPublicTracksByUserId.mockResolvedValue({
        items: [],
        total: 35,
      });

      const result = await usersService.getUserTracks({
        userId: VALID_USER_ID,
        limit: '10',
        offset: '20',
      });

      expect(trackModel.findPublicTracksByUserId).toHaveBeenCalledWith(VALID_USER_ID, {
        limit: 10,
        offset: 20,
      });
      expect(result).toEqual({
        items: [],
        meta: {
          limit: 10,
          offset: 20,
          total: 35,
        },
      });
    });

    it('should throw 404 if user does not exist', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(usersService.getUserTracks({ userId: VALID_USER_ID })).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });

      expect(trackModel.findPublicTracksByUserId).not.toHaveBeenCalled();
    });

    it('should throw 400 if user_id is not a valid UUID', async () => {
      await expect(usersService.getUserTracks({ userId: 'user-123' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'user_id must be a valid UUID.',
      });

      expect(userModel.findById).not.toHaveBeenCalled();
      expect(trackModel.findPublicTracksByUserId).not.toHaveBeenCalled();
    });

    it('should throw 400 if limit is invalid', async () => {
      await expect(
        usersService.getUserTracks({ userId: VALID_USER_ID, limit: '101' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'limit must be an integer between 1 and 100.',
      });

      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('should throw 400 if offset is invalid', async () => {
      await expect(
        usersService.getUserTracks({ userId: VALID_USER_ID, offset: '-1' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'offset must be an integer greater than or equal to 0.',
      });

      expect(userModel.findById).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // updateMe
  // ========================================
  describe('updateMe', () => {
    it('should update profile with valid fields', async () => {
      userModel.updateProfile.mockResolvedValue({ ...fixtures.mockUser, display_name: 'New Name' });
      const result = await usersService.updateMe('user-123', { display_name: 'New Name' });
      expect(result.display_name).toBe('New Name');
    });

    it('should throw 400 if nothing to update', async () => {
      userModel.updateProfile.mockResolvedValue(null);
      await expect(usersService.updateMe('user-123', {})).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('should normalize username to lowercase', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.updateProfile.mockResolvedValue(fixtures.mockUser);
      await usersService.updateMe('user-123', { username: 'TestUser' });
      expect(userModel.updateProfile).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ username: 'testuser' })
      );
    });

    it('should throw 409 if username already taken by another user', async () => {
      userModel.findByUsername.mockResolvedValue({ id: 'other-user', username: 'takenuser' });
      await expect(
        usersService.updateMe('user-123', { username: 'takenuser' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESOURCE_ALREADY_EXISTS' });
    });

    it('should allow same username if it belongs to the same user', async () => {
      userModel.findByUsername.mockResolvedValue({ id: 'user-123', username: 'testuser' });
      userModel.updateProfile.mockResolvedValue(fixtures.mockUser);
      const result = await usersService.updateMe('user-123', { username: 'testuser' });
      expect(result).toBeDefined();
    });

    it('should throw 400 if username is empty after trim', async () => {
      await expect(usersService.updateMe('user-123', { username: '   ' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });
  });

  // ========================================
  // updateMyAccount
  // ========================================
  describe('updateMyAccount', () => {
    it('should update account with valid fields', async () => {
      userModel.updateAccount.mockResolvedValue({ ...fixtures.mockUser, gender: 'female' });
      const result = await usersService.updateMyAccount('user-123', { gender: 'female' });
      expect(result.gender).toBe('female');
    });

    it('should throw 400 for invalid gender', async () => {
      await expect(
        usersService.updateMyAccount('user-123', { gender: 'invalid' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    });

    it('should throw 400 for invalid date_of_birth format', async () => {
      await expect(
        usersService.updateMyAccount('user-123', { date_of_birth: 'not-a-date' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    });

    it('should throw 400 if user is under 13', async () => {
      const underageDate = new Date();
      underageDate.setFullYear(underageDate.getFullYear() - 10);
      await expect(
        usersService.updateMyAccount('user-123', {
          date_of_birth: underageDate.toISOString().split('T')[0],
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    });

    it('should throw 400 if nothing to update', async () => {
      userModel.updateAccount.mockResolvedValue(null);
      await expect(usersService.updateMyAccount('user-123', {})).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ========================================
  // switchRole
  // ========================================
  describe('switchRole', () => {
    it('should switch role to artist', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, role: 'listener' });
      userModel.updateRole.mockResolvedValue({ ...fixtures.mockUser, role: 'artist' });
      const result = await usersService.switchRole('user-123', 'artist');
      expect(result.role).toBe('artist');
    });

    it('should switch role to listener', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, role: 'artist' });
      userModel.updateRole.mockResolvedValue({ ...fixtures.mockUser, role: 'listener' });
      const result = await usersService.switchRole('user-123', 'listener');
      expect(result.role).toBe('listener');
    });

    it('should throw 400 for invalid role', async () => {
      await expect(usersService.switchRole('user-123', 'admin')).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('should throw 400 for invalid role superadmin', async () => {
      await expect(usersService.switchRole('user-123', 'superadmin')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(usersService.switchRole('user-999', 'artist')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 409 if user already has the role', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, role: 'artist' });
      await expect(usersService.switchRole('user-123', 'artist')).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  // ========================================
  // uploadMyAvatar
  // ========================================
  describe('uploadMyAvatar', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(
        usersService.uploadMyAvatar('user-999', { filename: 'avatar.jpg' })
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(userModel.updateAvatar).not.toHaveBeenCalled();
    });

    it('should upload avatar with CDN URL', async () => {
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updateAvatar.mockResolvedValue({
        ...fixtures.mockUser,
        profile_picture: 'https://cdn.rythmify.com/avatars/user-123.jpg',
      });
      const result = await usersService.uploadMyAvatar('user-123', { filename: 'avatar.jpg' });
      expect(userModel.updateAvatar).toHaveBeenCalledWith(
        'user-123',
        'https://cdn.rythmify.com/avatars/user-123.jpg'
      );
      expect(result.profile_picture).toBe('https://cdn.rythmify.com/avatars/user-123.jpg');
    });
  });

  // ========================================
  // deleteMyAvatar
  // ========================================
  describe('deleteMyAvatar', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(usersService.deleteMyAvatar('user-999')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(userModel.deleteAvatar).not.toHaveBeenCalled();
    });

    it('should throw 404 if user has no avatar', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, profile_picture: null });
      await expect(usersService.deleteMyAvatar('user-123')).rejects.toMatchObject({
        statusCode: 404,
      });
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
  // uploadMyCoverPhoto
  // ========================================
  describe('uploadMyCoverPhoto', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(
        usersService.uploadMyCoverPhoto('user-999', { filename: 'cover.jpg' })
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(userModel.updateCoverPhoto).not.toHaveBeenCalled();
    });

    it('should update cover photo with CDN URL', async () => {
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updateCoverPhoto.mockResolvedValue({
        ...fixtures.mockUser,
        cover_photo: 'https://cdn.rythmify.com/covers/user-123.jpg',
      });
      const result = await usersService.uploadMyCoverPhoto('user-123', { filename: 'cover.jpg' });
      expect(userModel.updateCoverPhoto).toHaveBeenCalledWith(
        'user-123',
        'https://cdn.rythmify.com/covers/user-123.jpg'
      );
      expect(result.cover_photo).toBe('https://cdn.rythmify.com/covers/user-123.jpg');
    });
  });

  // ========================================
  // deleteMyCoverPhoto
  // ========================================
  describe('deleteMyCoverPhoto', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(usersService.deleteMyCoverPhoto('user-999')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(userModel.deleteCoverPhoto).not.toHaveBeenCalled();
    });

    it('should throw 404 if user has no cover photo', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, cover_photo: null });
      await expect(usersService.deleteMyCoverPhoto('user-123')).rejects.toMatchObject({
        statusCode: 404,
      });
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
  // getMyWebProfile
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
  // addWebProfile
  // ========================================
  describe('addWebProfile', () => {
    it('should throw 409 if platform already exists', async () => {
      userModel.findWebProfileByPlatform.mockResolvedValue({
        id: 'profile-1',
        platform: 'Twitter',
      });
      await expect(
        usersService.addWebProfile('user-123', 'Twitter', 'https://twitter.com/newuser')
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESOURCE_ALREADY_EXISTS' });
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
      const result = await usersService.addWebProfile(
        'user-123',
        'LinkedIn',
        'https://linkedin.com/in/user'
      );
      expect(result).toEqual(newProfile);
      expect(userModel.createWebProfile).toHaveBeenCalledWith(
        'user-123',
        'LinkedIn',
        'https://linkedin.com/in/user'
      );
    });
  });

  // ========================================
  // deleteWebProfile
  // ========================================
  describe('deleteWebProfile', () => {
    it('should throw 404 if profile not found', async () => {
      userModel.findWebProfileById.mockResolvedValue(null);
      await expect(usersService.deleteWebProfile('user-123', 'profile-999')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(userModel.deleteWebProfile).not.toHaveBeenCalled();
    });

    it('should throw 403 if user is not profile owner', async () => {
      userModel.findWebProfileById.mockResolvedValue({
        id: 'profile-1',
        user_id: 'different-user',
        platform: 'Twitter',
      });
      await expect(usersService.deleteWebProfile('user-123', 'profile-1')).rejects.toMatchObject({
        statusCode: 403,
        code: 'PERMISSION_DENIED',
      });
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
  });

  // ========================================
  // updatePrivacy
  // ========================================
  describe('updatePrivacy', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(usersService.updatePrivacy('user-999', true)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 400 if already private', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, is_private: true });
      await expect(usersService.updatePrivacy('user-123', true)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('should throw 400 if already public', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, is_private: false });
      await expect(usersService.updatePrivacy('user-123', false)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should update privacy to private', async () => {
      userModel.findById.mockResolvedValue({ ...fixtures.mockUser, is_private: false });
      userModel.updatePrivacy.mockResolvedValue({ is_private: true });
      const result = await usersService.updatePrivacy('user-123', true);
      expect(result.is_private).toBe(true);
    });
  });

  // ========================================
  // getMyGenres
  // ========================================
  describe('getMyGenres', () => {
    it('should return genres for user', async () => {
      const mockGenres = [{ id: 'genre-1', name: 'Rock' }];
      userModel.findGenresByUserId.mockResolvedValue(mockGenres);
      const result = await usersService.getMyGenres('user-123');
      expect(result).toEqual(mockGenres);
      expect(userModel.findGenresByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array if no genres', async () => {
      userModel.findGenresByUserId.mockResolvedValue([]);
      const result = await usersService.getMyGenres('user-123');
      expect(result).toEqual([]);
    });
  });

  // ========================================
  // replaceMyGenres
  // ========================================
  describe('replaceMyGenres', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(usersService.replaceMyGenres('user-999', ['genre-1'])).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should replace genres successfully', async () => {
      const updatedGenres = [{ id: 'genre-1', name: 'Rock' }];
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.replaceGenres.mockResolvedValue(updatedGenres);
      const result = await usersService.replaceMyGenres('user-123', ['genre-1']);
      expect(result).toEqual(updatedGenres);
      expect(userModel.replaceGenres).toHaveBeenCalledWith('user-123', ['genre-1']);
    });
  });

  // ========================================
  // completeOnboarding
  // ========================================
  describe('completeOnboarding', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(
        usersService.completeOnboarding('user-999', { display_name: 'John' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 409 if onboarding already completed', async () => {
      userModel.findById.mockResolvedValue({
        ...fixtures.mockUser,
        display_name: 'John',
        gender: 'male',
        date_of_birth: '1990-01-01',
      });
      await expect(
        usersService.completeOnboarding('user-123', { display_name: 'John' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ONBOARDING_ALREADY_COMPLETED' });
    });

    it('should complete onboarding if not done yet', async () => {
      userModel.findById.mockResolvedValue({
        ...fixtures.mockUser,
        display_name: null,
        gender: null,
        date_of_birth: null,
      });
      userModel.completeOnboarding.mockResolvedValue(fixtures.mockUser);
      const result = await usersService.completeOnboarding('user-123', {
        display_name: 'John',
        gender: 'male',
        date_of_birth: '1990-01-01',
      });
      expect(result).toEqual(fixtures.mockUser);
    });
  });

  // ========================================
  // getMyContentSettings
  // ========================================
  describe('getMyContentSettings', () => {
    it('should return content settings', async () => {
      const mockSettings = { rss_title: 'My Podcast', rss_language: 'en' };
      userModel.findContentSettingsByUserId.mockResolvedValue(mockSettings);
      const result = await usersService.getMyContentSettings('user-123');
      expect(result).toEqual(mockSettings);
      expect(userModel.findContentSettingsByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  // ========================================
  // updateMyContentSettings
  // ========================================
  describe('updateMyContentSettings', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(
        usersService.updateMyContentSettings('user-999', { rss_title: 'Test' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if nothing to update', async () => {
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updateContentSettings.mockResolvedValue(null);
      await expect(usersService.updateMyContentSettings('user-123', {})).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should update content settings successfully', async () => {
      const updatedSettings = { rss_title: 'New Title' };
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updateContentSettings.mockResolvedValue(updatedSettings);
      const result = await usersService.updateMyContentSettings('user-123', {
        rss_title: 'New Title',
      });
      expect(result).toEqual(updatedSettings);
    });
  });

  // ========================================
  // getMyPrivacySettings
  // ========================================
  describe('getMyPrivacySettings', () => {
    it('should return privacy settings', async () => {
      const mockSettings = { receive_messages_from_anyone: true };
      userModel.findPrivacySettingsByUserId.mockResolvedValue(mockSettings);
      const result = await usersService.getMyPrivacySettings('user-123');
      expect(result).toEqual(mockSettings);
      expect(userModel.findPrivacySettingsByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  // ========================================
  // updateMyPrivacySettings
  // ========================================
  describe('updateMyPrivacySettings', () => {
    it('should throw 404 if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(
        usersService.updateMyPrivacySettings('user-999', { receive_messages_from_anyone: true })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if nothing to update', async () => {
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updatePrivacySettings.mockResolvedValue(null);
      await expect(usersService.updateMyPrivacySettings('user-123', {})).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should update privacy settings successfully', async () => {
      const updatedSettings = { receive_messages_from_anyone: false };
      userModel.findById.mockResolvedValue(fixtures.mockUser);
      userModel.updatePrivacySettings.mockResolvedValue(updatedSettings);
      const result = await usersService.updateMyPrivacySettings('user-123', {
        receive_messages_from_anyone: false,
      });
      expect(result).toEqual(updatedSettings);
    });
  });
});
