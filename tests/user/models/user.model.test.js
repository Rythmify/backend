// ============================================================
// tests/user/models/user.model.test.js
// Unit tests for user model layer
// ============================================================

const fixtures = require('../helpers/test-fixtures');

jest.mock('../../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const db = require('../../../src/config/db');
const userModel = require('../../../src/models/user.model');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // findByEmail
  // ========================================
  describe('findByEmail', () => {
    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });

    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findByEmail('test@example.com');
      expect(result).toEqual(fixtures.mockUser);
    });

    it('should query with correct email param', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.findByEmail('test@example.com');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE email = $1'), [
        'test@example.com',
      ]);
    });
  });

  // ========================================
  // findByUsername
  // ========================================
  describe('findByUsername', () => {
    it('should return null if username not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.findByUsername('ghostuser');
      expect(result).toBeNull();
    });

    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findByUsername('testuser');
      expect(result).toEqual(fixtures.mockUser);
    });

    it('should query with LOWER for case-insensitive match', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.findByUsername('TestUser');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(username)'),
        expect.any(Array)
      );
    });
  });

  // ========================================
  // findByEmailOrUsername
  // ========================================
  describe('findByEmailOrUsername', () => {
    it('should return null if no match found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.findByEmailOrUsername('nobody@example.com');
      expect(result).toBeNull();
    });

    it('should return user matched by email', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findByEmailOrUsername('test@example.com');
      expect(result).toEqual(fixtures.mockUser);
    });

    it('should return user matched by username', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findByEmailOrUsername('testuser');
      expect(result).toEqual(fixtures.mockUser);
    });

    it('should query with both email and username conditions', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.findByEmailOrUsername('test@example.com');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('email = $1'),
        expect.any(Array)
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(username)'),
        expect.any(Array)
      );
    });
  });

  // ========================================
  // findById
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

    it('should query by id', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.findById('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['user-123']);
    });
  });

  // ========================================
  // findFullById
  // ========================================
  describe('findFullById', () => {
    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.findFullById('user-999');
      expect(result).toBeNull();
    });

    it('should return full user profile', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findFullById('user-123');
      expect(result).toEqual(fixtures.mockUser);
    });

    it('should include private fields like twofa_enabled', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findFullById('user-123');
      expect(result).toHaveProperty('twofa_enabled');
    });
  });

  // ========================================
  // findPublicById
  // ========================================
  describe('findPublicById', () => {
    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.findPublicById('user-999');
      expect(result).toBeNull();
    });

    it('should return public user profile', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockPublicUser] });
      const result = await userModel.findPublicById('user-123');
      expect(result).toEqual(fixtures.mockPublicUser);
    });
  });

  // ========================================
  // isFollowing
  // ========================================
  describe('isFollowing', () => {
    it('should return false if not following', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.isFollowing('user-123', 'user-456');
      expect(result).toBe(false);
    });

    it('should return true if following', async () => {
      db.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      const result = await userModel.isFollowing('user-123', 'user-456');
      expect(result).toBe(true);
    });

    it('should query follows table with correct params', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.isFollowing('user-123', 'user-456');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM follows'), [
        'user-123',
        'user-456',
      ]);
    });
  });

  // ========================================
  // create
  // ========================================
  describe('create', () => {
    it('should return created user', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.create({
        email: 'test@example.com',
        password_hashed: 'hashed',
        display_name: 'Test User',
        gender: 'male',
        date_of_birth: '1990-01-01',
      });
      expect(result).toEqual(fixtures.mockUser);
    });

    it('should insert into users table', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.create({
        email: 'test@example.com',
        password_hashed: 'hashed',
        display_name: 'Test User',
        gender: 'male',
        date_of_birth: '1990-01-01',
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.any(Array)
      );
    });
  });

  // ========================================
  // markVerified
  // ========================================
  describe('markVerified', () => {
    it('should call query with correct userId', async () => {
      db.query.mockResolvedValue({});
      await userModel.markVerified('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_verified = true'), [
        'user-123',
      ]);
    });
  });

  // ========================================
  // updatePassword
  // ========================================
  describe('updatePassword', () => {
    it('should update password with correct params', async () => {
      db.query.mockResolvedValue({});
      await userModel.updatePassword('user-123', 'newhashed');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('password_hashed = $1'), [
        'newhashed',
        'user-123',
      ]);
    });
  });

  // ========================================
  // updateProfile
  // ========================================
  describe('updateProfile', () => {
    it('should return null if no allowed fields provided', async () => {
      const result = await userModel.updateProfile('user-123', { unknown_field: 'value' });
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should update allowed fields only', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.updateProfile('user-123', {
        display_name: 'New Name',
        bio: 'New bio',
        unknown_field: 'ignored',
      });
      expect(result).toEqual(fixtures.mockUser);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['New Name', 'New bio', 'user-123'])
      );
    });

    it('should not include unknown fields in query', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.updateProfile('user-123', {
        display_name: 'New Name',
        malicious_field: 'DROP TABLE users',
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.not.stringContaining('malicious_field'),
        expect.any(Array)
      );
    });
  });

  // ========================================
  // updateAccount
  // ========================================
  describe('updateAccount', () => {
    it('should return null if no allowed fields provided', async () => {
      const result = await userModel.updateAccount('user-123', { username: 'ignored' });
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should update gender and date_of_birth', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.updateAccount('user-123', {
        gender: 'female',
        date_of_birth: '1995-05-05',
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['female', '1995-05-05', 'user-123'])
      );
    });
  });

  // ========================================
  // updateRole
  // ========================================
  describe('updateRole', () => {
    it('should return updated user with new role', async () => {
      const updatedUser = { ...fixtures.mockUser, role: 'artist' };
      db.query.mockResolvedValue({ rows: [updatedUser] });
      const result = await userModel.updateRole('user-123', 'artist');
      expect(result.role).toBe('artist');
    });

    it('should query with correct role and userId', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.updateRole('user-123', 'artist');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET role = $1'), [
        'artist',
        'user-123',
      ]);
    });
  });

  // ========================================
  // promoteListenerToArtist
  // ========================================
  describe('promoteListenerToArtist', () => {
    it('should promote a listener to artist', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'user-123', role: 'artist' }] });

      const result = await userModel.promoteListenerToArtist('user-123');

      expect(result).toEqual({ id: 'user-123', role: 'artist' });
    });

    it('should only update active listener users', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await userModel.promoteListenerToArtist('user-123');

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("AND role = 'listener'"), [
        'user-123',
      ]);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('AND deleted_at IS NULL'), [
        'user-123',
      ]);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("SET role = 'artist'"), [
        'user-123',
      ]);
    });

    it('should return null when the user is not an active listener', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await userModel.promoteListenerToArtist('user-123');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // updatePrivacy
  // ========================================
  describe('updatePrivacy', () => {
    it('should set is_private to true', async () => {
      db.query.mockResolvedValue({ rows: [{ is_private: true }] });
      const result = await userModel.updatePrivacy('user-123', true);
      expect(result.is_private).toBe(true);
    });

    it('should set is_private to false', async () => {
      db.query.mockResolvedValue({ rows: [{ is_private: false }] });
      const result = await userModel.updatePrivacy('user-123', false);
      expect(result.is_private).toBe(false);
    });

    it('should query with correct params', async () => {
      db.query.mockResolvedValue({ rows: [{ is_private: true }] });
      await userModel.updatePrivacy('user-123', true);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET is_private = $1'), [
        true,
        'user-123',
      ]);
    });
  });

  // ========================================
  // findPrivacySettingsByUserId
  // ========================================
  describe('findPrivacySettingsByUserId', () => {
    it('should return privacy settings when found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockPrivacySettings] });
      const result = await userModel.findPrivacySettingsByUserId('user-123');
      expect(result).toEqual(fixtures.mockPrivacySettings);
    });

    it('should query users and privacy settings', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.findPrivacySettingsByUserId('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WITH user_row AS'), [
        'user-123',
      ]);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN user_privacy_settings'),
        ['user-123']
      );
    });
  });

  // ========================================
  // updatePrivacySettings
  // ========================================
  describe('updatePrivacySettings', () => {
    it('should return null if no allowed fields provided', async () => {
      const result = await userModel.updatePrivacySettings('user-123', { unknown: true });
      expect(result).toBeNull();
      expect(db.connect).not.toHaveBeenCalled();
    });

    it('should update is_private only when provided', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
      client.query
        .mockResolvedValueOnce()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [fixtures.mockPrivacySettings] })
        .mockResolvedValueOnce();

      const result = await userModel.updatePrivacySettings('user-123', { is_private: true });

      expect(db.connect).toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET is_private = $1'),
        [true, 'user-123']
      );
      expect(result).toEqual(fixtures.mockPrivacySettings);
    });
  });

  // ========================================
  // updateAvatar
  // ========================================
  describe('updateAvatar', () => {
    it('should update user avatar', async () => {
      const updatedUser = {
        ...fixtures.mockUser,
        profile_picture: 'https://cdn.example.com/avatar.jpg',
      };
      db.query.mockResolvedValue({ rows: [updatedUser] });
      const result = await userModel.updateAvatar('user-123', 'https://cdn.example.com/avatar.jpg');
      expect(result).toEqual(updatedUser);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET profile_picture'),
        expect.arrayContaining(['https://cdn.example.com/avatar.jpg', 'user-123'])
      );
    });

    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.updateAvatar('user-999', 'https://cdn.example.com/avatar.jpg');
      expect(result).toBeNull();
    });
  });

  // ========================================
  // deleteAvatar
  // ========================================
  describe('deleteAvatar', () => {
    it('should set avatar to null', async () => {
      const updatedUser = { ...fixtures.mockUser, profile_picture: null };
      db.query.mockResolvedValue({ rows: [updatedUser] });
      const result = await userModel.deleteAvatar('user-123');
      expect(result.profile_picture).toBeNull();
    });

    it('should query with correct userId', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.deleteAvatar('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('profile_picture = NULL'), [
        'user-123',
      ]);
    });
  });

  // ========================================
  // updateCoverPhoto
  // ========================================
  describe('updateCoverPhoto', () => {
    it('should update user cover photo', async () => {
      const updatedUser = {
        ...fixtures.mockUser,
        cover_photo: 'https://cdn.example.com/cover.jpg',
      };
      db.query.mockResolvedValue({ rows: [updatedUser] });
      const result = await userModel.updateCoverPhoto(
        'user-123',
        'https://cdn.example.com/cover.jpg'
      );
      expect(result).toEqual(updatedUser);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET cover_photo'),
        expect.arrayContaining(['https://cdn.example.com/cover.jpg', 'user-123'])
      );
    });

    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.updateCoverPhoto(
        'user-999',
        'https://cdn.example.com/cover.jpg'
      );
      expect(result).toBeNull();
    });
  });

  // ========================================
  // deleteCoverPhoto
  // ========================================
  describe('deleteCoverPhoto', () => {
    it('should set cover photo to null', async () => {
      const updatedUser = { ...fixtures.mockUser, cover_photo: null };
      db.query.mockResolvedValue({ rows: [updatedUser] });
      const result = await userModel.deleteCoverPhoto('user-123');
      expect(result.cover_photo).toBeNull();
    });

    it('should query with correct userId', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.deleteCoverPhoto('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('cover_photo = NULL'), [
        'user-123',
      ]);
    });
  });

  // ========================================
  // findWebProfilesByUserId
  // ========================================
  describe('findWebProfilesByUserId', () => {
    it('should return empty array if user has no profiles', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.findWebProfilesByUserId('user-123');
      expect(result).toEqual([]);
    });

    it('should return all web profiles for a user', async () => {
      db.query.mockResolvedValue({ rows: fixtures.mockWebProfiles });
      const result = await userModel.findWebProfilesByUserId('user-123');
      expect(result).toEqual(fixtures.mockWebProfiles);
      expect(result).toHaveLength(2);
    });

    it('should query from web_profiles table', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await userModel.findWebProfilesByUserId('user-123');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM web_profiles'),
        expect.any(Array)
      );
    });
  });

  // ========================================
  // findWebProfileByPlatform
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
  // createWebProfile
  // ========================================
  describe('createWebProfile', () => {
    it('should return null if insert returns no rows', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await userModel.createWebProfile(
        'user-123',
        'Twitter',
        'https://twitter.com/user'
      );
      expect(result).toBeNull();
    });

    it('should return created profile', async () => {
      const createdProfile = {
        id: 'profile-new',
        platform: 'LinkedIn',
        url: 'https://linkedin.com/in/user',
      };
      db.query.mockResolvedValue({ rows: [createdProfile] });
      const result = await userModel.createWebProfile(
        'user-123',
        'LinkedIn',
        'https://linkedin.com/in/user'
      );
      expect(result).toEqual(createdProfile);
    });

    it('should insert with correct values', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockWebProfile] });
      await userModel.createWebProfile('user-123', 'Twitter', 'https://twitter.com/testuser');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO web_profiles'), [
        'user-123',
        'Twitter',
        'https://twitter.com/testuser',
      ]);
    });
  });

  // ========================================
  // findWebProfileById
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
  // deleteWebProfile
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
  // updateLastLogin
  // ========================================
  describe('updateLastLogin', () => {
    it('should update last_login_at for user', async () => {
      db.query.mockResolvedValue({});
      await userModel.updateLastLogin('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('last_login_at = now()'), [
        'user-123',
      ]);
    });
  });

  // ========================================
  // setPendingEmail
  // ========================================
  describe('setPendingEmail', () => {
    it('should set pending_email for user', async () => {
      db.query.mockResolvedValue({});
      await userModel.setPendingEmail('user-123', 'new@example.com');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('pending_email'), [
        'user-123',
        'new@example.com',
      ]);
    });
  });

  // ========================================
  // applyPendingEmail
  // ========================================
  describe('applyPendingEmail', () => {
    it('should apply pending email and return updated email', async () => {
      db.query.mockResolvedValue({ rows: [{ email: 'new@example.com' }] });
      const result = await userModel.applyPendingEmail('user-123');
      expect(result.email).toBe('new@example.com');
    });

    it('should clear pending_email after applying', async () => {
      db.query.mockResolvedValue({ rows: [{ email: 'new@example.com' }] });
      await userModel.applyPendingEmail('user-123');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('pending_email = NULL'), [
        'user-123',
      ]);
    });
  });

  // ========================================
  // replaceGenres
  // ========================================
  describe('replaceGenres', () => {
    it('should delete old genres and insert new ones', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(mockClient);
      jest
        .spyOn(userModel, 'findGenresByUserId')
        .mockResolvedValue([{ id: 'genre-1', name: 'Rock' }]);

      await userModel.replaceGenres('user-123', ['genre-1', 'genre-2']);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_favorite_genres'),
        ['user-123']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({}) // DELETE
          .mockRejectedValueOnce(new Error('DB error')), // INSERT fails
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(mockClient);

      await expect(userModel.replaceGenres('user-123', ['genre-1'])).rejects.toThrow('DB error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ========================================
  // completeOnboarding
  // ========================================
  describe('completeOnboarding', () => {
    it('should return null if no allowed fields provided', async () => {
      const result = await userModel.completeOnboarding('user-123', { unknown: 'value' });
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should update onboarding fields', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.completeOnboarding('user-123', {
        display_name: 'John Doe',
        gender: 'male',
        date_of_birth: '1990-01-01',
      });
      expect(result).toEqual(fixtures.mockUser);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['John Doe', 'male', '1990-01-01', 'user-123'])
      );
    });
  });

  // ========================================
  // findVisibleLikedTracksByUserId
  // ========================================
  describe('findVisibleLikedTracksByUserId', () => {
    it('returns visible liked tracks with full total count', async () => {
      const track = {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Liked Track',
        genre: 'Pop',
        duration: 180,
        cover_image: 'cover.jpg',
        user_id: 'artist-1',
        artist_name: 'Artist',
        play_count: 25,
        like_count: 10,
        comment_count: 7,
        repost_count: 2,
        stream_url: 'stream.mp3',
        audio_url: 'audio.mp3',
        is_liked_by_me: true,
        is_reposted_by_me: false,
        is_artist_followed_by_me: true,
        liked_at: '2026-04-24T12:00:00.000Z',
      };
      db.query
        .mockResolvedValueOnce({ rows: [track] })
        .mockResolvedValueOnce({ rows: [{ total: 45 }] });

      const result = await userModel.findVisibleLikedTracksByUserId({
        targetUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        requesterUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual({ items: [track], total: 45 });
      expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM track_likes tl'), [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        20,
        0,
      ]);
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('COUNT(DISTINCT tl.track_id)::int AS total'),
        ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
      );
    });

    it('filters out tracks that are not publicly visible', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] });

      await userModel.findVisibleLikedTracksByUserId({
        targetUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        requesterUserId: null,
        limit: 10,
        offset: 5,
      });

      const itemsSql = db.query.mock.calls[0][0];
      const countSql = db.query.mock.calls[1][0];

      for (const sql of [itemsSql, countSql]) {
        expect(sql).toContain('t.deleted_at IS NULL');
        expect(sql).toContain('t.is_hidden = false');
        expect(sql).toContain('t.is_public = true');
        expect(sql).toContain("t.status = 'ready'");
        expect(sql).toContain('u.deleted_at IS NULL');
      }
      expect(itemsSql).toContain('ORDER BY tl.created_at DESC');
    });
  });

  // ========================================
  // createOAuthUser
  // ========================================
  describe('createOAuthUser', () => {
    it('should create user with is_verified true', async () => {
      db.query.mockResolvedValue({ rows: [{ ...fixtures.mockUser, is_verified: true }] });
      const result = await userModel.createOAuthUser({
        email: 'oauth@example.com',
        display_name: 'OAuth User',
      });
      expect(result.is_verified).toBe(true);
    });

    it('should insert into users with correct params', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      await userModel.createOAuthUser({ email: 'oauth@example.com', display_name: 'OAuth User' });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), [
        'oauth@example.com',
        'OAuth User',
      ]);
    });
  });
});
