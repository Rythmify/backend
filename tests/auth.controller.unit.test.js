// ============================================================
// tests/auth.controller.unit.test.js
// ============================================================
const controller = require('../src/controllers/auth.controller');
const authService = require('../src/services/auth.service');
const api = require('../src/utils/api-response');

jest.mock('../src/services/auth.service');
jest.mock('../src/utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────

const mkRes = () => {
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return res;
};

const mkReq = ({ body = {}, query = {}, cookies = {}, user = null } = {}) => ({
  body,
  query,
  cookies,
  user,
});

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════
// register
// ══════════════════════════════════════════════════════════════
describe('register', () => {
  it('calls service and returns 201 on success', async () => {
    const req = mkReq({
      body: {
        email: 'user@example.com',
        password: 'Password1',
        display_name: 'User',
        gender: 'male',
        date_of_birth: '2000-01-01',
        captcha_token: 'tok',
        platform: 'web',
      },
    });
    const res = mkRes();

    authService.register.mockResolvedValue({ user_id: 'u1', email: 'user@example.com' });

    await controller.register(req, res);

    expect(authService.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password1',
      display_name: 'User',
      gender: 'male',
      date_of_birth: '2000-01-01',
      captcha_token: 'tok',
      platform: 'web',
    });

    expect(api.success).toHaveBeenCalledWith(
      res,
      { user_id: 'u1', email: 'user@example.com' },
      'Account created. Please verify your email.',
      201
    );
  });

  it('bubbles service errors', async () => {
    const req = mkReq({ body: { email: 'x@x.com', password: 'P1' } });
    const res = mkRes();
    authService.register.mockRejectedValue(new Error('db fail'));

    await expect(controller.register(req, res)).rejects.toThrow('db fail');
  });
});

// ══════════════════════════════════════════════════════════════
// verifyEmail
// ══════════════════════════════════════════════════════════════
describe('verifyEmail', () => {
  it('returns validation error when token missing', async () => {
    const req = mkReq({ body: {} });
    const res = mkRes();

    await controller.verifyEmail(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'token', issue: 'Verification token is required' },
    ]);
    expect(authService.verifyEmail).not.toHaveBeenCalled();
  });

  it('sets cookie and returns access token on success', async () => {
    const req = mkReq({ body: { token: 'abc123' } });
    const res = mkRes();

    authService.verifyEmail.mockResolvedValue({
      accessToken: 'access_tok',
      refreshToken: 'refresh_tok',
      expires_in: 900,
    });

    await controller.verifyEmail(req, res);

    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh_tok', expect.any(Object));
    expect(api.success).toHaveBeenCalledWith(
      res,
      { access_token: 'access_tok', token_type: 'Bearer', expires_in: 900 },
      'Email verified successfully.'
    );
  });
});

// ══════════════════════════════════════════════════════════════
// login
// ══════════════════════════════════════════════════════════════
describe('login', () => {
  it('returns validation error when identifier missing', async () => {
    const req = mkReq({ body: { password: 'Password1' } });
    const res = mkRes();

    await controller.login(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'identifier', issue: 'Email or username is required' },
    ]);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('returns validation error when password missing', async () => {
    const req = mkReq({ body: { identifier: 'user@example.com' } });
    const res = mkRes();

    await controller.login(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'password', issue: 'Password is required' },
    ]);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('sets cookie and returns tokens on success', async () => {
    const req = mkReq({ body: { identifier: 'user@example.com', password: 'Password1' } });
    const res = mkRes();

    authService.login.mockResolvedValue({
      access_token: 'acc',
      refresh_token: 'ref',
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: 'u1' },
      is_new_user: false,
    });

    await controller.login(req, res);

    expect(authService.login).toHaveBeenCalledWith({
      identifier: 'user@example.com',
      password: 'Password1',
    });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'ref', expect.any(Object));
    expect(api.success).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ access_token: 'acc', token_type: 'Bearer' }),
      'Logged in successfully'
    );
  });

  it('trims whitespace from identifier before passing to service', async () => {
    const req = mkReq({ body: { identifier: '  user@example.com  ', password: 'P1' } });
    const res = mkRes();
    authService.login.mockResolvedValue({
      access_token: 'acc',
      refresh_token: 'ref',
      token_type: 'Bearer',
      expires_in: 900,
      user: {},
      is_new_user: false,
    });

    await controller.login(req, res);

    expect(authService.login).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'user@example.com' })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// refresh
// ══════════════════════════════════════════════════════════════
describe('refresh', () => {
  it('reads token from refreshToken cookie', async () => {
    const req = mkReq({ cookies: { refreshToken: 'old_token' } });
    const res = mkRes();

    authService.refresh.mockResolvedValue({
      access_token: 'new_acc',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: 'new_ref',
    });

    await controller.refresh(req, res);

    expect(authService.refresh).toHaveBeenCalledWith({ refresh_token: 'old_token' });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'new_ref', expect.any(Object));
  });

  it('reads token from refresh_token cookie as fallback', async () => {
    const req = mkReq({ cookies: { refresh_token: 'old_snake' } });
    const res = mkRes();

    authService.refresh.mockResolvedValue({
      access_token: 'new_acc',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: 'new_ref',
    });

    await controller.refresh(req, res);

    expect(authService.refresh).toHaveBeenCalledWith({ refresh_token: 'old_snake' });
  });

  it('does not include refresh_token in response body', async () => {
    const req = mkReq({ cookies: { refreshToken: 'tok' } });
    const res = mkRes();

    authService.refresh.mockResolvedValue({
      access_token: 'acc',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: 'new_ref',
    });

    await controller.refresh(req, res);

    const responseData = api.success.mock.calls[0][1];
    expect(responseData).not.toHaveProperty('refresh_token');
  });
});

// ══════════════════════════════════════════════════════════════
// logout
// ══════════════════════════════════════════════════════════════
describe('logout', () => {
  it('revokes token and clears cookies', async () => {
    const req = mkReq({ cookies: { refreshToken: 'tok' } });
    const res = mkRes();

    authService.logout.mockResolvedValue();

    await controller.logout(req, res);

    expect(authService.logout).toHaveBeenCalledWith({ refresh_token: 'tok' });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    expect(api.success).toHaveBeenCalledWith(res, { success: true }, 'Logged out successfully.');
  });

  it('works when no cookie present', async () => {
    const req = mkReq({ cookies: {} });
    const res = mkRes();
    authService.logout.mockResolvedValue();

    await controller.logout(req, res);

    expect(authService.logout).toHaveBeenCalledWith({ refresh_token: undefined });
  });
});

// ══════════════════════════════════════════════════════════════
// requestPasswordReset
// ══════════════════════════════════════════════════════════════
describe('requestPasswordReset', () => {
  it('returns validation error for invalid email', async () => {
    const req = mkReq({ body: { email: 'not-an-email' } });
    const res = mkRes();

    await controller.requestPasswordReset(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'email', issue: 'Must be a valid email address' },
    ]);
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('returns success for valid email (regardless of whether account exists)', async () => {
    const req = mkReq({ body: { email: 'user@example.com' } });
    const res = mkRes();
    authService.requestPasswordReset.mockResolvedValue();

    await controller.requestPasswordReset(req, res);

    expect(authService.requestPasswordReset).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { success: true },
      expect.stringContaining('password reset link')
    );
  });
});

// ══════════════════════════════════════════════════════════════
// resetPassword
// ══════════════════════════════════════════════════════════════
describe('resetPassword', () => {
  const validBody = {
    token: 'reset_tok',
    new_password: 'NewPassword1',
    confirm_password: 'NewPassword1',
    logout_all: true,
  };

  it('returns validation error when token missing', async () => {
    const req = mkReq({ body: { ...validBody, token: '' } });
    const res = mkRes();

    await controller.resetPassword(req, res);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'VALIDATION_FAILED',
      'Validation failed',
      400,
      expect.arrayContaining([expect.objectContaining({ field: 'token' })])
    );
  });

  it('returns validation error when passwords do not match', async () => {
    const req = mkReq({ body: { ...validBody, confirm_password: 'DifferentPassword1' } });
    const res = mkRes();

    await controller.resetPassword(req, res);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'VALIDATION_FAILED',
      'Validation failed',
      400,
      expect.arrayContaining([expect.objectContaining({ field: 'confirm_password' })])
    );
  });

  it('returns validation error for weak password', async () => {
    const req = mkReq({ body: { ...validBody, new_password: 'weak', confirm_password: 'weak' } });
    const res = mkRes();

    await controller.resetPassword(req, res);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'VALIDATION_FAILED',
      'Validation failed',
      400,
      expect.arrayContaining([expect.objectContaining({ field: 'new_password' })])
    );
  });

  it('calls service and returns success on valid input', async () => {
    const req = mkReq({ body: validBody });
    const res = mkRes();
    authService.resetPassword.mockResolvedValue();

    await controller.resetPassword(req, res);

    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'reset_tok',
      new_password: 'NewPassword1',
      logout_all: true,
    });
    expect(api.success).toHaveBeenCalledWith(res, { success: true }, expect.any(String));
  });
});

// ══════════════════════════════════════════════════════════════
// resendVerification
// ══════════════════════════════════════════════════════════════
describe('resendVerification', () => {
  it('returns validation error when email missing', async () => {
    const req = mkReq({ body: {} });
    const res = mkRes();

    await controller.resendVerification(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'email', issue: 'Email is required' },
    ]);
  });

  it('calls service with normalized email', async () => {
    const req = mkReq({ body: { email: '  User@Example.COM  ' } });
    const res = mkRes();
    authService.resendVerification.mockResolvedValue();

    await controller.resendVerification(req, res);

    expect(authService.resendVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' })
    );
    expect(api.success).toHaveBeenCalledWith(res, { success: true }, expect.any(String));
  });
});

// ══════════════════════════════════════════════════════════════
// changeEmail
// ══════════════════════════════════════════════════════════════
describe('changeEmail', () => {
  it('returns validation error for invalid new_email', async () => {
    const req = mkReq({ body: { new_email: 'bad-email' }, user: { sub: 'u1' } });
    const res = mkRes();

    await controller.changeEmail(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'new_email', issue: 'Must be a valid email address' },
    ]);
  });

  it('calls service with userId and normalized email', async () => {
    const req = mkReq({ body: { new_email: 'NEW@EXAMPLE.COM' }, user: { sub: 'u1' } });
    const res = mkRes();
    authService.changeEmail.mockResolvedValue();

    await controller.changeEmail(req, res);

    expect(authService.changeEmail).toHaveBeenCalledWith({
      userId: 'u1',
      new_email: 'new@example.com',
    });
    expect(api.success).toHaveBeenCalledWith(res, { success: true }, expect.any(String));
  });
});

// ══════════════════════════════════════════════════════════════
// deleteAccount
// ══════════════════════════════════════════════════════════════
describe('deleteAccount', () => {
  it('returns validation error when password missing', async () => {
    const req = mkReq({ body: {}, user: { sub: 'u1' } });
    const res = mkRes();

    await controller.deleteAccount(req, res);

    expect(api.error).toHaveBeenCalledWith(res, 'VALIDATION_FAILED', 'Validation failed', 400, [
      { field: 'password', issue: 'Password confirmation is required' },
    ]);
    expect(authService.deleteAccount).not.toHaveBeenCalled();
  });

  it('calls service, clears cookies, and returns success', async () => {
    const req = mkReq({
      body: { password: 'Password1' },
      user: { sub: 'u1' },
      cookies: { refreshToken: 'tok' },
    });
    const res = mkRes();
    authService.deleteAccount.mockResolvedValue();

    await controller.deleteAccount(req, res);

    expect(authService.deleteAccount).toHaveBeenCalledWith({ userId: 'u1', password: 'Password1' });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    expect(api.success).toHaveBeenCalledWith(
      res,
      { success: true },
      'Account deleted successfully.'
    );
  });
});
