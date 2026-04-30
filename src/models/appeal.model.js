// ============================================================
// models/appeal.model.js — PostgreSQL queries for Appeals
// Entity: id, report_id, user_id, appeal_reason, status, admin_notes, decided_by, decision, decided_at, created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

/**
 * Create a new appeal for a report
 */
exports.createAppeal = async (reportId, userId, appealReason) => {
  const { rows } = await db.query(
    `INSERT INTO appeals (
       report_id,
       user_id,
       appeal_reason,
       status,
       created_at
     )
     VALUES ($1, $2, $3, 'pending', now())
     ON CONFLICT (report_id) DO NOTHING
     RETURNING *`,
    [reportId, userId, appealReason]
  );
  return rows[0] || null;
};

/**
 * Get all appeals with optional filters
 */
exports.getAppeals = async ({ status = 'pending', limit = 20, offset = 0 } = {}) => {
  let query = `
    SELECT 
      a.*,
      r.id as report_id,
      r.reason as report_reason,
      r.resource_type,
      r.resource_id,
      u.display_name as user_name,
      u.email as user_email,
      admin.display_name as decided_by_name
    FROM appeals a
    JOIN reports r ON a.report_id = r.id
    JOIN users u ON a.user_id = u.id
    LEFT JOIN users admin ON a.decided_by = admin.id
    WHERE 1=1
  `;
  const values = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    query += ` AND a.status = $${paramCount}`;
    values.push(status);
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  values.push(limit, offset);

  const { rows } = await db.query(query, values);
  return rows;
};

/**
 * Get total count of appeals (for pagination)
 */
exports.getAppealsCount = async ({ status = 'pending' } = {}) => {
  let query = `SELECT COUNT(*) as total FROM appeals WHERE 1=1`;
  const values = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    values.push(status);
  }

  const { rows } = await db.query(query, values);
  return parseInt(rows[0].total, 10);
};

/**
 * Get a single appeal by ID with full details
 */
exports.getAppealById = async (appealId) => {
  const { rows } = await db.query(
    `SELECT 
       a.*,
       r.reason as report_reason,
       r.resource_type,
       r.resource_id,
       r.status as report_status,
       u.display_name as user_name,
       u.email as user_email,
       admin.display_name as decided_by_name
     FROM appeals a
     JOIN reports r ON a.report_id = r.id
     JOIN users u ON a.user_id = u.id
     LEFT JOIN users admin ON a.decided_by = admin.id
     WHERE a.id = $1`,
    [appealId]
  );
  return rows[0] || null;
};

/**
 * Get appeal by report ID
 */
exports.getAppealByReportId = async (reportId) => {
  const { rows } = await db.query(`SELECT * FROM appeals WHERE report_id = $1`, [reportId]);
  return rows[0] || null;
};

/**
 * Update appeal with admin decision
 */
exports.updateAppealDecision = async (appealId, decision, adminNotes, decidedByUserId) => {
  const status = decision === 'upheld' ? 'upheld' : 'overturned';
  const { rows } = await db.query(
    `UPDATE appeals 
     SET 
       status = $1,
       decision = $2,
       admin_notes = $3,
       decided_by = $4,
       decided_at = now()
     WHERE id = $5
     RETURNING *`,
    [status, decision, adminNotes || null, decidedByUserId, appealId]
  );
  return rows[0] || null;
};

/**
 * Get pending appeals count (for admin dashboard)
 */
exports.getPendingAppealsCount = async () => {
  const { rows } = await db.query(`SELECT COUNT(*) as total FROM appeals WHERE status = 'pending'`);
  return parseInt(rows[0].total, 10);
};

/**
 * Get appeals by user (user's own appeals)
 */
exports.getAppealsByUser = async (userId, limit = 20, offset = 0) => {
  const { rows } = await db.query(
    `SELECT 
       a.*,
       r.reason as report_reason,
       r.resource_type,
       r.resource_id
     FROM appeals a
     JOIN reports r ON a.report_id = r.id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
};

/**
 * Check if report has an appeal already
 */
exports.reportHasAppeal = async (reportId) => {
  const { rows } = await db.query(`SELECT 1 FROM appeals WHERE report_id = $1 LIMIT 1`, [reportId]);
  return rows.length > 0;
};
