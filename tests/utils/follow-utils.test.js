const followUtils = require('../../src/utils/follow-utils');
const db = require('../../src/config/db');
const AppError = require('../../src/utils/app-error');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

describe('Follow Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateNotSelfFollow', () => {
    it('throws if trying to follow self', () => {
      expect(() => followUtils.validateNotSelfFollow('u1', 'u1')).toThrow(AppError);
    });

    it('does not throw if following someone else', () => {
      expect(() => followUtils.validateNotSelfFollow('u1', 'u2')).not.toThrow();
    });
  });

  describe('validateNotBlocked', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = { query: jest.fn() };
    });

    it('throws if blocked', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      await expect(followUtils.validateNotBlocked(mockClient, 'u1', 'u2')).rejects.toThrow(AppError);
      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), ['u1', 'u2']);
    });

    it('does not throw if not blocked', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      await expect(followUtils.validateNotBlocked(mockClient, 'u1', 'u2')).resolves.toBeUndefined();
    });
  });

  describe('validateUserExists', () => {
    it('throws 404 if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await expect(followUtils.validateUserExists('u1')).rejects.toThrow(AppError);
    });

    it('throws 404 if user is deleted', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1', deleted_at: 'now' }] });
      await expect(followUtils.validateUserExists('u1')).rejects.toThrow(AppError);
    });

    it('returns user if exists and not deleted', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'u1', deleted_at: null }] });
      const user = await followUtils.validateUserExists('u1');
      expect(user).toEqual({ id: 'u1', deleted_at: null });
    });
  });

  describe('getBlockingStatus', () => {
    it('returns blocking status', async () => {
      db.query.mockResolvedValue({ rows: [{ is_blocking: true, is_blocked_by: false }] });
      const status = await followUtils.getBlockingStatus('u1', 'u2');
      expect(status).toEqual({ is_blocking: true, is_blocked_by: false });
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['u1', 'u2']);
    });
  });
  
  describe('BLOCKING_CHECK_SQL', () => {
    it('exports SQL string', () => {
      expect(typeof followUtils.BLOCKING_CHECK_SQL).toBe('string');
    });
  });
});
