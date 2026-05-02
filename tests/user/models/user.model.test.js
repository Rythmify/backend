// ============================================================
// tests/user/models/user.model.test.js
// Unit tests for user model layer
// Coverage Target: 100%
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
  // Basic Queries
  // ========================================
  describe('findByEmail', () => {
    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      const result = await userModel.findByEmail('test@example.com');
      expect(result).toEqual(fixtures.mockUser);
    });
    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findByEmail('x')).toBeNull();
    });
  });

  describe('isUsernameTaken', () => {
    it('should return true if taken', async () => {
      db.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      expect(await userModel.isUsernameTaken('u')).toBe(true);
    });
    it('should return false if free', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.isUsernameTaken('u')).toBe(false);
    });
  });

  describe('findByUsername', () => {
    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      expect(await userModel.findByUsername('u')).toEqual(fixtures.mockUser);
    });
    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findByUsername('u')).toBeNull();
    });
  });

  describe('findByEmailOrUsername', () => {
    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      expect(await userModel.findByEmailOrUsername('i')).toEqual(fixtures.mockUser);
    });
    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findByEmailOrUsername('i')).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      db.query.mockResolvedValue({ rows: [fixtures.mockUser] });
      expect(await userModel.findById('u1')).toEqual(fixtures.mockUser);
    });
    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findById('u1')).toBeNull();
    });
  });

  // ========================================
  // Mutations
  // ========================================
  describe('Mutations', () => {
    it('create returns row', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.create({ email: 'e' })).toEqual({ id: 'u1' });
    });

    it('markVerified calls query', async () => {
      db.query.mockResolvedValue({});
      await userModel.markVerified('u1');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_verified = true'), ['u1']);
    });

    it('updateLastLogin calls query', async () => {
      db.query.mockResolvedValue({});
      await userModel.updateLastLogin('u1');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('last_login_at'), ['u1']);
    });

    it('updatePassword calls query', async () => {
      db.query.mockResolvedValue({});
      await userModel.updatePassword('u1', 'h');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('password_hashed'), ['h', 'u1']);
    });
  });

  // ========================================
  // Profile & Account Updates
  // ========================================
  describe('Updates', () => {
    it('findFullById returns row', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.findFullById('u1')).toEqual({ id: 'u1' });
    });
    it('findFullById returns null if missing', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findFullById('u1')).toBeNull();
    });

    it('findPublicById returns row', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.findPublicById('u1')).toEqual({ id: 'u1' });
    });
    it('findPublicById returns null if missing', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findPublicById('u1')).toBeNull();
    });

    it('isFollowing returns true/false', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.isFollowing('u1', 'u2')).toBe(true);
      expect(await userModel.isFollowing('u1', 'u2')).toBe(false);
    });

    it('updateProfile handles empty fields', async () => {
      expect(await userModel.updateProfile('u1', {})).toBeNull();
    });
    it('updateProfile returns row', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.updateProfile('u1', { display_name: 'n' })).toEqual({ id: 'u1' });
    });
    it('updateProfile returns null if missing', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.updateProfile('u1', { display_name: 'n' })).toBeNull();
    });

    it('updateAccount handles empty fields', async () => {
      expect(await userModel.updateAccount('u1', {})).toBeNull();
    });
    it('updateAccount returns row', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.updateAccount('u1', { gender: 'm' })).toEqual({ id: 'u1' });
    });
    it('updateAccount returns null if missing', async () => {
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.updateAccount('u1', { gender: 'm' })).toBeNull();
    });

    it('updateRole returns row/null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.updateRole('u1', 'r')).toEqual({ id: 'u1' });
      expect(await userModel.updateRole('u1', 'r')).toBeNull();
    });

    it('promoteListenerToArtist returns row/null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.promoteListenerToArtist('u1')).toEqual({ id: 'u1' });
      expect(await userModel.promoteListenerToArtist('u1')).toBeNull();
    });
  });

  // ========================================
  // Media & Web Profiles
  // ========================================
  describe('Media', () => {
    it('Avatar methods', async () => {
      db.query.mockResolvedValue({ rows: [{ p: 'path' }] });
      expect(await userModel.updateAvatar('u1', 'path')).toEqual({ p: 'path' });
      expect(await userModel.deleteAvatar('u1')).toEqual({ p: 'path' });
      
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.updateAvatar('u1', 'path')).toBeNull();
      expect(await userModel.deleteAvatar('u1')).toBeNull();
    });

    it('Cover photo methods', async () => {
      db.query.mockResolvedValue({ rows: [{ c: 'path' }] });
      expect(await userModel.updateCoverPhoto('u1', 'path')).toEqual({ c: 'path' });
      expect(await userModel.deleteCoverPhoto('u1')).toEqual({ c: 'path' });

      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.updateCoverPhoto('u1', 'path')).toBeNull();
      expect(await userModel.deleteCoverPhoto('u1')).toBeNull();
    });

    it('Web Profile methods', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'p1' }] });
      expect(await userModel.findWebProfilesByUserId('u1')).toEqual([{ id: 'p1' }]);
      expect(await userModel.findWebProfileByPlatform('u1', 'pl')).toEqual({ id: 'p1' });
      expect(await userModel.createWebProfile('u1', 'pl', 'u')).toEqual({ id: 'p1' });
      expect(await userModel.deleteWebProfile('p1')).toEqual({ id: 'p1' });
      expect(await userModel.findWebProfileById('p1')).toEqual({ id: 'p1' });

      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findWebProfilesByUserId('u1')).toEqual([]);
      expect(await userModel.findWebProfileByPlatform('u1', 'pl')).toBeNull();
      expect(await userModel.createWebProfile('u1', 'pl', 'u')).toBeNull();
      expect(await userModel.deleteWebProfile('p1')).toBeNull();
      expect(await userModel.findWebProfileById('p1')).toBeNull();
    });
  });

  // ========================================
  // Privacy & Settings
  // ========================================
  describe('Settings', () => {
    it('updatePrivacy returns row/null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ p: true }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.updatePrivacy('u1', true)).toEqual({ p: true });
      expect(await userModel.updatePrivacy('u1', true)).toBeNull();
    });

    it('findContentSettingsByUserId returns row/null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ s: 1 }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.findContentSettingsByUserId('u1')).toEqual({ s: 1 });
      expect(await userModel.findContentSettingsByUserId('u1')).toBeNull();
    });

    it('updateContentSettings handles edge cases', async () => {
      expect(await userModel.updateContentSettings('u1', {})).toBeNull();
      db.query.mockResolvedValueOnce({ rows: [{ s: 1 }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.updateContentSettings('u1', { rss_title: 't' })).toEqual({ s: 1 });
      expect(await userModel.updateContentSettings('u1', { rss_title: 't' })).toBeNull();
    });

    it('findPrivacySettingsByUserId returns row/null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ s: 1 }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.findPrivacySettingsByUserId('u1')).toEqual({ s: 1 });
      expect(await userModel.findPrivacySettingsByUserId('u1')).toBeNull();
    });

    it('updatePrivacySettings exhaustive', async () => {
      expect(await userModel.updatePrivacySettings('u1', {})).toBeNull();
      
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 'u1' }] }),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
      
      // All branches: both updates
      await userModel.updatePrivacySettings('u1', { is_private: true, receive_messages_from_anyone: true });
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), expect.any(Array));
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_privacy_settings'), expect.any(Array));
      
      // Error handling
      client.query.mockRejectedValueOnce(new Error('fail'));
      await expect(userModel.updatePrivacySettings('u1', { is_private: true })).rejects.toThrow('fail');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  // ========================================
  // Genres & Onboarding
  // ========================================
  describe('Onboarding & Genres', () => {
    it('findGenresByUserId returns rows', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'g1' }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.findGenresByUserId('u1')).toEqual([{ id: 'g1' }]);
      expect(await userModel.findGenresByUserId('u1')).toEqual([]);
    });

    it('replaceGenres exhaustive', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
      db.query.mockResolvedValue({ rows: [{ id: 'g1' }] });
      
      const result = await userModel.replaceGenres('u1', ['g1', 'g2']);
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['u1']);
      expect(client.query).toHaveBeenCalledTimes(5); // BEGIN, DELETE, INSERT x2, COMMIT
      expect(result).toEqual([{ id: 'g1' }]);
      
      client.query.mockRejectedValueOnce(new Error('fail'));
      await expect(userModel.replaceGenres('u1', ['g1'])).rejects.toThrow('fail');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('completeOnboarding handles edge cases', async () => {
      expect(await userModel.completeOnboarding('u1', {})).toBeNull();
      db.query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] }).mockResolvedValueOnce({ rows: [] });
      expect(await userModel.completeOnboarding('u1', { bio: 'hi' })).toEqual({ id: 'u1' });
      expect(await userModel.completeOnboarding('u1', { bio: 'hi' })).toBeNull();
    });
  });

  // ========================================
  // Analytics & Liked Tracks
  // ========================================
  describe('Analytics', () => {
    it('findVisibleLikedTracksByUserId handles total', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 't1' }] }).mockResolvedValueOnce({ rows: [{ total: 5 }] });
      const res = await userModel.findVisibleLikedTracksByUserId({ targetUserId: 'u1', limit: 10, offset: 0 });
      expect(res.total).toBe(5);
      
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      const res2 = await userModel.findVisibleLikedTracksByUserId({ targetUserId: 'u1' });
      expect(res2.total).toBe(0);
    });

    it('createOAuthUser returns row', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.createOAuthUser({ email: 'e' })).toEqual({ id: 'u1' });
    });

    it('Email change methods', async () => {
      db.query.mockResolvedValue({});
      await userModel.setPendingEmail('u1', 'e');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('pending_email'), ['u1', 'e']);
      
      db.query.mockResolvedValue({ rows: [{ email: 'e' }] });
      expect(await userModel.applyPendingEmail('u1')).toEqual({ email: 'e' });
      
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.applyPendingEmail('u1')).toBeUndefined();
    });

    it('softDeleteWithContent exhaustive', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      db.connect.mockResolvedValue(client);
      await userModel.softDeleteWithContent('u1');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      
      client.query.mockRejectedValueOnce(new Error('fail'));
      await expect(userModel.softDeleteWithContent('u1')).rejects.toThrow('fail');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  // ========================================
  // Moderation & Status
  // ========================================
  describe('Moderation', () => {
    it('updateUserStatus handles all statuses', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.updateUserStatus('u1', 'suspended', 'r')).toEqual({ id: 'u1' });
      expect(await userModel.updateUserStatus('u1', 'active')).toEqual({ id: 'u1' });
      expect(await userModel.updateUserStatus('u1', 'deleted')).toEqual({ id: 'u1' });
      
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.updateUserStatus('u1', 'active')).toBeNull();
      
      await expect(userModel.updateUserStatus('u1', 'junk')).rejects.toThrow('Invalid status');
    });

    it('Counters', async () => {
      db.query.mockResolvedValue({ rows: [{ warning_count: 5 }] });
      expect(await userModel.getUserWarningCount('u1')).toBe(5);
      
      db.query.mockResolvedValue({ rows: [{ suspended_count: 3 }] });
      expect(await userModel.getSuspendedAccountsCount()).toBe(3);
      
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.getUserWarningCount('u1')).toBe(0);
      expect(await userModel.getSuspendedAccountsCount()).toBe(0);
    });

    it('getActiveUsersCount handles period branches', async () => {
      db.query.mockResolvedValue({ rows: [{ active_count: 1 }] });
      expect(await userModel.getActiveUsersCount('day')).toBe(1);
      expect(await userModel.getActiveUsersCount('week')).toBe(1);
      expect(await userModel.getActiveUsersCount('month')).toBe(1);
      expect(await userModel.getActiveUsersCount('other')).toBe(1);
      
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.getActiveUsersCount()).toBe(0);
    });

    it('getActiveUsersToday and registrations', async () => {
      db.query.mockResolvedValue({ rows: [{ active_count: 1 }] });
      expect(await userModel.getActiveUsersToday()).toBe(1);
      
      db.query.mockResolvedValue({ rows: [{ registrations_count: 1 }] });
      expect(await userModel.getNewRegistrationsCount('day')).toBe(1);
      
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.getActiveUsersToday()).toBe(0);
      expect(await userModel.getNewRegistrationsCount()).toBe(0);
    });
  });

  describe('Revival', () => {
    it('findByEmailIncludingDeleted', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.findByEmailIncludingDeleted('e')).toEqual({ id: 'u1' });
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.findByEmailIncludingDeleted('e')).toBeNull();
    });

    it('reviveUser', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
      expect(await userModel.reviveUser('u1', {})).toEqual({ id: 'u1' });
      db.query.mockResolvedValue({ rows: [] });
      expect(await userModel.reviveUser('u1', {})).toBeNull();
    });
  });
});
