/**
 * @fileoverview Unit tests for Audit Log Model
 * Coverage Target: >95%
 */

const db = require('../../../src/config/db');
const auditLogModel = require('../../../src/models/audit-log.model');

jest.mock('../../../src/config/db');

describe('Audit Log Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('createLog', () => {
    it('should insert a new audit log and return it', async () => {
      const mockLog = { id: 'l1', admin_id: 'a1', action: 'delete' };
      db.query.mockResolvedValue({ rows: [mockLog] });

      const result = await auditLogModel.createLog({
        adminId: 'a1',
        action: 'delete',
        targetType: 'track',
        targetId: 't1',
        metadata: { reason: 'spam' }
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        ['a1', 'delete', 'track', 't1', JSON.stringify({ reason: 'spam' })]
      );
      expect(result).toEqual(mockLog);
    });

    it('should handle missing metadata', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'l1' }] });
      await auditLogModel.createLog({ adminId: 'a1', action: 'delete', targetType: 'track', targetId: 't1' });
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['a1', 'delete', 'track', 't1', '{}']);
    });

    it('should log error and return null if query fails', async () => {
      const dbError = new Error('DB Fail');
      db.query.mockRejectedValue(dbError);

      const result = await auditLogModel.createLog({ adminId: 'a1', action: 'delete' });

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('[AuditLog] Failed to write audit log:', 'DB Fail');
    });

    it('should handle error without message', async () => {
      db.query.mockRejectedValue({});
      const result = await auditLogModel.createLog({ adminId: 'a1' });
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('[AuditLog] Failed to write audit log:', undefined);
    });
  });

  describe('getLogs', () => {
    it('should fetch logs with default filters', async () => {
      const mockLogs = [{ id: 'l1' }];
      db.query.mockResolvedValue({ rows: mockLogs });

      const result = await auditLogModel.getLogs();

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [null, null, null, 20, 0]);
      expect(result).toEqual(mockLogs);
    });

    it('should fetch logs with custom filters', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await auditLogModel.getLogs({ adminId: 'a1', action: 'suspend', targetType: 'user', limit: 50, offset: 10 });
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['a1', 'suspend', 'user', 50, 10]);
    });
  });
});
