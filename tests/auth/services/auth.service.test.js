// ============================================================
// tests/auth.service.unit.test.js
// ============================================================
const authService = require('../../../src/services/auth.service');
const userModel = require('../../../src/models/user.model');
const verificationTokenModel = require('../../../src/models/verification-token.model');
const refreshTokenModel = require('../../../src/models/refresh-token.model');
const oauthConnectionModel = require('../../../src/models/oauth-connection.model');
const bcrypt = require('bcryptjs');
const { signAccessToken, signRefreshToken, verifyToken } = require('../../../src/config/jwt');
const { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeEmail } = require('../../../src/utils/mailer');

jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/verification-token.model');
jest.mock('../../../src/models/refresh-token.model');
jest.mock('../../../src/models/oauth-connection.model');
jest.mock('bcryptjs');
jest.mock('../../../src/config/jwt');
jest.mock('../../../src/utils/mailer');
// Disable CAPTCHA in all tests
jest.mock('../../../src/config/env', () => ({
  RECAPTCHA_SECRET: null,
  JWT_ACCESS_EXPIRES_IN: '15m',
  GOOGLE_CLIENT_ID: 'google_client_id',
}));

beforeEach(() => jest.clearAllMocks());

// ── Shared stubs ─────────────────────────────────────────────
const fakeUser = {
  id: 'u1',
  email: 'user@example.com',
  display_name: 'User',
  password_hashed: 'hashed',
  gender: 'male',
  role: 'listener',
  is_verified: true,
  is_suspended: false,
  username: 'user123',
  created_at: new Date().toISOString(),
  date_of_birth: '2000-01-01',
};

// ══════════════════════════════════════════════════════════════
// register
// ══════════════════════════════════════════════════════════════
describe('register', () => {
  beforeEach(() => {
    userModel.findByEmailIncludingDeleted.mockResolvedValue(null); // 👈 changed
    userModel.isUsernameTaken.mockResolvedValue(false);
    userModel.create.mockResolvedValue(fakeUser);
    verificationTokenModel.create.mockResolvedValue({});
    sendVerificationEmail.mockResolvedValue();
    bcrypt.hash.mockResolvedValue('hashed_pw');
  });

  it('creates user and sends verification email', async () => {
    const result = await authService.register({
      email: 'User@Example.COM',
      password: 'Password1',
      display_name: 'User',
      gender: 'male',
      date_of_birth: '2000-01-01',
    });

    expect(userModel.findByEmailIncludingDeleted).toHaveBeenCalledWith('user@example.com'); // 👈 changed
    expect(bcrypt.hash).toHaveBeenCalledWith('Password1', 12);
    expect(userModel.create).toHaveBeenCalled();
    expect(verificationTokenModel.create).toHaveBeenCalled();
    expect(sendVerificationEmail).toHaveBeenCalled();
    expect(result).toMatchObject({ email: fakeUser.email, user_id: fakeUser.id });
  });

  it('throws 409 when email already exists', async () => {
    userModel.findByEmailIncludingDeleted.mockResolvedValue({ ...fakeUser, deleted_at: null }); // 👈 changed

    await expect(
      authService.register({ email: 'user@example.com', password: 'Password1' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'AUTH_EMAIL_ALREADY_EXISTS' });

    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('appends suffix if username is taken and retries until free', async () => {
    userModel.isUsernameTaken
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    await authService.register({
      email: 'user@example.com',
      password: 'Password1',
    });

    expect(userModel.create).toHaveBeenCalled();
    const calledUsername = userModel.create.mock.calls[0][0].username;
    expect(typeof calledUsername).toBe('string');
  });
});
// ══════════════════════════════════════════════════════════════
// login
// ══════════════════════════════════════════════════════════════
describe('login', () => {
  beforeEach(() => {
    userModel.findByEmailOrUsername.mockResolvedValue(fakeUser);
    bcrypt.compare.mockResolvedValue(true);
    signAccessToken.mockReturnValue('access_tok');
    signRefreshToken.mockReturnValue('refresh_tok');
    refreshTokenModel.create.mockResolvedValue({});
    userModel.updateLastLogin.mockResolvedValue();
  });

  it('returns tokens and user on valid credentials', async () => {
    const result = await authService.login({ identifier: 'user@example.com', password: 'Password1' });

    expect(userModel.findByEmailOrUsername).toHaveBeenCalledWith('user@example.com');
    expect(bcrypt.compare).toHaveBeenCalledWith('Password1', fakeUser.password_hashed);
    expect(result).toMatchObject({
      access_token: 'access_tok',
      token_type: 'Bearer',
    });
    expect(result.user).toMatchObject({ user_id: fakeUser.id });
  });

  it('throws 401 when user not found', async () => {
    userModel.findByEmailOrUsername.mockResolvedValue(null);

    await expect(
      authService.login({ identifier: 'nobody@example.com', password: 'Password1' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('throws 401 when password is wrong', async () => {
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.login({ identifier: 'user@example.com', password: 'WrongPassword1' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('throws 422 when email not verified', async () => {
    userModel.findByEmailOrUsername.mockResolvedValue({ ...fakeUser, is_verified: false });

    await expect(
      authService.login({ identifier: 'user@example.com', password: 'Password1' })
    ).rejects.toMatchObject({ statusCode: 422, code: 'AUTH_EMAIL_NOT_VERIFIED' });
  });

  it('throws 403 when account suspended', async () => {
    userModel.findByEmailOrUsername.mockResolvedValue({ ...fakeUser, is_suspended: true });

    await expect(
      authService.login({ identifier: 'user@example.com', password: 'Password1' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_ACCOUNT_SUSPENDED' });
  });

  it('updates last_login after successful login', async () => {
    await authService.login({ identifier: 'user@example.com', password: 'Password1' });
    expect(userModel.updateLastLogin).toHaveBeenCalledWith(fakeUser.id);
  });
});

// ══════════════════════════════════════════════════════════════
// refresh
// ══════════════════════════════════════════════════════════════
describe('refresh', () => {
  beforeEach(() => {
    verifyToken.mockReturnValue({ sub: 'u1' });
    refreshTokenModel.findValid.mockResolvedValue({ id: 'rt1', user_id: 'u1' });
    userModel.findById.mockResolvedValue(fakeUser);
    signRefreshToken.mockReturnValue('new_refresh_tok');
    signAccessToken.mockReturnValue('new_access_tok');
    refreshTokenModel.rotateToken.mockResolvedValue('new_refresh_tok');
  });

  it('throws 401 when no token provided', async () => {
    await expect(authService.refresh({ refresh_token: null }))
      .rejects.toMatchObject({ statusCode: 401, code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });

  it('throws 401 when token fails JWT verification', async () => {
    verifyToken.mockImplementation(() => { throw new Error('bad token'); });

    await expect(authService.refresh({ refresh_token: 'bad_tok' }))
      .rejects.toMatchObject({ statusCode: 401, code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });

  it('throws 401 when token not found in DB', async () => {
    refreshTokenModel.findValid.mockResolvedValue(null);

    await expect(authService.refresh({ refresh_token: 'orphan_tok' }))
      .rejects.toMatchObject({ statusCode: 401, code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });

  it('throws 403 when account suspended', async () => {
    userModel.findById.mockResolvedValue({ ...fakeUser, is_suspended: true });

    await expect(authService.refresh({ refresh_token: 'tok' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'AUTH_ACCOUNT_SUSPENDED' });
  });

  it('throws 401 when rotateToken returns null (token already used)', async () => {
    refreshTokenModel.rotateToken.mockResolvedValue(null);

    await expect(authService.refresh({ refresh_token: 'tok' }))
      .rejects.toMatchObject({ statusCode: 401, code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });

  it('returns new access and refresh tokens on success', async () => {
    const result = await authService.refresh({ refresh_token: 'valid_tok' });

    expect(refreshTokenModel.rotateToken).toHaveBeenCalled();
    expect(result).toMatchObject({
      access_token: 'new_access_tok',
      token_type: 'Bearer',
      refresh_token: 'new_refresh_tok',
    });
  });
});

// ══════════════════════════════════════════════════════════════
// verifyEmail
// ══════════════════════════════════════════════════════════════
describe('verifyEmail', () => {
  beforeEach(() => {
    verificationTokenModel.findValidToken.mockResolvedValue({ id: 'tok1', user_id: 'u1' });
    verificationTokenModel.markUsed.mockResolvedValue();
    userModel.markVerified.mockResolvedValue();
    userModel.findById.mockResolvedValue(fakeUser);
    signAccessToken.mockReturnValue('access_tok');
    signRefreshToken.mockReturnValue('refresh_tok');
    refreshTokenModel.create.mockResolvedValue({});
  });

  it('throws 400 when token invalid or expired', async () => {
    verificationTokenModel.findValidToken.mockResolvedValue(null);

    await expect(authService.verifyEmail({ token: 'bad_tok' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'AUTH_TOKEN_INVALID' });
  });

  it('marks token used, marks user verified, returns tokens', async () => {
    const result = await authService.verifyEmail({ token: 'valid_tok' });

    expect(verificationTokenModel.markUsed).toHaveBeenCalledWith('tok1');
    expect(userModel.markVerified).toHaveBeenCalledWith('u1');
    expect(result).toMatchObject({ accessToken: 'access_tok', refreshToken: 'refresh_tok' });
  });
});

// ══════════════════════════════════════════════════════════════
// logout
// ══════════════════════════════════════════════════════════════
describe('logout', () => {
  it('revokes token when provided', async () => {
    refreshTokenModel.revoke.mockResolvedValue();

    await authService.logout({ refresh_token: 'tok' });

    expect(refreshTokenModel.revoke).toHaveBeenCalledWith('tok');
  });

  it('does nothing when no token provided', async () => {
    await authService.logout({ refresh_token: null });
    expect(refreshTokenModel.revoke).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// requestPasswordReset
// ══════════════════════════════════════════════════════════════
describe('requestPasswordReset', () => {
  it('does nothing silently when user not found (security: no enumeration)', async () => {
    userModel.findByEmail.mockResolvedValue(null);

    await expect(
      authService.requestPasswordReset({ email: 'ghost@example.com' })
    ).resolves.toBeUndefined();

    expect(verificationTokenModel.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('creates token and sends email when user exists', async () => {
    userModel.findByEmail.mockResolvedValue(fakeUser);
    verificationTokenModel.create.mockResolvedValue({});
    sendPasswordResetEmail.mockResolvedValue();

    await authService.requestPasswordReset({ email: 'user@example.com' });

    expect(verificationTokenModel.create).toHaveBeenCalled();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ token: expect.any(String) })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// resetPassword
// ══════════════════════════════════════════════════════════════
describe('resetPassword', () => {
  beforeEach(() => {
    verificationTokenModel.findValidToken.mockResolvedValue({ id: 'tok1', user_id: 'u1' });
    bcrypt.hash.mockResolvedValue('new_hashed');
    userModel.updatePassword.mockResolvedValue();
    verificationTokenModel.markUsed.mockResolvedValue();
    refreshTokenModel.revokeAllForUser.mockResolvedValue();
  });

  it('throws 422 when token expired', async () => {
    verificationTokenModel.findValidToken.mockResolvedValue(null);

    await expect(
      authService.resetPassword({ token: 'bad', new_password: 'NewPassword1' })
    ).rejects.toMatchObject({ statusCode: 422, code: 'AUTH_TOKEN_EXPIRED' });
  });

  it('updates password and revokes all tokens when logout_all=true', async () => {
    await authService.resetPassword({ token: 'valid', new_password: 'NewPassword1', logout_all: true });

    expect(userModel.updatePassword).toHaveBeenCalledWith('u1', 'new_hashed');
    expect(verificationTokenModel.markUsed).toHaveBeenCalledWith('tok1');
    expect(refreshTokenModel.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('does not revoke tokens when logout_all=false', async () => {
    await authService.resetPassword({ token: 'valid', new_password: 'NewPassword1', logout_all: false });

    expect(refreshTokenModel.revokeAllForUser).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// changeEmail
// ══════════════════════════════════════════════════════════════
describe('changeEmail', () => {
  beforeEach(() => {
    userModel.findByEmail.mockResolvedValue(null);     // new email not taken
    userModel.findById.mockResolvedValue(fakeUser);
    verificationTokenModel.revokeAllForUser.mockResolvedValue();
    userModel.setPendingEmail.mockResolvedValue();
    verificationTokenModel.create.mockResolvedValue({});
    sendEmailChangeEmail.mockResolvedValue();
  });

  it('throws 409 when new email already registered', async () => {
    userModel.findByEmail.mockResolvedValue(fakeUser); // email taken

    await expect(
      authService.changeEmail({ userId: 'u1', new_email: 'taken@example.com' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'AUTH_EMAIL_ALREADY_EXISTS' });
  });

  it('sets pending email and sends verification', async () => {
    await authService.changeEmail({ userId: 'u1', new_email: 'new@example.com' });

    expect(userModel.setPendingEmail).toHaveBeenCalledWith('u1', 'new@example.com');
    expect(verificationTokenModel.create).toHaveBeenCalled();
    expect(sendEmailChangeEmail).toHaveBeenCalledWith(
      'new@example.com',
      expect.objectContaining({ token: expect.any(String) })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// deleteAccount
// ══════════════════════════════════════════════════════════════
describe('deleteAccount', () => {
  beforeEach(() => {
    userModel.findById.mockResolvedValue(fakeUser);
    bcrypt.compare.mockResolvedValue(true);
    userModel.softDeleteWithContent.mockResolvedValue();
    refreshTokenModel.revokeAllForUser.mockResolvedValue();
  });

  it('throws 404 when user not found', async () => {
    userModel.findById.mockResolvedValue(null);

    await expect(
      authService.deleteAccount({ userId: 'ghost', password: 'Password1' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'AUTH_USER_NOT_FOUND' });
  });

  it('throws 401 when password is wrong', async () => {
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.deleteAccount({ userId: 'u1', password: 'WrongPassword1' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('soft deletes and revokes all sessions on success', async () => {
    await authService.deleteAccount({ userId: 'u1', password: 'Password1' });

    expect(userModel.softDeleteWithContent).toHaveBeenCalledWith('u1');
    expect(refreshTokenModel.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('skips password check for OAuth-only users (no password_hashed)', async () => {
    userModel.findById.mockResolvedValue({ ...fakeUser, password_hashed: null });

    await authService.deleteAccount({ userId: 'u1', password: 'anything' });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(userModel.softDeleteWithContent).toHaveBeenCalled();
  });
});
