/**
 * @fileoverview Unit tests for Report Model
 * Coverage Target: 100%
 */

const db = require('../../../src/config/db');
const reportModel = require('../../../src/models/report.model');

jest.mock('../../../src/config/db');

describe('Report Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReport', () => {
    it('should insert a new report and return it', async () => {
      const mockReport = { id: 'r1', reporter_id: 'u1', resource_type: 'track', resource_id: 't1' };
      db.query.mockResolvedValue({ rows: [mockReport] });

      const result = await reportModel.createReport('u1', 'track', 't1', 'spam', 'desc');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reports'),
        ['u1', 'track', 't1', 'spam', 'desc']
      );
      expect(result).toEqual(mockReport);
    });

    it('should handle null description', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'r1' }] });
      await reportModel.createReport('u1', 'track', 't1', 'spam', null);
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['u1', 'track', 't1', 'spam', null]);
    });

    it('should return null if insertion fails (ON CONFLICT)', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await reportModel.createReport('u1', 'track', 't1', 'spam');
      expect(result).toBeNull();
    });
  });

  describe('getReports', () => {
    it('should fetch reports with default filters', async () => {
      const mockReports = [{ id: 'r1' }];
      db.query.mockResolvedValue({ rows: mockReports });

      const result = await reportModel.getReports();

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE 1=1'), [20, 0]);
      expect(result).toEqual(mockReports);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await reportModel.getReports({ status: 'pending' });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('r.status = $1'), ['pending', 20, 0]);
    });

    it('should filter by reason and status', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await reportModel.getReports({ status: 'resolved', reason: 'spam' });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('r.status = $1 AND r.reason = $2'),
        ['resolved', 'spam', 20, 0]
      );
    });
  });

  describe('getReportsCount', () => {
    it('should return the total count of reports', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '5' }] });
      const result = await reportModel.getReportsCount();
      expect(result).toBe(5);
    });

    it('should filter count by status and reason', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '2' }] });
      await reportModel.getReportsCount({ status: 'pending', reason: 'spam' });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1 AND reason = $2'),
        ['pending', 'spam']
      );
    });

    it('should handle just status in count', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '1' }] });
      await reportModel.getReportsCount({ status: 'pending' });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('status = $1'), ['pending']);
    });

    it('should handle just reason in count', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '1' }] });
      await reportModel.getReportsCount({ reason: 'spam' });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('reason = $1'), ['spam']);
    });
  });

  describe('getReportById', () => {
    it('should return a report by its ID', async () => {
      const mockReport = { id: 'r1' };
      db.query.mockResolvedValue({ rows: [mockReport] });
      const result = await reportModel.getReportById('r1');
      expect(result).toEqual(mockReport);
    });

    it('should return null if report not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await reportModel.getReportById('r1');
      expect(result).toBeNull();
    });
  });

  describe('updateReportStatus', () => {
    it('should update report status and return it', async () => {
      const mockReport = { id: 'r1', status: 'resolved' };
      db.query.mockResolvedValue({ rows: [mockReport] });

      const result = await reportModel.updateReportStatus('r1', 'resolved', 'notes', 'admin1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reports'),
        ['resolved', 'notes', 'admin1', 'r1']
      );
      expect(result).toEqual(mockReport);
    });

    it('should return null if update fails', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await reportModel.updateReportStatus('r1', 'resolved', null, 'admin1');
      expect(result).toBeNull();
    });
  });

  describe('getReportsByResource', () => {
    it('should fetch reports for a specific resource', async () => {
      const mockReports = [{ id: 'r1' }];
      db.query.mockResolvedValue({ rows: mockReports });
      const result = await reportModel.getReportsByResource('track', 't1');
      expect(result).toEqual(mockReports);
    });
  });

  describe('hasUserReported', () => {
    it('should return true if report exists', async () => {
      db.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      const result = await reportModel.hasUserReported('u1', 'track', 't1');
      expect(result).toBe(true);
    });

    it('should return false if report does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await reportModel.hasUserReported('u1', 'track', 't1');
      expect(result).toBe(false);
    });
  });

  describe('getPendingReportsCount', () => {
    it('should return count of pending reports', async () => {
      db.query.mockResolvedValue({ rows: [{ total: '12' }] });
      const result = await reportModel.getPendingReportsCount();
      expect(result).toBe(12);
    });
  });

  describe('getReportsByReporter', () => {
    it('should fetch reports submitted by a user with default pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await reportModel.getReportsByReporter('u1');
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['u1', 20, 0]);
    });
  });
});
