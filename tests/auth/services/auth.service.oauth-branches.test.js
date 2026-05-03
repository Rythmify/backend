let mockGoogleClient;

jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/verification-token.model');
jest.mock('../../../src/models/refresh-token.model');
jest.mock('../../../src/models/oauth-connection.model');
jest.mock('../../../src/utils/oauth-state-store', () => ({
  saveState: jest.fn(),
  validateAndDeleteState: jest.fn(),
}));
jest.mock('../../../src/config/jwt', () => ({
  signAccessToken: jest.fn(() => 'access-token'),
  signRefreshToken: jest.fn(() => 'refresh-token'),
  verifyToken: jest.fn(),
}));
jest.mock('google-auth-library', () => {
  mockGoogleClient = {
    verifyIdToken: jest.fn(),
  };
  return {
    OAuth2Client: jest.fn(() => mockGoogleClient),
  };
});
jest.mock('../../../src/config/env', () => ({
  RECAPTCHA_SECRET: null,
  JWT_ACCESS_EXPIRES_IN: '1h',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GITHUB_CLIENT_ID: 'github-client-id',
  GITHUB_CLIENT_SECRET: 'github-client-secret',
  GITHUB_REDIRECT_URI: 'https://client.example.com/oauth/github/callback',
}));

const authService = require('../../../src/services/auth.service');
const userModel = require('../../../src/models/user.model');
const verificationTokenModel = require('../../../src/models/verification-token.model');
const refreshTokenModel = require('../../../src/models/refresh-token.model');
const oauthConnectionModel = require('../../../src/models/oauth-connection.model');
const { saveState, validateAndDeleteState } = require('../../../src/utils/oauth-state-store');

global.fetch = jest.fn();

describe('auth service branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('resendVerification', () => {
    it('returns without side effects when the email does not belong to an account', async () => {
      userModel.findByEmail.mockResolvedValue(null);

      await expect(
        authService.resendVerification({ email: 'missing@example.com' })
      ).resolves.toBeUndefined();

      expect(verificationTokenModel.create).not.toHaveBeenCalled();
    });

    it('returns without side effects when the account is already verified', async () => {
      userModel.findByEmail.mockResolvedValue({ id: 'u1', is_verified: true });

      await expect(
        authService.resendVerification({ email: 'verified@example.com' })
      ).resolves.toBeUndefined();

      expect(verificationTokenModel.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailChange', () => {
    it('throws when the token is invalid', async () => {
      verificationTokenModel.findValidToken.mockResolvedValue(null);

      await expect(authService.verifyEmailChange({ token: 'bad-token' })).rejects.toMatchObject({
        statusCode: 422,
        code: 'AUTH_TOKEN_EXPIRED',
      });
    });

    it('throws when the pending email already exists on another account', async () => {
      verificationTokenModel.findValidToken.mockResolvedValue({ id: 't1', user_id: 'u1' });
      userModel.findById.mockResolvedValue({ id: 'u1', pending_email: 'new@example.com' });
      userModel.findByEmail.mockResolvedValue({ id: 'u2' });

      await expect(authService.verifyEmailChange({ token: 'valid-token' })).rejects.toMatchObject({
        statusCode: 409,
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
      });
    });

    it('applies the pending email when there is no conflict', async () => {
      verificationTokenModel.findValidToken.mockResolvedValue({ id: 't1', user_id: 'u1' });
      userModel.findById.mockResolvedValue({ id: 'u1', pending_email: 'new@example.com' });
      userModel.findByEmail.mockResolvedValue(null);
      userModel.applyPendingEmail.mockResolvedValue({ email: 'new@example.com' });

      const result = await authService.verifyEmailChange({ token: 'valid-token' });

      expect(verificationTokenModel.markUsed).toHaveBeenCalledWith('t1');
      expect(userModel.applyPendingEmail).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ email: 'new@example.com' });
    });
  });

  describe('googleLogin', () => {
    it('throws when Google rejects the id token', async () => {
      mockGoogleClient.verifyIdToken.mockRejectedValue(new Error('invalid'));

      await expect(authService.googleLogin({ id_token: 'bad-token' })).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTH_TOKEN_INVALID',
      });
    });

    it('returns tokens for an existing linked Google account', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-sub', email: 'user@example.com', given_name: 'User', name: 'User' }),
      });
      oauthConnectionModel.findByProvider.mockResolvedValue({ user_id: 'u1' });
      userModel.findById.mockResolvedValue({
        id: 'u1',
        role: 'listener',
        is_suspended: false,
        email: 'user@example.com',
        display_name: 'User',
        is_verified: true,
      });
      refreshTokenModel.create.mockResolvedValue({});

      const result = await authService.googleLogin({ id_token: 'good-token' });

      expect(oauthConnectionModel.updateTokens).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', provider: 'google', access_token: null })
      );
      expect(result).toEqual(
        expect.objectContaining({ is_new_user: false, user: expect.objectContaining({ id: 'u1' }) })
      );
    });
  });

  describe('githubGetAuthUrl', () => {
    it('persists a CSRF state and returns a GitHub authorization URL', () => {
      const result = authService.githubGetAuthUrl();

      expect(saveState).toHaveBeenCalledWith(expect.any(String));
      expect(result.state).toEqual(expect.any(String));
      expect(result.authUrl).toContain('https://github.com/login/oauth/authorize?');
      expect(result.authUrl).toContain('client_id=github-client-id');
    });
  });

  describe('githubCallback', () => {
    it('throws when the OAuth state is missing or invalid', async () => {
      validateAndDeleteState.mockReturnValue(false);

      await expect(authService.githubCallback({ code: 'code', state: 'bad-state' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('throws when the token exchange fails', async () => {
      validateAndDeleteState.mockReturnValue(true);
      global.fetch.mockResolvedValueOnce({
        json: async () => ({ error: 'bad_verification_code' }),
      });

      await expect(authService.githubCallback({ code: 'code', state: 'good-state' })).rejects.toMatchObject({
        statusCode: 422,
        code: 'BUSINESS_OPERATION_NOT_ALLOWED',
      });
    });

    it('creates a new GitHub user when no account exists and the email must be discovered', async () => {
      validateAndDeleteState.mockReturnValue(true);
      global.fetch
        .mockResolvedValueOnce({ json: async () => ({ access_token: 'github-access' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 123, email: null, login: 'octocat', name: 'Octo Cat' }) })
        .mockResolvedValueOnce({ json: async () => ([{ email: 'octo@example.com', primary: true, verified: true }]) });
      oauthConnectionModel.findByProvider.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(null);
      userModel.isUsernameTaken.mockResolvedValue(false);
      userModel.createOAuthUser.mockResolvedValue({
        id: 'u-new',
        email: 'octo@example.com',
        role: 'listener',
        is_suspended: false,
      });
      refreshTokenModel.create.mockResolvedValue({});

      const result = await authService.githubCallback({ code: 'code', state: 'good-state' });

      expect(userModel.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'octo@example.com',
          display_name: 'Octo Cat',
        })
      );
      expect(oauthConnectionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u-new', provider: 'github', provider_user_id: '123' })
      );
      expect(result).toEqual(expect.objectContaining({ is_new_user: true }));
    });
  });
});