// ============================================================
// tests/user/models/user.model.test.js
// Unit tests for user model layer
// ============================================================

const fixtures = require('../helpers/test-fixtures');

// Mock db before importing model
jest.mock('../../../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../../../src/config/db');
const userModel = require('../../../src/models/user.model');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // findWebProfilesByUserId tests
  // ========================================
  describe('findWebProfilesByUserId', () => {
    it('should return empty array if user has no profiles', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.findWebProfilesByUserId('user-123');

      expect(result).toEqual([]);
      expect(db.query).toHaveBeenCalledWith(
       expect.stringContaining('FROM web_profiles')
      );
    });

    it('should return all web profiles for a user', async () => {
      db.query.mockResolvedValue({ rows: fixtures.mockWebProfiles });

      const result = await userModel.findWebProfilesByUserId('user-123');

      expect(result).toEqual(fixtures.mockWebProfiles);
      expect(result).toHaveLength(2);
    });
  });

  // ========================================
  // findWebProfileByPlatform tests
  // ========================================
  describe('findWebProfileByPlatform', () => {
    it('should return null if platform does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.findWebProfileByPlatform('user-123', 'Twitter');

      expect(result).toBeNull();
    });

    it('should return profile if platform exists', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'profile-1' }] });

      const result = await userModel.findWebProfileByPlatform('user-123', 'Twitter');

      expect(result).toEqual({ id: 'profile-1' });
    });

    it('should query with correct SQL and params', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await userModel.findWebProfileByPlatform('user-123', 'Twitter');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND platform = $2'),
        ['user-123', 'Twitter']
      );
    });
  });

  // ========================================
  // createWebProfile tests
  // ========================================
  describe('createWebProfile', () => {
    it('should return null if insert returns no rows', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.createWebProfile('user-123', 'Twitter', 'https://twitter.com/user');

      expect(result).toBeNull();
    });

    it('should return created profile', async () => {
      const createdProfile = {
        id: 'profile-new',
        platform: 'LinkedIn',
        url: 'https://linkedin.com/in/user',
      };
      db.query.mockResolvedValue({ rows: [createdProfile] });

      const result = await userModel.createWebProfile('user-123', 'LinkedIn', 'https://linkedin.com/in/user');

      expect(result).toEqual(createdProfile);
    });

    it('should insert with correct values', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockWebProfile] });

      await userModel.createWebProfile('user-123', 'Twitter', 'https://twitter.com/testuser');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO web_profiles'),
        ['user-123', 'Twitter', 'https://twitter.com/testuser']
      );
    });
  });

  // ========================================
  // findWebProfileById tests
  // ========================================
  describe('findWebProfileById', () => {
    it('should return null if profile not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.findWebProfileById('profile-999');

      expect(result).toBeNull();
    });

    it('should return profile with user_id', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockWebProfile] });

      const result = await userModel.findWebProfileById('profile-1');

      expect(result).toEqual(fixtures.mockWebProfile);
      expect(result.user_id).toBe('user-123');
    });
  });

  // ========================================
  // deleteWebProfile tests
  // ========================================
  describe('deleteWebProfile', () => {
    it('should return null if profile not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.deleteWebProfile('profile-999');

      expect(result).toBeNull();
    });

    it('should return deleted profile id', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'profile-1' }] });

      const result = await userModel.deleteWebProfile('profile-1');

      expect(result).toEqual({ id: 'profile-1' });
    });

    it('should delete profile by id', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'profile-1' }] });

      await userModel.deleteWebProfile('profile-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM web_profiles WHERE id = $1'),
        ['profile-1']
      );
    });
  });

  // ========================================
  // findById tests
  // ========================================
  describe('findById', () => {
    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.findById('user-999');

      expect(result).toBeNull();
    });

    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });

      const result = await userModel.findById('user-123');

      expect(result).toEqual(fixtures.mockUser);
      expect(result.id).toBe('user-123');
    });
  });

  // ========================================
  // updateAvatar tests
  // ========================================
  describe('updateAvatar', () => {
    it('should update user avatar', async () => {
      const updatedUser = { ...fixtures.mockUser, profile_picture: 'https://cdn.example.com/avatar.jpg' };
      db.query.mockResolvedValue({ rows: [updatedUser] });

      const result = await userModel.updateAvatar('user-123', 'https://cdn.example.com/avatar.jpg');

      expect(result).toEqual(updatedUser);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET profile_picture'),
        expect.arrayContaining(['https://cdn.example.com/avatar.jpg', 'user-123'])
      );
    });
  });

  // ========================================
  // deleteAvatar tests
  // ========================================
  describe('deleteAvatar', () => {
    it('should set avatar to null', async () => {
      const updatedUser = { ...fixtures.mockUser, profile_picture: null };
      db.query.mockResolvedValue({ rows: [updatedUser] });

      const result = await userModel.deleteAvatar('user-123');

      expect(result.profile_picture).toBeNull();
    });
  });

  // ========================================
  // updateCoverPhoto tests
  // ========================================
  describe('updateCoverPhoto', () => {
    it('should update user cover photo', async () => {
      const updatedUser = { ...fixtures.mockUser, cover_photo: 'https://cdn.example.com/cover.jpg' };
      db.query.mockResolvedValue({ rows: [updatedUser] });

      const result = await userModel.updateCoverPhoto('user-123', 'https://cdn.example.com/cover.jpg');

      expect(result).toEqual(updatedUser);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET cover_photo'),
        expect.arrayContaining(['https://cdn.example.com/cover.jpg', 'user-123'])
      );
    });
  });

  // ========================================
  // deleteCoverPhoto tests
  // ========================================
  describe('deleteCoverPhoto', () => {
    it('should set cover photo to null', async () => {
      const updatedUser = { ...fixtures.mockUser, cover_photo: null };
      db.query.mockResolvedValue({ rows: [updatedUser] });

      const result = await userModel.deleteCoverPhoto('user-123');

      expect(result.cover_photo).toBeNull();
    });
  });
});
