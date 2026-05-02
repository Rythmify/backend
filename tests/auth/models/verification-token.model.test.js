// ============================================================
// tests/auth/models/verification-token.model.test.js
// Coverage Target: 100% (Focus on missed branches)
// ============================================================

const verificationTokenModel = require('../../../src/models/verification-token.model');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db');

describe('Verification Token Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('returns the created token', async () => {
      const mockToken = { id: 1, user_id: 'u1', token: 'abc' };
      db.query.mockResolvedValueOnce({ rows: [mockToken] });
      const result = await verificationTokenModel.create({ user_id: 'u1', token: 'abc', type: 'email', expires_at: new Date() });
      expect(result).toEqual(mockToken);
    });
  });

  describe('findValidToken', () => {
    it('returns the token if found', async () => {
      const mockToken = { id: 1, token: 'abc' };
      db.query.mockResolvedValueOnce({ rows: [mockToken] });
      const result = await verificationTokenModel.findValidToken('abc', 'email');
      expect(result).toEqual(mockToken);
    });

    it('returns null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await verificationTokenModel.findValidToken('abc', 'email');
      expect(result).toBeNull();
    });
  });

  describe('markUsed', () => {
    it('executes update query', async () => {
      db.query.mockResolvedValueOnce({});
      await verificationTokenModel.markUsed(1);
      expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE verification_tokens/i), [1]);
    });
  });

  describe('revokeAllForUser', () => {
    it('executes update query', async () => {
      db.query.mockResolvedValueOnce({});
      await verificationTokenModel.revokeAllForUser('u1', 'email');
      expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE verification_tokens/i), ['u1', 'email']);
    });
  });
});
