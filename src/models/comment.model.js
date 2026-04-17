const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class CommentModel {
  /**
   * Fetch paginated top-level comments for a track.
   * Supports timestamp filtering (waveform flyover) and 4 sorting strategies.
   *
   * Sorting options:
   * - newest: Most recent first (default) => ORDER BY created_at DESC, id DESC
   * - oldest: Oldest first => ORDER BY created_at ASC, id ASC
   * - timestamp: By track position, then creation time => ORDER BY track_timestamp ASC, created_at ASC, id ASC
   * - top: Most-liked first => ORDER BY like_count DESC, track_timestamp ASC, created_at ASC, id ASC
   *
   * Deterministic sorting: ties always broken by created_at + id to prevent comment jumping.
   *
   * @param {string} trackId - Track UUID
   * @param {number} limit - Result limit (1-100)
   * @param {number} offset - Pagination offset
   * @param {number|null} timestampFrom - Min track_timestamp (inclusive)
   * @param {number|null} timestampTo - Max track_timestamp (inclusive)
   * @param {string} sort - Sort strategy (newest|oldest|timestamp|top)
   * @returns {Promise<{comments: Array, total: number}>}
   */
  static async getTrackComments(
    trackId,
    limit,
    offset,
    timestampFrom,
    timestampTo,
    sort = 'newest'
  ) {
    let orderByClause = 'created_at DESC, id DESC'; // default (newest)

    if (sort === 'oldest') {
      orderByClause = 'created_at ASC, id ASC';
    } else if (sort === 'timestamp') {
      orderByClause = 'track_timestamp ASC, created_at ASC, id ASC';
    } else if (sort === 'top') {
      orderByClause = 'like_count DESC, track_timestamp ASC, created_at ASC, id ASC';
    }

    // Build WHERE clause (only top-level comments: parent_comment_id IS NULL)
    const whereConditions = ['track_id = $1', 'parent_comment_id IS NULL', 'deleted_at IS NULL'];
    let paramIndex = 2;
    const params = [trackId];

    if (timestampFrom !== null && timestampFrom !== undefined) {
      whereConditions.push(`track_timestamp >= $${paramIndex++}`);
      params.push(timestampFrom);
    }

    if (timestampTo !== null && timestampTo !== undefined) {
      whereConditions.push(`track_timestamp <= $${paramIndex++}`);
      params.push(timestampTo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get paginated comments
    const query = `
      SELECT
        id AS comment_id,
        track_id,
        user_id,
        parent_comment_id,
        content,
        track_timestamp,
        like_count,
        reply_count,
        created_at,
        updated_at
      FROM comments
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);
    const comments = result.rows;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM comments
      WHERE ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return { comments, total };
  }

  /**
   * Create a new comment on a track.
   *
   * @param {string} userId - Author user UUID
   * @param {string} trackId - Track UUID
   * @param {string} content - Comment text (1-500 chars)
   * @param {number} trackTimestamp - Position in track (seconds)
   * @returns {Promise<{comment_id, track_id, user_id, ...}>}
   */
  static async createComment(userId, trackId, content, trackTimestamp) {
    const commentId = uuidv4();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO comments (
        id, user_id, track_id, content, track_timestamp, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id AS comment_id,
        track_id,
        user_id,
        parent_comment_id,
        content,
        track_timestamp,
        like_count,
        reply_count,
        created_at,
        updated_at
    `;

    const result = await db.query(query, [
      commentId,
      userId,
      trackId,
      content,
      trackTimestamp,
      now,
    ]);

    return result.rows[0];
  }

  /**
   * Fetch a single comment by ID with user profile.
   * Returns null if comment doesn't exist or is soft-deleted.
   *
   * @param {string} commentId - Comment UUID
   * @returns {Promise<{comment_id, user_id, ..., author: {user_id, username, ...}} | null>}
   */
  static async getComment(commentId) {
    const query = `
      SELECT
        c.id AS comment_id,
        c.track_id,
        c.user_id,
        c.parent_comment_id,
        c.content,
        c.track_timestamp,
        c.like_count,
        c.reply_count,
        c.created_at,
        c.updated_at,
        json_build_object(
          'user_id', u.id,
          'username', u.username,
          'email', u.email,
          'display_name', u.display_name,
          'avatar_url', u.profile_picture
        ) AS author
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `;

    const result = await db.query(query, [commentId]);
    return result.rows[0] || null;
  }

  /**
   * Update comment content and set updated_at timestamp.
   * Only comment author can update.
   *
   * @param {string} commentId - Comment UUID
   * @param {string} content - New comment text
   * @returns {Promise<{comment_id, ...} | null>} Returns updated comment or null if not found
   */
  static async updateComment(commentId, content) {
    const query = `
      UPDATE comments
      SET content = $1, updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING
        id AS comment_id,
        track_id,
        user_id,
        parent_comment_id,
        content,
        track_timestamp,
        like_count,
        reply_count,
        created_at,
        updated_at
    `;

    const result = await db.query(query, [content, commentId]);
    return result.rows[0] || null;
  }

  /**
   * Soft-delete a comment (set deleted_at timestamp).
   * Cascade delete of nested replies is handled by database trigger + ON DELETE CASCADE.
   *
   * @param {string} commentId - Comment UUID
   * @returns {Promise<boolean>} True if comment was deleted, false if not found
   */
  static async deleteComment(commentId) {
    // Check if comment is a reply (has parent_comment_id)
    const checkQuery = `
      SELECT parent_comment_id FROM comments WHERE id = $1 AND deleted_at IS NULL
    `;
    const checkResult = await db.query(checkQuery, [commentId]);
    
    if (checkResult.rows.length === 0) {
      return false; // Comment not found or already deleted
    }

    const isReply = checkResult.rows[0].parent_comment_id !== null;

    if (isReply) {
      // Hard DELETE for replies so trigger fires and decrements parent's reply_count
      const deleteQuery = `
        DELETE FROM comments
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `;
      const result = await db.query(deleteQuery, [commentId]);
      return result.rows.length > 0;
    } else {
      // For top-level comments: soft delete the comment AND all its replies
      // First soft-delete all replies (children)
      const deleteRepliesQuery = `
        UPDATE comments
        SET deleted_at = now()
        WHERE parent_comment_id = $1 AND deleted_at IS NULL
      `;
      await db.query(deleteRepliesQuery, [commentId]);

      // Then soft-delete the top-level comment
      const softDeleteQuery = `
        UPDATE comments
        SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL AND parent_comment_id IS NULL
        RETURNING id
      `;
      const result = await db.query(softDeleteQuery, [commentId]);
      return result.rows.length > 0;
    }
  }

  /**
   * Fetch paginated replies to a top-level comment.
   * Replies are always ordered by creation time (oldest first) with id tie-breaker.
   *
   * @param {string} parentCommentId - Parent comment UUID
   * @param {number} limit - Result limit (1-100)
   * @param {number} offset - Pagination offset
   * @returns {Promise<{comments: Array, total: number}>}
   */
  static async getCommentReplies(parentCommentId, limit, offset) {
    // First, verify parent comment exists and is a top-level comment (not a reply)
    const parentCheck = await db.query(
      'SELECT parent_comment_id FROM comments WHERE id = $1 AND deleted_at IS NULL',
      [parentCommentId]
    );

    if (parentCheck.rows.length === 0) {
      throw new Error('COMMENT_NOT_FOUND');
    }

    if (parentCheck.rows[0].parent_comment_id !== null) {
      throw new Error('CANNOT_REPLY_TO_REPLY');
    }

    // Get paginated replies (ordered by creation time, then id)
    const query = `
      SELECT
        id AS comment_id,
        track_id,
        user_id,
        parent_comment_id,
        content,
        track_timestamp,
        like_count,
        reply_count,
        created_at,
        updated_at
      FROM comments
      WHERE parent_comment_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [parentCommentId, limit, offset]);
    const comments = result.rows;

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM comments WHERE parent_comment_id = $1 AND deleted_at IS NULL',
      [parentCommentId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return { comments, total };
  }

  /**
   * Create a reply to a top-level comment.
   * The reply_count of parent comment is incremented by database trigger.
   *
   * @param {string} userId - Author user UUID
   * @param {string} parentCommentId - Parent comment UUID (top-level only)
   * @param {string} content - Reply text (1-500 chars)
   * @returns {Promise<{comment_id, ...}>}
   */
  static async createReply(userId, parentCommentId, content) {
    // Verify parent comment exists and is a top-level comment
    const parentCheck = await db.query(
      'SELECT track_id, parent_comment_id FROM comments WHERE id = $1 AND deleted_at IS NULL',
      [parentCommentId]
    );

    if (parentCheck.rows.length === 0) {
      throw new Error('PARENT_COMMENT_NOT_FOUND');
    }

    if (parentCheck.rows[0].parent_comment_id !== null) {
      throw new Error('CANNOT_REPLY_TO_REPLY');
    }

    const trackId = parentCheck.rows[0].track_id;
    const replyId = uuidv4();
    const now = new Date().toISOString();

    // Insert reply with parent_comment_id set
    const query = `
      INSERT INTO comments (
        id, user_id, track_id, parent_comment_id, content, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id AS comment_id,
        track_id,
        user_id,
        parent_comment_id,
        content,
        track_timestamp,
        like_count,
        reply_count,
        created_at,
        updated_at
    `;

    const result = await db.query(query, [replyId, userId, trackId, parentCommentId, content, now]);

    return result.rows[0];
  }

  /**
   * Check if a comment exists and verify ownership.
   *
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID to verify ownership
   * @returns {Promise<{user_id: string, deleted_at: Date|null} | null>}
   */
  static async checkCommentOwner(commentId, userId) {
    const query = `
      SELECT user_id, deleted_at
      FROM comments
      WHERE id = $1
    `;

    const result = await db.query(query, [commentId]);
    const comment = result.rows[0];

    if (!comment) return null;
    if (comment.deleted_at) return null; // Comment is soft-deleted

    return comment.user_id === userId ? comment : null;
  }

  /**
   * Check if a user has liked a comment.
   *
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  static async isCommentLikedByUser(commentId, userId) {
    const query = `
      SELECT 1
      FROM comment_likes
      WHERE comment_id = $1 AND user_id = $2
      LIMIT 1
    `;

    const result = await db.query(query, [commentId, userId]);
    return result.rows.length > 0;
  }
}

module.exports = CommentModel;
