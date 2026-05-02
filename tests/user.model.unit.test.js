// ============================================================
// tests/user.model.unit.test.js
// ============================================================
const model = require('../src/models/user.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

// softDeleteWithContent uses a transaction client
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  db.connect.mockResolvedValue(mockClient);
});

// ── Shared stubs ─────────────────────────────────────────────
const fakeUser = {
  id: 'u1',
  email: 'user@example.com',
  display_name: 'User',
  username: 'user123',
  gender: 'male',
  role: 'listener',
  is_verified: true,
  is_suspended: false,
  created_at: new Date().toISOString(),
};

// ══════════════════════════════════════════════════════════════
// findByEmail
// ══════════════════════════════════════════════════════════════
describe('findByEmail', () => {
  it('returns user when found', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findByEmail('user@example.com')).resolves.toEqual(fakeUser);
  });

  it('returns null when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findByEmail('ghost@example.com')).resolves.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// isUsernameTaken
// ══════════════════════════════════════════════════════════════
describe('isUsernameTaken', () => {
  it('returns true when username exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    await expect(model.isUsernameTaken('user123')).resolves.toBe(true);
  });

  it('returns false when username is free', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.isUsernameTaken('freeuser')).resolves.toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// findByUsername
// ══════════════════════════════════════════════════════════════
describe('findByUsername', () => {
  it('returns user when found', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findByUsername('user123')).resolves.toEqual(fakeUser);
  });

  it('returns null when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findByUsername('nobody')).resolves.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// findByEmailOrUsername
// ══════════════════════════════════════════════════════════════
describe('findByEmailOrUsername', () => {
  it('returns user when found by email', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findByEmailOrUsername('user@example.com')).resolves.toEqual(fakeUser);
  });

  it('returns user when found by username', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findByEmailOrUsername('user123')).resolves.toEqual(fakeUser);
  });

  it('returns null when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findByEmailOrUsername('nobody')).resolves.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// findById
// ══════════════════════════════════════════════════════════════
describe('findById', () => {
  it('returns user when found', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findById('u1')).resolves.toEqual(fakeUser);
  });

  it('returns null when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findById('ghost')).resolves.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// create
// ══════════════════════════════════════════════════════════════
describe('create', () => {
  it('inserts user and returns the created row', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });

    const result = await model.create({
      email: 'user@example.com',
      password_hashed: 'hashed',
      display_name: 'User',
      gender: 'male',
      date_of_birth: '2000-01-01',
      username: 'user123',
    });

    expect(result).toEqual(fakeUser);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), [
      'user@example.com',
      'hashed',
      'User',
      'male',
      '2000-01-01',
      'user123',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════
// markVerified
// ══════════════════════════════════════════════════════════════
describe('markVerified', () => {
  it('executes UPDATE query with userId', async () => {
    db.query.mockResolvedValueOnce({});

    await model.markVerified('u1');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_verified = true'), ['u1']);
  });
});

// ══════════════════════════════════════════════════════════════
// updateLastLogin
// ══════════════════════════════════════════════════════════════
describe('updateLastLogin', () => {
  it('executes UPDATE query with userId', async () => {
    db.query.mockResolvedValueOnce({});

    await model.updateLastLogin('u1');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('last_login_at'), ['u1']);
  });
});

// ══════════════════════════════════════════════════════════════
// updatePassword
// ══════════════════════════════════════════════════════════════
describe('updatePassword', () => {
  it('executes UPDATE with new hash and userId', async () => {
    db.query.mockResolvedValueOnce({});

    await model.updatePassword('u1', 'new_hashed');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('password_hashed'), [
      'new_hashed',
      'u1',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════
// findFullById
// ══════════════════════════════════════════════════════════════
describe('findFullById', () => {
  it('returns full user profile when found', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findFullById('u1')).resolves.toEqual(fakeUser);
  });

  it('returns null when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findFullById('ghost')).resolves.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// findPublicById
// ══════════════════════════════════════════════════════════════
describe('findPublicById', () => {
  it('returns public profile when found', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });
    await expect(model.findPublicById('u1')).resolves.toEqual(fakeUser);
  });

  it('returns null when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findPublicById('ghost')).resolves.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// isFollowing
// ══════════════════════════════════════════════════════════════
describe('isFollowing', () => {
  it('returns true when following relationship exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    await expect(model.isFollowing('u1', 'u2')).resolves.toBe(true);
  });

  it('returns false when not following', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.isFollowing('u1', 'u2')).resolves.toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// updateProfile
// ══════════════════════════════════════════════════════════════
describe('updateProfile', () => {
  it('returns updated user when valid fields provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...fakeUser, display_name: 'New Name' }] });

    const result = await model.updateProfile('u1', { display_name: 'New Name' });

    expect(result.display_name).toBe('New Name');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining(['New Name', 'u1'])
    );
  });

  it('returns null when no allowed fields are provided', async () => {
    const result = await model.updateProfile('u1', { unknown_field: 'value' });

    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('ignores fields not in allowed list', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });

    await model.updateProfile('u1', { display_name: 'Valid', password: 'should_be_ignored' });

    // only display_name + userId in params — password should not appear
    const callArgs = db.query.mock.calls[0][1];
    expect(callArgs).not.toContain('should_be_ignored');
  });
});

// ══════════════════════════════════════════════════════════════
// createOAuthUser
// ══════════════════════════════════════════════════════════════
describe('createOAuthUser', () => {
  it('inserts OAuth user with is_verified=true and returns row', async () => {
    db.query.mockResolvedValueOnce({ rows: [fakeUser] });

    const result = await model.createOAuthUser({
      email: 'oauth@example.com',
      display_name: 'OAuth User',
      username: 'oauthuser',
    });

    expect(result).toEqual(fakeUser);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_verified'), [
      'oauth@example.com',
      'OAuth User',
      'oauthuser',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════
// setPendingEmail / applyPendingEmail
// ══════════════════════════════════════════════════════════════
describe('setPendingEmail', () => {
  it('executes UPDATE with userId and new email', async () => {
    db.query.mockResolvedValueOnce({});

    await model.setPendingEmail('u1', 'new@example.com');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('pending_email'), [
      'u1',
      'new@example.com',
    ]);
  });
});

describe('applyPendingEmail', () => {
  it('applies pending email and returns updated row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ email: 'new@example.com' }] });

    const result = await model.applyPendingEmail('u1');

    expect(result.email).toBe('new@example.com');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('pending_email'), ['u1']);
  });
});

// ══════════════════════════════════════════════════════════════
// softDeleteWithContent
// ══════════════════════════════════════════════════════════════
describe('softDeleteWithContent', () => {
  it('runs BEGIN, deletes tracks/playlists/user, then COMMITs', async () => {
    mockClient.query.mockResolvedValue({});

    await model.softDeleteWithContent('u1');

    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe('BEGIN');
    expect(calls.some((q) => q.includes('UPDATE tracks'))).toBe(true);
    expect(calls.some((q) => q.includes('UPDATE playlists'))).toBe(true);
    expect(calls.some((q) => q.includes('UPDATE users'))).toBe(true);
    expect(calls[calls.length - 1]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rolls back and re-throws on error', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('db error')); // first UPDATE fails

    await expect(model.softDeleteWithContent('u1')).rejects.toThrow('db error');

    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// updateAvatar / deleteAvatar
// ══════════════════════════════════════════════════════════════
describe('updateAvatar', () => {
  it('returns updated profile_picture path', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ profile_picture: '/img/avatar.jpg' }] });

    const result = await model.updateAvatar('u1', '/img/avatar.jpg');

    expect(result.profile_picture).toBe('/img/avatar.jpg');
  });
});

describe('deleteAvatar', () => {
  it('sets profile_picture to null and returns row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ profile_picture: null }] });

    const result = await model.deleteAvatar('u1');

    expect(result.profile_picture).toBeNull();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('profile_picture = NULL'), [
      'u1',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════
// updateCoverPhoto / deleteCoverPhoto
// ══════════════════════════════════════════════════════════════
describe('updateCoverPhoto', () => {
  it('returns updated cover_photo path', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cover_photo: '/img/cover.jpg' }] });

    const result = await model.updateCoverPhoto('u1', '/img/cover.jpg');

    expect(result.cover_photo).toBe('/img/cover.jpg');
  });
});

describe('deleteCoverPhoto', () => {
  it('sets cover_photo to null and returns row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cover_photo: null }] });

    const result = await model.deleteCoverPhoto('u1');

    expect(result.cover_photo).toBeNull();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('cover_photo = NULL'), ['u1']);
  });
});

// ══════════════════════════════════════════════════════════════
// updateUserStatus (admin)
// ══════════════════════════════════════════════════════════════
describe('updateUserStatus', () => {
  it('throws for invalid status', async () => {
    await expect(model.updateUserStatus('u1', 'banned')).rejects.toThrow('Invalid status');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('suspends user with reason', async () => {
    const suspended = { ...fakeUser, is_suspended: true };
    db.query.mockResolvedValueOnce({ rows: [suspended] });

    const result = await model.updateUserStatus('u1', 'suspended', 'TOS violation');

    expect(result.is_suspended).toBe(true);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_suspended = true'), [
      'suspended',
      'TOS violation',
      'u1',
    ]);
  });

  it('reactivates user and clears suspension fields', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...fakeUser, is_suspended: false }] });

    const result = await model.updateUserStatus('u1', 'active');

    expect(result.is_suspended).toBe(false);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_suspended = false'), [
      'active',
      'u1',
    ]);
  });

  it('returns null when user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.updateUserStatus('ghost', 'active');

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// getActiveUsersCount
// ══════════════════════════════════════════════════════════════
describe('getActiveUsersCount', () => {
  it('returns count for default period (month)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ active_count: 42 }] });

    const result = await model.getActiveUsersCount();

    expect(result).toBe(42);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('last_login_at'), ['30 days']);
  });

  it('returns count for day period', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ active_count: 10 }] });

    const result = await model.getActiveUsersCount('day');

    expect(result).toBe(10);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['1 day']);
  });

  it('returns 0 when no rows returned', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await model.getActiveUsersCount();

    expect(result).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// getNewRegistrationsCount
// ══════════════════════════════════════════════════════════════
describe('getNewRegistrationsCount', () => {
  it('returns registration count', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ registrations_count: 7 }] });

    const result = await model.getNewRegistrationsCount('week');

    expect(result).toBe(7);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['7 days']);
  });

  it('returns 0 when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.getNewRegistrationsCount()).resolves.toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// getSuspendedAccountsCount
// ══════════════════════════════════════════════════════════════
describe('getSuspendedAccountsCount', () => {
  it('returns suspended count', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ suspended_count: 3 }] });
    await expect(model.getSuspendedAccountsCount()).resolves.toBe(3);
  });

  it('returns 0 when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.getSuspendedAccountsCount()).resolves.toBe(0);
  });
});
