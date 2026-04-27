// ============================================================
// models/audit-log.model.js — PostgreSQL queries for Audit Logs
// Owner: Alyaa Mohamed (BE-4)
// Records admin actions for accountability and traceability.
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

/**
 * Insert a new audit log entry.
 * Called after every admin action (delete, suspend, resolve, warn).
 * Never throws — audit failures must not break the main action.
 *
 * @param {string} adminId     - UUID of the admin who performed the action
 * @param {string} action      - e.g. 'track_deleted', 'user_suspended'
 * @param {string} targetType  - e.g. 'track', 'user', 'report'
 * @param {string} targetId    - UUID of the affected resource
 * @param {object} metadata    - any extra context (reason, notes, etc.)
 */
exports.createLog = async ({ adminId, action, targetType, targetId, metadata = {} }) => {
  try {
    const { rows } = await db.query(
      `INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, admin_id, action, target_type, target_id, metadata, created_at`,
      [adminId, action, targetType, targetId, JSON.stringify(metadata)]
    );
    return rows[0];
  } catch (err) {
    // Audit log failure must never crash the parent request
    console.error('[AuditLog] Failed to write audit log:', err?.message);
    return null;
  }
};

exports.getLogs = async ({
  limit = 20,
  offset = 0,
  adminId = null,
  action = null,
  targetType = null,
} = {}) => {
  const { rows } = await db.query(
    `SELECT id, admin_id, action, target_type,
            target_id, metadata, created_at
     FROM audit_logs
     WHERE ($1::uuid IS NULL OR admin_id = $1)
       AND ($2::text IS NULL OR action = $2)
       AND ($3::text IS NULL OR target_type = $3)
     ORDER BY created_at DESC
     LIMIT $4 OFFSET $5`,
    [adminId, action, targetType, limit, offset]
  );
  return rows;
};
