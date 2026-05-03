const { authenticate, optionalAuthenticate } = require('../../src/middleware/auth');
const { error } = require('../../src/utils/api-response');
const { verifyToken } = require('../../src/config/jwt');
const userModel = require('../../src/models/user.model');

jest.mock('../../src/utils/api-response', () => ({
  error: jest.fn(),
}));
jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));
jest.mock('../../src/models/user.model');

describe('auth middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = jest.fn();
    error.mockReset();
    verifyToken.mockReset();
    userModel.findById.mockReset();
  });

  describe('authenticate', () => {
    it('rejects missing authorization header', async () => {
      await authenticate(req, res, next);

      expect(error).toHaveBeenCalledWith(
        res,
        'AUTH_TOKEN_MISSING',
        'Authorization header missing',
        401
      );
    });

    it('rejects invalid bearer tokens', async () => {
      req.headers.authorization = 'Bearer bad-token';
      verifyToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      await authenticate(req, res, next);

      expect(error).toHaveBeenCalledWith(
        res,
        'AUTH_TOKEN_INVALID',
        'Invalid or expired access token',
        401
      );
    });

    it('rejects when the user no longer exists', async () => {
      req.headers.authorization = 'Bearer access-token';
      verifyToken.mockReturnValue({ sub: 'u1', role: 'listener' });
      userModel.findById.mockResolvedValue(null);

      await authenticate(req, res, next);

      expect(error).toHaveBeenCalledWith(
        res,
        'AUTH_USER_NOT_FOUND',
        'User account no longer exists',
        401
      );
      expect(next).not.toHaveBeenCalled();
    });


    it('attaches req.user and calls next for a valid active session', async () => {
      req.headers.authorization = 'Bearer access-token';
      verifyToken.mockReturnValue({ sub: 'u1', role: 'listener' });
      userModel.findById.mockResolvedValue({ id: 'u1', is_suspended: false });

      await authenticate(req, res, next);

      expect(req.user).toEqual({ sub: 'u1', role: 'listener' });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('optionalAuthenticate', () => {
    it('sets req.user to null when there is no bearer token', async () => {
      await optionalAuthenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('drops invalid tokens and continues anonymously', async () => {
      req.headers.authorization = 'Bearer bad-token';
      verifyToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      await optionalAuthenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('keeps req.user null when the user is missing or suspended', async () => {
      req.headers.authorization = 'Bearer access-token';
      verifyToken.mockReturnValue({ sub: 'u1', role: 'listener' });
      userModel.findById.mockResolvedValue({ id: 'u1', is_suspended: true });

      await optionalAuthenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('populates req.user when the token belongs to an active user', async () => {
      req.headers.authorization = 'Bearer access-token';
      verifyToken.mockReturnValue({ sub: 'u1', role: 'listener' });
      userModel.findById.mockResolvedValue({ id: 'u1', is_suspended: false });

      await optionalAuthenticate(req, res, next);

      expect(req.user).toEqual({ sub: 'u1', role: 'listener' });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
