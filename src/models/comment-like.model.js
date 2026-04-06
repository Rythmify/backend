// ============================================================
// models/comment-like.model.js
// Owner: Beshoy Maher (BE-3)
// All database queries for comment likes functionality
// Uses transactions for data consistency
// ============================================================

const db = require('../config/db');
const AppError = require('../utils/app-error');

// ===== GET QUERIES =====

/**
 * Check if user already likes a comment
 * Returns: like_id (uuid) if exists, false otherwise
 */
exports.checkCommentLike = async (userId, commentId) => {
  const query = `
    SELECT id FROM comment_likes 
    WHERE user_id = $1 AND comment_id = $2
  `;
  const { rows } = await db.query(query, [userId, commentId]);
  return rows[0]?.id || false;
};

// ===== CREATE QUERIES =====

/**
 * Create a like on a comment (idempotent)
 * Returns: { created: true, like_id } if newly created
 * Returns: { created: false, like_id } if already existed
 */
exports.likeComment = async (userId, commentId) => {
  // Verify comment exists and is not deleted
  const commentCheck = await db.query(
    'SELECT id FROM comments WHERE id = $1 AND deleted_at IS NULL',
    [commentId]
  );
  if (!commentCheck.rows.length) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  try {
    // Try to insert new like (will fail if already exists due to unique constraint)
    const query = `
      INSERT INTO comment_likes (user_id, comment_id)
      VALUES ($1, $2)
      RETURNING id, user_id, comment_id, created_at
    `;
    const { rows } = await db.query(query, [userId, commentId]);
    return { created: true, like: rows[0] };
  } catch (err) {
    // Unique constraint violation = already liked
    if (err.code === '23505') {
      // Get existing like
      const query = `
        SELECT id, user_id, comment_id, created_at 
        FROM comment_likes 
        WHERE user_id = $1 AND comment_id = $2
      `;
      const { rows } = await db.query(query, [userId, commentId]);
      return { created: false, like: rows[0] };
    }
    throw err;
  }
};

// ===== DELETE QUERIES =====

/**
 * Remove a like from a comment
 * Returns: true if deleted, false if not found
 */
exports.unlikeComment = async (userId, commentId) => {
  // Verify comment exists
  const commentCheck = await db.query(
    'SELECT id FROM comments WHERE id = $1',
    [commentId]
  );
  if (!commentCheck.rows.length) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  const query = `
    DELETE FROM comment_likes 
    WHERE user_id = $1 AND comment_id = $2
    RETURNING id
  `;
  const { rows } = await db.query(query, [userId, commentId]);

  return rows.length > 0; // true if deleted, false if not found
};

// ===== COUNT QUERIES =====

/**
 * Get total like count for a comment
 */
exports.getCommentLikeCount = async (commentId) => {
  const query = `
    SELECT COUNT(*) as like_count FROM comment_likes 
    WHERE comment_id = $1
  `;
  const { rows } = await db.query(query, [commentId]);
  return parseInt(rows[0].like_count);
};

/**
 * Check if current user likes a comment (for response decoration)
 */
exports.isCommentLikedByUser = async (userId, commentId) => {
  if (!userId) return false; // Not authenticated
  
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM comment_likes 
      WHERE user_id = $1 AND comment_id = $2
    ) as is_liked
  `;
  const { rows } = await db.query(query, [userId, commentId]);
  return rows[0].is_liked;
};
