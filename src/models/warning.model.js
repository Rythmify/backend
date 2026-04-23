// ============================================================
// models/warning.model.js — PostgreSQL queries for Warnings
// Entity: id, user_id, admin_id, reason, message, warning_count, created_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

/**
 * Create a new warning for a user
 */
exports.createWarning = async (userId, adminId, reason, message) => {
  const { rows } = await db.query(
    `INSERT INTO warnings (
       user_id,
       admin_id,
       reason,
       message,
       warning_count,
       created_at
     )
     VALUES ($1, $2, $3, $4, 1, now())
     RETURNING *`,
    [userId, adminId, reason, message || null]
  );
  return rows[0] || null;
};

/**
 * Get all warnings for a specific user
 */
exports.getWarningsByUser = async (userId, limit = 50, offset = 0) => {
  const { rows } = await db.query(
    `SELECT 
       w.*,
       admin.display_name as admin_name,
       admin.email as admin_email
     FROM warnings w
     JOIN users admin ON w.admin_id = admin.id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
};

/**
 * Get total count of warnings for a user
 */
exports.getWarningsCount = async (userId) => {
  const { rows } = await db.query(`SELECT COUNT(*) as total FROM warnings WHERE user_id = $1`, [
    userId,
  ]);
  return parseInt(rows[0].total, 10);
};

/**
 * Get the latest warning for a user (most recent)
 */
exports.getLatestWarning = async (userId) => {
  const { rows } = await db.query(
    `SELECT 
       w.*,
       admin.display_name as admin_name
     FROM warnings w
     JOIN users admin ON w.admin_id = admin.id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Get cumulative warning count for a user
 */
exports.getUserTotalWarningCount = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*) as total_warnings FROM warnings WHERE user_id = $1`,
    [userId]
  );
  return parseInt(rows[0].total_warnings, 10);
};

/**
 * Get a single warning by ID
 */
exports.getWarningById = async (warningId) => {
  const { rows } = await db.query(
    `SELECT 
       w.*,
       u.display_name as user_name,
       admin.display_name as admin_name
     FROM warnings w
     JOIN users u ON w.user_id = u.id
     JOIN users admin ON w.admin_id = admin.id
     WHERE w.id = $1`,
    [warningId]
  );
  return rows[0] || null;
};
