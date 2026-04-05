// ============================================================
// tests/user/controllers/users.controller.test.js
// Unit tests for users controller layer (HTTP handlers)
// ============================================================

const fixtures = require('../helpers/test-fixtures');

jest.mock('../../../src/services/users.service', () => ({
  getMe: jest.fn(),
  getUserById: jest.fn(),
  getUserTracks: jest.fn(),
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
  getMyContentSettings: jest.fn(),
  updateMyContentSettings: jest.fn(),
  getMyPrivacySettings: jest.fn(),
  updateMyPrivacySettings: jest.fn(),
}));

const usersService = require('../../../src/services/users.service');
const usersController = require('../../../src/controllers/users.controller');

const createMocks = (overrides = {}) => {
  const req = {
    user: { sub: 'user-123' },
    body: {},
    params: {},
    file: null,
    ...overrides,
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
  // getMe
  // ========================================
  describe('getMe', () => {
    it('should return 200 with user profile', async () => {
      const { req, res } = createMocks();
      usersService.getMe.mockResolvedValue(fixtures.mockUser);

      await usersController.getMe(req, res);

      expect(usersService.getMe).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockUser,
        message: 'Own profile returned successfully.',
      });
    });

    it('should propagate service errors', async () => {
      const { req, res } = createMocks();
      const error = Object.assign(new Error('User not found'), { statusCode: 404 });
      usersService.getMe.mockRejectedValue(error);

      await expect(usersController.getMe(req, res)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ========================================
  // getUserById
  // ========================================
  describe('getUserById', () => {
    it('should return 200 with public profile', async () => {
      const { req, res } = createMocks({ params: { user_id: 'user-456' } });
      usersService.getUserById.mockResolvedValue(fixtures.mockPublicUser);

      await usersController.getUserById(req, res);

      expect(usersService.getUserById).toHaveBeenCalledWith('user-456', 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockPublicUser,
        message: 'User profile returned successfully.',
      });
    });

    it('should propagate 404 if user not found', async () => {
      const { req, res } = createMocks({ params: { user_id: 'user-999' } });
      const error = Object.assign(new Error('User not found'), { statusCode: 404 });
      usersService.getUserById.mockRejectedValue(error);

      await expect(usersController.getUserById(req, res)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should propagate 403 for private profile', async () => {
      const { req, res } = createMocks({ params: { user_id: 'user-456' } });
      const error = Object.assign(new Error('Private'), { statusCode: 403 });
      usersService.getUserById.mockRejectedValue(error);

      await expect(usersController.getUserById(req, res)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ========================================
  // getUserTracks
  // ========================================
  describe('getUserTracks', () => {
    it('should return 200 with public user tracks and pagination meta', async () => {
      const payload = {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Track One',
            genre: 'Pop',
            duration: 180,
            cover_image: 'cover-1.jpg',
            user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
      };
      const { req, res } = createMocks({
        params: { user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        query: { limit: '20', offset: '0' },
      });
      usersService.getUserTracks.mockResolvedValue(payload);

      await usersController.getUserTracks(req, res);

      expect(usersService.getUserTracks).toHaveBeenCalledWith({
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        limit: '20',
        offset: '0',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: payload,
        message: 'User tracks fetched successfully',
      });
    });

    it('should propagate service errors', async () => {
      const { req, res } = createMocks({
        params: { user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        query: {},
      });
      const error = Object.assign(new Error('User not found'), { statusCode: 404 });
      usersService.getUserTracks.mockRejectedValue(error);

      await expect(usersController.getUserTracks(req, res)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ========================================
  // updateMe
  // ========================================
  describe('updateMe', () => {
    it('should update profile with valid data', async () => {
      const { req, res } = createMocks({ body: { display_name: 'New Name', bio: 'New bio' } });
      usersService.updateMe.mockResolvedValue({ ...fixtures.mockUser, display_name: 'New Name' });

      await usersController.updateMe(req, res);

      expect(usersService.updateMe).toHaveBeenCalledWith('user-123', {
        display_name: 'New Name',
        bio: 'New bio',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should update only provided fields', async () => {
      const { req, res } = createMocks({ body: { username: 'newusername' } });
      usersService.updateMe.mockResolvedValue(fixtures.mockUser);

      await usersController.updateMe(req, res);

      expect(usersService.updateMe).toHaveBeenCalledWith('user-123', { username: 'newusername' });
    });

    it('should ignore undefined fields', async () => {
      const { req, res } = createMocks({ body: { display_name: 'New Name' } });
      usersService.updateMe.mockResolvedValue(fixtures.mockUser);

      await usersController.updateMe(req, res);

      const calledWith = usersService.updateMe.mock.calls[0][1];
      expect(calledWith).not.toHaveProperty('bio');
      expect(calledWith).not.toHaveProperty('username');
    });

    it('should propagate service errors', async () => {
      const { req, res } = createMocks({ body: { display_name: 'New Name' } });
      const error = Object.assign(new Error('Validation failed'), { statusCode: 400 });
      usersService.updateMe.mockRejectedValue(error);

      await expect(usersController.updateMe(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ========================================
  // updateMyAccount
  // ========================================
  describe('updateMyAccount', () => {
    it('should update account with date_of_birth and gender', async () => {
      const { req, res } = createMocks({ body: { date_of_birth: '1990-01-01', gender: 'female' } });
      usersService.updateMyAccount.mockResolvedValue({ ...fixtures.mockUser, gender: 'female' });

      await usersController.updateMyAccount(req, res);

      expect(usersService.updateMyAccount).toHaveBeenCalledWith('user-123', {
        date_of_birth: '1990-01-01',
        gender: 'female',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should update only provided account fields', async () => {
      const { req, res } = createMocks({ body: { gender: 'male' } });
      usersService.updateMyAccount.mockResolvedValue(fixtures.mockUser);

      await usersController.updateMyAccount(req, res);

      expect(usersService.updateMyAccount).toHaveBeenCalledWith('user-123', { gender: 'male' });
    });
  });

  // ========================================
  // switchRole
  // ========================================
  describe('switchRole', () => {
    it('should switch user role', async () => {
      const { req, res } = createMocks({ body: { role: 'artist' } });
      usersService.switchRole.mockResolvedValue({ ...fixtures.mockUser, role: 'artist' });

      await usersController.switchRole(req, res);

      expect(usersService.switchRole).toHaveBeenCalledWith('user-123', 'artist');
      expect(res.json).toHaveBeenCalled();
    });

    it('should propagate 400 for invalid role', async () => {
      const { req, res } = createMocks({ body: { role: 'admin' } });
      const error = Object.assign(new Error('Invalid role'), { statusCode: 400 });
      usersService.switchRole.mockRejectedValue(error);

      await expect(usersController.switchRole(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should propagate 409 if already has role', async () => {
      const { req, res } = createMocks({ body: { role: 'listener' } });
      const error = Object.assign(new Error('Already has role'), { statusCode: 409 });
      usersService.switchRole.mockRejectedValue(error);

      await expect(usersController.switchRole(req, res)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ========================================
  // uploadMyAvatar
  // ========================================
  describe('uploadMyAvatar', () => {
    it('should throw 400 if no file provided', async () => {
      const { req, res } = createMocks({ file: null });

      await expect(usersController.uploadMyAvatar(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('No image file provided'),
      });
    });

    it('should upload avatar if file provided', async () => {
      const { req, res } = createMocks({ file: { filename: 'avatar.jpg' } });
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
  // uploadMyCoverPhoto
  // ========================================
  describe('uploadMyCoverPhoto', () => {
    it('should throw 400 if no file provided', async () => {
      const { req, res } = createMocks({ file: null });

      await expect(usersController.uploadMyCoverPhoto(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('No image file provided'),
      });
    });

    it('should upload cover photo if file provided', async () => {
      const { req, res } = createMocks({ file: { filename: 'cover.jpg' } });
      usersService.uploadMyCoverPhoto.mockResolvedValue({
        ...fixtures.mockUser,
        cover_photo: 'https://cdn.rythmify.com/covers/user-123.jpg',
      });

      await usersController.uploadMyCoverPhoto(req, res);

      expect(usersService.uploadMyCoverPhoto).toHaveBeenCalledWith('user-123', req.file);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ========================================
  // deleteMyAvatar
  // ========================================
  describe('deleteMyAvatar', () => {
    it('should call service with user id', async () => {
      const { req, res } = createMocks();
      usersService.deleteMyAvatar.mockResolvedValue({ profile_picture: null });

      await usersController.deleteMyAvatar(req, res);

      expect(usersService.deleteMyAvatar).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalled();
    });

    it('should propagate 404 if no avatar', async () => {
      const { req, res } = createMocks();
      const error = Object.assign(new Error('No avatar to delete'), { statusCode: 404 });
      usersService.deleteMyAvatar.mockRejectedValue(error);

      await expect(usersController.deleteMyAvatar(req, res)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ========================================
  // deleteMyCoverPhoto
  // ========================================
  describe('deleteMyCoverPhoto', () => {
    it('should call service with user id', async () => {
      const { req, res } = createMocks();
      usersService.deleteMyCoverPhoto.mockResolvedValue({ cover_photo: null });

      await usersController.deleteMyCoverPhoto(req, res);

      expect(usersService.deleteMyCoverPhoto).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalled();
    });

    it('should propagate 404 if no cover photo', async () => {
      const { req, res } = createMocks();
      const error = Object.assign(new Error('No cover photo to delete'), { statusCode: 404 });
      usersService.deleteMyCoverPhoto.mockRejectedValue(error);

      await expect(usersController.deleteMyCoverPhoto(req, res)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ========================================
  // getMyWebProfile
  // ========================================
  describe('getMyWebProfile', () => {
    it('should return 200 with web profiles', async () => {
      const { req, res } = createMocks();
      usersService.getMyWebProfile.mockResolvedValue(fixtures.mockWebProfiles);

      await usersController.getMyWebProfile(req, res);

      expect(usersService.getMyWebProfile).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockWebProfiles,
        message: 'Web profiles returned successfully.',
      });
    });

    it('should return empty array if no profiles', async () => {
      const { req, res } = createMocks();
      usersService.getMyWebProfile.mockResolvedValue([]);

      await usersController.getMyWebProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [],
        message: 'Web profiles returned successfully.',
      });
    });
  });

  // ========================================
  // addWebProfile
  // ========================================
  describe('addWebProfile', () => {
    it('should create profile with valid data', async () => {
      const { req, res } = createMocks({ body: { platform: 'Twitter', url: 'https://twitter.com/user' } });
      usersService.addWebProfile.mockResolvedValue(fixtures.mockWebProfile);

      await usersController.addWebProfile(req, res);

      expect(usersService.addWebProfile).toHaveBeenCalledWith('user-123', 'Twitter', 'https://twitter.com/user');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        data: fixtures.mockWebProfile,
        message: 'Web profile link created.',
      });
    });

    it('should propagate 409 conflict error', async () => {
      const { req, res } = createMocks({ body: { platform: 'Twitter', url: 'https://twitter.com/user' } });
      const error = Object.assign(new Error('Already exists'), { statusCode: 409 });
      usersService.addWebProfile.mockRejectedValue(error);

      await expect(usersController.addWebProfile(req, res)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ========================================
  // deleteWebProfile
  // ========================================
  describe('deleteWebProfile', () => {
    it('should delete profile with correct profile_id', async () => {
      const { req, res } = createMocks({ params: { profile_id: 'profile-1' } });
      usersService.deleteWebProfile.mockResolvedValue({ id: 'profile-1' });

      await usersController.deleteWebProfile(req, res);

      expect(usersService.deleteWebProfile).toHaveBeenCalledWith('user-123', 'profile-1');
      expect(res.json).toHaveBeenCalled();
    });

    it('should propagate 404 if profile not found', async () => {
      const { req, res } = createMocks({ params: { profile_id: 'profile-999' } });
      const error = Object.assign(new Error('Not found'), { statusCode: 404 });
      usersService.deleteWebProfile.mockRejectedValue(error);

      await expect(usersController.deleteWebProfile(req, res)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should propagate 403 permission denied', async () => {
      const { req, res } = createMocks({ params: { profile_id: 'profile-1' } });
      const error = Object.assign(new Error('Forbidden'), { statusCode: 403 });
      usersService.deleteWebProfile.mockRejectedValue(error);

      await expect(usersController.deleteWebProfile(req, res)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ========================================
  // updatePrivacy
  // ========================================
  describe('updatePrivacy', () => {
    it('should throw 400 if is_private is missing', async () => {
      const { req, res } = createMocks({ body: {} });

      await expect(usersController.updatePrivacy(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('is_private field is required'),
      });
    });

    it('should set profile to private', async () => {
      const { req, res } = createMocks({ body: { is_private: true } });
      usersService.updatePrivacy.mockResolvedValue({ ...fixtures.mockUser, is_private: true });

      await usersController.updatePrivacy(req, res);

      expect(usersService.updatePrivacy).toHaveBeenCalledWith('user-123', true);
      expect(res.json).toHaveBeenCalled();
    });

    it('should set profile to public', async () => {
      const { req, res } = createMocks({ body: { is_private: false } });
      usersService.updatePrivacy.mockResolvedValue({ ...fixtures.mockUser, is_private: false });

      await usersController.updatePrivacy(req, res);

      expect(usersService.updatePrivacy).toHaveBeenCalledWith('user-123', false);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ========================================
  // getMyGenres
  // ========================================
  describe('getMyGenres', () => {
    it('should return favorite genres', async () => {
      const { req, res } = createMocks();
      const mockGenres = [{ id: 'genre-1', name: 'Rock' }];
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
      usersService.getMyGenres.mockResolvedValue([]);

      await usersController.getMyGenres(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [],
        message: 'Favorite genres returned successfully.',
      });
    });
  });

  // ========================================
  // replaceMyGenres
  // ========================================
  describe('replaceMyGenres', () => {
    it('should throw 400 if genres is not an array', async () => {
      const { req, res } = createMocks({ body: { genres: 'Rock' } });

      await expect(usersController.replaceMyGenres(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('genres must be an array'),
      });
    });

    it('should throw 400 if genres exceeds 10 items', async () => {
      const { req, res } = createMocks({ body: { genres: Array(11).fill('genre-1') } });

      await expect(usersController.replaceMyGenres(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Maximum of 10 genres allowed'),
      });
    });

    it('should update genres with valid data', async () => {
      const genres = ['genre-1', 'genre-2'];
      const { req, res } = createMocks({ body: { genres } });
      usersService.replaceMyGenres.mockResolvedValue(genres);

      await usersController.replaceMyGenres(req, res);

      expect(usersService.replaceMyGenres).toHaveBeenCalledWith('user-123', genres);
      expect(res.json).toHaveBeenCalled();
    });

    it('should allow empty genres array', async () => {
      const { req, res } = createMocks({ body: { genres: [] } });
      usersService.replaceMyGenres.mockResolvedValue([]);

      await usersController.replaceMyGenres(req, res);

      expect(usersService.replaceMyGenres).toHaveBeenCalledWith('user-123', []);
    });
  });

  // ========================================
  // completeOnboarding
  // ========================================
  describe('completeOnboarding', () => {
    it('should complete onboarding with all fields', async () => {
      const body = {
        display_name: 'John Doe',
        gender: 'male',
        date_of_birth: '1990-01-01',
        bio: 'Music lover',
        city: 'New York',
        country: 'US',
      };
      const { req, res } = createMocks({ body });
      usersService.completeOnboarding.mockResolvedValue({ ...fixtures.mockUser, ...body });

      await usersController.completeOnboarding(req, res);

      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-123', body);
      expect(res.json).toHaveBeenCalled();
    });

    it('should complete onboarding with partial fields', async () => {
      const { req, res } = createMocks({ body: { display_name: 'Jane Doe', bio: 'Artist' } });
      usersService.completeOnboarding.mockResolvedValue(fixtures.mockUser);

      await usersController.completeOnboarding(req, res);

      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-123', {
        display_name: 'Jane Doe',
        bio: 'Artist',
      });
    });

    it('should handle empty body', async () => {
      const { req, res } = createMocks({ body: {} });
      usersService.completeOnboarding.mockResolvedValue(fixtures.mockUser);

      await usersController.completeOnboarding(req, res);

      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-123', {});
      expect(res.json).toHaveBeenCalled();
    });

    it('should propagate 409 if already completed', async () => {
      const { req, res } = createMocks({ body: { display_name: 'John' } });
      const error = Object.assign(new Error('Already completed'), { statusCode: 409 });
      usersService.completeOnboarding.mockRejectedValue(error);

      await expect(usersController.completeOnboarding(req, res)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ========================================
  // getMyContentSettings
  // ========================================
  describe('getMyContentSettings', () => {
    it('should return content settings', async () => {
      const { req, res } = createMocks();
      const mockSettings = { rss_title: 'My Podcast', rss_language: 'en' };
      usersService.getMyContentSettings.mockResolvedValue(mockSettings);

      await usersController.getMyContentSettings(req, res);

      expect(usersService.getMyContentSettings).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        data: mockSettings,
        message: 'Content settings returned successfully.',
      });
    });
  });

  // ========================================
  // updateMyContentSettings
  // ========================================
  describe('updateMyContentSettings', () => {
    it('should update content settings', async () => {
      const { req, res } = createMocks({ body: { rss_title: 'New Title', rss_language: 'ar' } });
      const updatedSettings = { rss_title: 'New Title', rss_language: 'ar' };
      usersService.updateMyContentSettings.mockResolvedValue(updatedSettings);

      await usersController.updateMyContentSettings(req, res);

      expect(usersService.updateMyContentSettings).toHaveBeenCalledWith('user-123', {
        rss_title: 'New Title',
        rss_language: 'ar',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should ignore undefined fields', async () => {
      const { req, res } = createMocks({ body: { rss_title: 'Title' } });
      usersService.updateMyContentSettings.mockResolvedValue({ rss_title: 'Title' });

      await usersController.updateMyContentSettings(req, res);

      const calledWith = usersService.updateMyContentSettings.mock.calls[0][1];
      expect(calledWith).not.toHaveProperty('rss_language');
    });
  });

  // ========================================
  // getMyPrivacySettings
  // ========================================
  describe('getMyPrivacySettings', () => {
    it('should return privacy settings', async () => {
      const { req, res } = createMocks();
      const mockSettings = { receive_messages_from_anyone: true, show_as_top_fan: false };
      usersService.getMyPrivacySettings.mockResolvedValue(mockSettings);

      await usersController.getMyPrivacySettings(req, res);

      expect(usersService.getMyPrivacySettings).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        data: mockSettings,
        message: 'Privacy settings returned successfully.',
      });
    });
  });

  // ========================================
  // updateMyPrivacySettings
  // ========================================
  describe('updateMyPrivacySettings', () => {
    it('should update privacy settings', async () => {
      const { req, res } = createMocks({
        body: { receive_messages_from_anyone: false, show_as_top_fan: true },
      });
      const updated = { receive_messages_from_anyone: false, show_as_top_fan: true };
      usersService.updateMyPrivacySettings.mockResolvedValue(updated);

      await usersController.updateMyPrivacySettings(req, res);

      expect(usersService.updateMyPrivacySettings).toHaveBeenCalledWith('user-123', {
        receive_messages_from_anyone: false,
        show_as_top_fan: true,
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should ignore undefined fields', async () => {
      const { req, res } = createMocks({ body: { show_as_top_fan: true } });
      usersService.updateMyPrivacySettings.mockResolvedValue({ show_as_top_fan: true });

      await usersController.updateMyPrivacySettings(req, res);

      const calledWith = usersService.updateMyPrivacySettings.mock.calls[0][1];
      expect(calledWith).not.toHaveProperty('receive_messages_from_anyone');
    });
  });
});
