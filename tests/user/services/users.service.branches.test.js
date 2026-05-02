// ============================================================
// tests/user/services/users.service.branches.test.js
// Coverage Target: 100% (Focus on missed branches)
// ============================================================

const usersService = require('../../../src/services/users.service');
const userModel = require('../../../src/models/user.model');
const storageService = require('../../../src/services/storage.service');

jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/storage.service');
jest.mock('../../../src/services/subscriptions.service', () => ({
  refreshUserSubscription: jest.fn().mockResolvedValue(true)
}));

describe('Users Service - Branch Coverage Expansion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Avatar/Cover Deletion Branches', () => {
    it('deletePreviousAvatarIfReplaced returns if URLs match', async () => {
        const mockUser = { id: 'u1', profile_picture: 'http://old.com' };
        userModel.findById.mockResolvedValue(mockUser);
        storageService.uploadImage.mockResolvedValue({ url: 'http://old.com' });
        userModel.updateAvatar.mockResolvedValue({ profile_picture: 'http://old.com' });
        
        await usersService.uploadMyAvatar('u1', { originalname: 'a.jpg' });
        expect(storageService.deleteAllVersionsByUrl).not.toHaveBeenCalled();
    });

    it('deletePreviousCoverPhotoIfReplaced returns if URLs match', async () => {
        const mockUser = { id: 'u1', cover_photo: 'http://old.com' };
        userModel.findById.mockResolvedValue(mockUser);
        storageService.uploadImage.mockResolvedValue({ url: 'http://old.com' });
        userModel.updateCoverPhoto.mockResolvedValue({ cover_photo: 'http://old.com' });
        
        await usersService.uploadMyCoverPhoto('u1', { originalname: 'a.jpg' });
        expect(storageService.deleteAllVersionsByUrl).not.toHaveBeenCalled();
    });
  });

  describe('Update Failures (Nothing to update)', () => {
    it('updateMe throws if model returns null', async () => {
        userModel.findByUsername.mockResolvedValue(null);
        userModel.updateProfile.mockResolvedValue(null);
        await expect(usersService.updateMe('u1', { username: 'new' }))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'Nothing to update' });
    });

    it('updateMyAccount throws if model returns null', async () => {
        userModel.updateAccount.mockResolvedValue(null);
        await expect(usersService.updateMyAccount('u1', { gender: 'male' }))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'Nothing to update' });
    });

    it('updateMyContentSettings throws if model returns null', async () => {
        userModel.findById.mockResolvedValue({ id: 'u1' });
        userModel.updateContentSettings.mockResolvedValue(null);
        await expect(usersService.updateMyContentSettings('u1', {}))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'Nothing to update' });
    });

    it('updateMyPrivacySettings throws if model returns null', async () => {
        userModel.findById.mockResolvedValue({ id: 'u1' });
        userModel.updatePrivacySettings.mockResolvedValue(null);
        await expect(usersService.updateMyPrivacySettings('u1', {}))
            .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'Nothing to update' });
    });
  });

  describe('Upload Failures', () => {
    it('uploadMyAvatar throws if updatedUser is null', async () => {
        userModel.findById.mockResolvedValue({ id: 'u1' });
        storageService.uploadImage.mockResolvedValue({ url: 'http://new.com' });
        userModel.updateAvatar.mockResolvedValue(null);
        
        await expect(usersService.uploadMyAvatar('u1', { originalname: 'a.jpg' }))
            .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
    });

    it('uploadMyCoverPhoto throws if updatedUser is null', async () => {
        userModel.findById.mockResolvedValue({ id: 'u1' });
        storageService.uploadImage.mockResolvedValue({ url: 'http://new.com' });
        userModel.updateCoverPhoto.mockResolvedValue(null);
        
        await expect(usersService.uploadMyCoverPhoto('u1', { originalname: 'a.jpg' }))
            .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
    });
  });
});
