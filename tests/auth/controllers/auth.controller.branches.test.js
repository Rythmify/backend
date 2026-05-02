// ============================================================
// tests/auth/controllers/auth.controller.branches.test.js
// Coverage Target: 100% (Focus on missed branches)
// ============================================================

const authController = require('../../../src/controllers/auth.controller');
const authService = require('../../../src/services/auth.service');

jest.mock('../../../src/services/auth.service');

describe('Auth Controller - Branch Coverage Expansion', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, cookies: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn()
    };
  });

  describe('checkEmailExists Branches', () => {
    it('returns 400 if email invalid', async () => {
        req.body.email = 'not-an-email';
        await authController.checkEmailExists(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('verifyEmail Branches', () => {
    it('returns 400 if token missing', async () => {
        await authController.verifyEmail(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login Branches', () => {
    it('returns 400 if identifier invalid', async () => {
        req.body = { identifier: '', password: 'p' };
        await authController.login(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 if password missing', async () => {
        req.body = { identifier: 'u1' };
        await authController.login(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('refresh Branches', () => {
    it('prioritizes refreshToken cookie', async () => {
        req.cookies.refreshToken = 'c1';
        req.cookies.refresh_token = 'c2';
        req.body.refresh_token = 'b1';
        authService.refresh.mockResolvedValue({ access_token: 'a', refresh_token: 'new' });
        await authController.refresh(req, res);
        expect(authService.refresh).toHaveBeenCalledWith({ refresh_token: 'c1' });
    });

    it('falls back to body.refresh_token', async () => {
        req.body.refresh_token = 'b1';
        authService.refresh.mockResolvedValue({ access_token: 'a', refresh_token: 'new' });
        await authController.refresh(req, res);
        expect(authService.refresh).toHaveBeenCalledWith({ refresh_token: 'b1' });
    });
  });

  describe('resetPassword Branches', () => {
    it('returns 400 if passwords mismatch', async () => {
        req.body = { token: 't', new_password: 'Password123', confirm_password: 'Wrong' };
        await authController.resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 if logout_all is not boolean', async () => {
        req.body = { token: 't', new_password: 'Password123', confirm_password: 'Password123', logout_all: 'yes' };
        await authController.resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GitHub OAuth Branches', () => {
    it('redirects to login if oauth error occurs', async () => {
        req.query.error = 'access_denied';
        await authController.githubOAuthCallback(req, res);
        expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=github_denied'));
    });

    it('redirects to login if params invalid', async () => {
        req.query = { code: 123, state: {} };
        await authController.githubOAuthCallback(req, res);
        expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=invalid_params'));
    });
  });

  describe('deleteAccount Branches', () => {
    it('returns 400 if password missing', async () => {
        req.user = { sub: 'u1' };
        await authController.deleteAccount(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
