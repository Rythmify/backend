// ============================================================
// models/report.model.js — PostgreSQL queries for Reports
// Entity: id, reporter_id, resource_type, resource_id, reason, description, status, resolved_by, admin_note, resolved_at, created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

/**
 * Create a new report submitted by a user
 */
exports.createReport = async (reporterUserId, resourceType, resourceId, reason, description) => {
  const { rows } = await db.query(
    `INSERT INTO reports (
       reporter_id,
       resource_type,
       resource_id,
       reason,
       description,
       status,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, 'pending', now())
     ON CONFLICT (reporter_id, resource_type, resource_id) DO NOTHING
     RETURNING *`,
    [reporterUserId, resourceType, resourceId, reason, description || null]
  );
  return rows[0] || null;
};

/**
 * Get all reports with optional filters
 */
exports.getReports = async ({ status, reason, limit = 20, offset = 0 } = {}) => {
  let query = `
    SELECT 
      r.*,
      u.display_name as reported_by_name,
      u.email as reported_by_email
    FROM reports r
    JOIN users u ON r.reporter_id = u.id
    WHERE 1=1
  `;
  const values = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    query += ` AND r.status = $${paramCount}`;
    values.push(status);
  }

  if (reason) {
    paramCount++;
    query += ` AND r.reason = $${paramCount}`;
    values.push(reason);
  }

  query += ` ORDER BY r.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  values.push(limit, offset);

  const { rows } = await db.query(query, values);
  return rows;
};

/**
 * Get total count of reports (for pagination)
 */
exports.getReportsCount = async ({ status, reason } = {}) => {
  let query = `SELECT COUNT(*) as total FROM reports WHERE 1=1`;
  const values = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    values.push(status);
  }

  if (reason) {
    paramCount++;
    query += ` AND reason = $${paramCount}`;
    values.push(reason);
  }

  const { rows } = await db.query(query, values);
  return parseInt(rows[0].total, 10);
};

/**
 * Get a single report by ID with full details
 */
exports.getReportById = async (reportId) => {
  const { rows } = await db.query(
    `SELECT 
       r.*,
       u.display_name as reported_by_name,
       u.email as reported_by_email,
       admin.display_name as resolved_by_name
     FROM reports r
     JOIN users u ON r.reporter_id = u.id
     LEFT JOIN users admin ON r.resolved_by = admin.id
     WHERE r.id = $1`,
    [reportId]
  );
  return rows[0] || null;
};

/**
 * Update report status and add admin notes
 */
exports.updateReportStatus = async (reportId, status, adminNote, adminUserId) => {
  const { rows } = await db.query(
    `UPDATE reports 
     SET 
       status = $1,
       admin_note = $2,
       resolved_by = $3,
       resolved_at = now()
     WHERE id = $4
     RETURNING *`,
    [status, adminNote || null, adminUserId, reportId]
  );
  return rows[0] || null;
};

/**
 * Get reports for a specific resource (e.g., all reports for a track)
 */
exports.getReportsByResource = async (resourceType, resourceId) => {
  const { rows } = await db.query(
    `SELECT 
       r.*,
       u.display_name as reported_by_name
     FROM reports r
     JOIN users u ON r.reporter_id = u.id
     WHERE r.resource_type = $1 AND r.resource_id = $2
     ORDER BY r.created_at DESC`,
    [resourceType, resourceId]
  );
  return rows;
};

/**
 * Check if user already reported this resource
 */
exports.hasUserReported = async (userId, resourceType, resourceId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM reports 
     WHERE reporter_id = $1 AND resource_type = $2 AND resource_id = $3
     LIMIT 1`,
    [userId, resourceType, resourceId]
  );
  return rows.length > 0;
};

/**
 * Get pending reports count (for admin dashboard)
 */
exports.getPendingReportsCount = async () => {
  const { rows } = await db.query(`SELECT COUNT(*) as total FROM reports WHERE status = 'pending'`);
  return parseInt(rows[0].total, 10);
};

/**
 * Get reports by reporter (user's own submissions)
 */
exports.getReportsByReporter = async (userId, limit = 20, offset = 0) => {
  const { rows } = await db.query(
    `SELECT *
     FROM reports
     WHERE reporter_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
};
