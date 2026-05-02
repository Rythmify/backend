/**
 * @fileoverview Unit tests for Appeal Model
 * Coverage Target: 100%
 */

const db = require('../../../src/config/db');
const appealModel = require('../../../src/models/appeal.model');

jest.mock('../../../src/config/db');

describe('Appeal Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAppeal', () => {
    it('should insert a new appeal and return it', async () => {
      const mockAppeal = { id: 'a1', report_id: 'r1', user_id: 'u1', appeal_reason: 'reason', status: 'pending' };
      db.query.mockResolvedValue({ rows: [mockAppeal] });

      const result = await appealModel.createAppeal('r1', 'u1', 'reason');

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO appeals'), ['r1', 'u1', 'reason']);
      expect(result).toEqual(mockAppeal);
    });

    it('should return null if insertion fails (ON CONFLICT)', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await appealModel.createAppeal('r1', 'u1', 'reason');
      expect(result).toBeNull();
    });
  });

  describe('getAppeals', () => {
    it('should fetch appeals with default filters', async () => {
      const mockAppeals = [{ id: 'a1' }, { id: 'a2' }];
      db.query.mockResolvedValue({ rows: mockAppeals });

      const result = await appealModel.getAppeals();

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE 1=1'), ['pending', 20, 0]);
      expect(result).toEqual(mockAppeals);
    });

    it('should fetch appeals with custom filters', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await appealModel.getAppeals({ status: 'upheld', limit: 10, offset: 5 });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('a.status = $1'), ['upheld', 10, 5]);
    });

    it('should handle null status', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await appealModel.getAppeals({ status: null });
      expect(db.query).toHaveBeenCalledWith(expect.not.stringContaining('a.status = $1'), [20, 0]);
    });
  });

  describe('getAppealsCount', () => {
    it('should return the total count of appeals', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '5' }] });
      const result = await appealModel.getAppealsCount({ status: 'pending' });
      expect(result).toBe(5);
    });

    it('should handle null status in count', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '10' }] });
      await appealModel.getAppealsCount({ status: null });
      expect(db.query).toHaveBeenCalledWith(expect.not.stringContaining('status = $1'), []);
    });

    it('should use default status if none provided', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '5' }] });
      await appealModel.getAppealsCount();
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('status = $1'), ['pending']);
    });
  });

  describe('getAppealById', () => {
    it('should return an appeal by its ID', async () => {
      const mockAppeal = { id: 'a1' };
      db.query.mockResolvedValue({ rows: [mockAppeal] });
      const result = await appealModel.getAppealById('a1');
      expect(result).toEqual(mockAppeal);
    });

    it('should return null if appeal not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await appealModel.getAppealById('a1');
      expect(result).toBeNull();
    });
  });

  describe('getAppealByReportId', () => {
    it('should return an appeal by report ID', async () => {
      const mockAppeal = { id: 'a1', report_id: 'r1' };
      db.query.mockResolvedValue({ rows: [mockAppeal] });
      const result = await appealModel.getAppealByReportId('r1');
      expect(result).toEqual(mockAppeal);
    });

    it('should return null if report appeal not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await appealModel.getAppealByReportId('r1');
      expect(result).toBeNull();
    });
  });

  describe('updateAppealDecision', () => {
    it('should update appeal status to upheld', async () => {
      const mockAppeal = { id: 'a1', status: 'upheld' };
      db.query.mockResolvedValue({ rows: [mockAppeal] });
      const result = await appealModel.updateAppealDecision('a1', 'upheld', 'notes', 'admin1');
      expect(result).toEqual(mockAppeal);
    });

    it('should update appeal status to overturned', async () => {
      const mockAppeal = { id: 'a1', status: 'overturned' };
      db.query.mockResolvedValue({ rows: [mockAppeal] });
      const result = await appealModel.updateAppealDecision('a1', 'overturned', 'notes', 'admin1');
      expect(result).toEqual(mockAppeal);
    });

    it('should handle null notes', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'a1' }] });
      await appealModel.updateAppealDecision('a1', 'upheld', null, 'admin1');
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['upheld', 'upheld', null, 'admin1', 'a1']);
    });

    it('should return null if update fails', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await appealModel.updateAppealDecision('a1', 'upheld', 'notes', 'admin1');
      expect(result).toBeNull();
    });
  });

  describe('getPendingAppealsCount', () => {
    it('should return count of pending appeals', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '3' }] });
      const result = await appealModel.getPendingAppealsCount();
      expect(result).toBe(3);
    });
  });

  describe('getAppealsByUser', () => {
    it('should fetch appeals for a specific user with provided pagination', async () => {
      const mockAppeals = [{ id: 'a1' }];
      db.query.mockResolvedValue({ rows: mockAppeals });
      const result = await appealModel.getAppealsByUser('u1', 10, 5);
      expect(result).toEqual(mockAppeals);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), ['u1', 10, 5]);
    });

    it('should fetch appeals for a specific user with default pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await appealModel.getAppealsByUser('u1');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), ['u1', 20, 0]);
    });
  });

  describe('reportHasAppeal', () => {
    it('should return true if appeal exists', async () => {
      db.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      const result = await appealModel.reportHasAppeal('r1');
      expect(result).toBe(true);
    });

    it('should return false if appeal does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await appealModel.reportHasAppeal('r1');
      expect(result).toBe(false);
    });
  });
});
