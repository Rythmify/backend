// ============================================================
// tests/admin/models/warning.model.test.js
// Coverage Target: 100% (Focus on missed branches)
// ============================================================

const warningModel = require('../../../src/models/warning.model');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db');

describe('Warning Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWarning', () => {
    it('returns the created warning', async () => {
      const mockWarning = { id: 1, user_id: 'u1' };
      db.query.mockResolvedValueOnce({ rows: [mockWarning] });
      const result = await warningModel.createWarning('u1', 'a1', 'reason', 'message');
      expect(result).toEqual(mockWarning);
    });

    it('returns null if insert failed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await warningModel.createWarning('u1', 'a1', 'reason', 'message');
      expect(result).toBeNull();
    });

    it('handles null message', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await warningModel.createWarning('u1', 'a1', 'reason', null);
        expect(db.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([null]));
    });
  });

  describe('getWarningsByUser', () => {
    it('returns array of warnings', async () => {
      const mockRows = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValueOnce({ rows: mockRows });
      const result = await warningModel.getWarningsByUser('u1');
      expect(result).toEqual(mockRows);
    });
  });

  describe('getWarningsCount', () => {
    it('returns parsed integer count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
      const result = await warningModel.getWarningsCount('u1');
      expect(result).toBe(5);
    });
  });

  describe('getLatestWarning', () => {
    it('returns latest warning if found', async () => {
      const mockWarning = { id: 2 };
      db.query.mockResolvedValueOnce({ rows: [mockWarning] });
      const result = await warningModel.getLatestWarning('u1');
      expect(result).toEqual(mockWarning);
    });

    it('returns null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await warningModel.getLatestWarning('u1');
      expect(result).toBeNull();
    });
  });

  describe('getUserTotalWarningCount', () => {
    it('returns parsed integer count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total_warnings: '3' }] });
      const result = await warningModel.getUserTotalWarningCount('u1');
      expect(result).toBe(3);
    });
  });

  describe('getWarningById', () => {
    it('returns warning if found', async () => {
      const mockWarning = { id: 1 };
      db.query.mockResolvedValueOnce({ rows: [mockWarning] });
      const result = await warningModel.getWarningById(1);
      expect(result).toEqual(mockWarning);
    });

    it('returns null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await warningModel.getWarningById(1);
      expect(result).toBeNull();
    });
  });
});
