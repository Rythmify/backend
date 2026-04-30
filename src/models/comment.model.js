const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class CommentModel {
  /**
   * Fetch paginated top-level comments for a track.
   * Uses LEFT JOIN to fetch author info in a single query (Fixes N+1 problem).
   */
  static async getTrackComments(
    trackId,
    limit,
    offset,
    timestampFrom,
    timestampTo,
    sort = 'newest',
    userId = null
  ) {
    let orderByClause = 'c.created_at DESC, c.id DESC';

    if (sort === 'oldest') {
      orderByClause = 'c.created_at ASC, c.id ASC';
    } else if (sort === 'timestamp') {
      orderByClause = 'c.track_timestamp ASC, c.created_at ASC, c.id ASC';
    } else if (sort === 'top') {
      orderByClause = 'c.like_count DESC, c.track_timestamp ASC, c.created_at ASC, c.id ASC';
    }

    const whereConditions = ['c.track_id = $1', 'c.parent_comment_id IS NULL'];
    let paramIndex = 2;
    const params = [trackId];

    // FIX: Cast dynamic parameters to integers
    if (timestampFrom !== null && timestampFrom !== undefined) {
      whereConditions.push(`c.track_timestamp >= $${paramIndex++}::int`);
      params.push(timestampFrom);
    }

    if (timestampTo !== null && timestampTo !== undefined) {
      whereConditions.push(`c.track_timestamp <= $${paramIndex++}::int`);
      params.push(timestampTo);
    }

    const whereClause = whereConditions.join(' AND ');
    const countParams = [...params];
    const mainParams = [...params, userId, limit, offset];
    const userIdParamIndex = mainParams.length - 2;

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
        ) AS author,
        CASE
          WHEN $${userIdParamIndex}::uuid IS NULL THEN false
          ELSE EXISTS (
            SELECT 1
            FROM comment_likes cl
            WHERE cl.comment_id = c.id
              AND cl.user_id = $${userIdParamIndex}::uuid
          )
        END AS is_liked_by_me,
        CASE
          WHEN $${userIdParamIndex}::uuid IS NULL OR c.user_id = $${userIdParamIndex}::uuid THEN false
          ELSE EXISTS (
            SELECT 1
            FROM blocks b
            WHERE b.blocker_id = $${userIdParamIndex}::uuid
              AND b.blocked_id = c.user_id
          )
        END AS is_user_blocked
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${mainParams.length - 1}::int OFFSET $${mainParams.length}::int
    `;

    const result = await db.query(query, mainParams);
    const comments = result.rows;

    const countQuery = `SELECT COUNT(*) as total FROM comments c WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return { comments, total };
  }

  /**
   * Create a new comment.
   */
  static async createComment(userId, trackId, content, trackTimestamp) {
    const commentId = uuidv4();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO comments (id, user_id, track_id, content, track_timestamp, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id AS comment_id, track_id, user_id, parent_comment_id, content, track_timestamp, like_count, reply_count, created_at, updated_at
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
   * Fetch a single comment. Removed deleted_at filter to support Hard Delete.
   */
  static async getComment(commentId, userId = null) {
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
        ) AS author,
        CASE
          WHEN $2::uuid IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2::uuid
          )
        END AS is_liked_by_me
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `;

    const result = await db.query(query, [commentId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Update comment content.
   */
  static async updateComment(commentId, content) {
    const query = `
      UPDATE comments SET content = $1, updated_at = now() WHERE id = $2
      RETURNING id AS comment_id, track_id, user_id, parent_comment_id, content, track_timestamp, like_count, reply_count, created_at, updated_at
    `;
    const result = await db.query(query, [content, commentId]);
    return result.rows[0] || null;
  }

  /**
   * Perform Hard Delete to ensure database triggers for reply_count work correctly.
   */
  static async deleteComment(commentId) {
    const checkQuery = `SELECT parent_comment_id FROM comments WHERE id = $1`;
    const checkResult = await db.query(checkQuery, [commentId]);

    if (checkResult.rows.length === 0) return false;

    const isReply = checkResult.rows[0].parent_comment_id !== null;

    if (isReply) {
      const deleteQuery = `DELETE FROM comments WHERE id = $1 RETURNING id`;
      const result = await db.query(deleteQuery, [commentId]);
      return result.rows.length > 0;
    } else {
      await db.query(`DELETE FROM comments WHERE parent_comment_id = $1`, [commentId]);
      const deleteQuery = `DELETE FROM comments WHERE id = $1 AND parent_comment_id IS NULL RETURNING id`;
      const result = await db.query(deleteQuery, [commentId]);
      return result.rows.length > 0;
    }
  }

  /**
   * Fetch replies for a comment. Uses JOIN to fetch author info efficiently.
   */
  static async getCommentReplies(parentCommentId, limit, offset, userId = null) {
    const parentCheck = await db.query('SELECT parent_comment_id FROM comments WHERE id = $1', [
      parentCommentId,
    ]);
    if (parentCheck.rows.length === 0) throw new Error('COMMENT_NOT_FOUND');
    if (parentCheck.rows[0].parent_comment_id !== null) throw new Error('CANNOT_REPLY_TO_REPLY');

    const query = `
      SELECT
        c.id AS comment_id, c.track_id, c.user_id, c.parent_comment_id, c.content, c.track_timestamp, c.like_count, c.reply_count, c.created_at, c.updated_at,
        json_build_object('user_id', u.id, 'username', u.username, 'email', u.email, 'display_name', u.display_name, 'avatar_url', u.profile_picture) AS author,
        CASE WHEN $4::uuid IS NULL THEN false ELSE EXISTS (SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $4::uuid) END AS is_liked_by_me,
        CASE WHEN $4::uuid IS NULL OR c.user_id = $4::uuid THEN false ELSE EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $4::uuid AND b.blocked_id = c.user_id) END AS is_user_blocked
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.parent_comment_id = $1
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT $2::int OFFSET $3::int
    `;

    const result = await db.query(query, [parentCommentId, limit, offset, userId]);
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM comments WHERE parent_comment_id = $1',
      [parentCommentId]
    );
    return { comments: result.rows, total: parseInt(countResult.rows[0].total, 10) };
  }

  static async createReply(userId, parentCommentId, content) {
    const parentCheck = await db.query(
      'SELECT track_id, parent_comment_id FROM comments WHERE id = $1',
      [parentCommentId]
    );
    if (parentCheck.rows.length === 0) throw new Error('PARENT_COMMENT_NOT_FOUND');
    if (parentCheck.rows[0].parent_comment_id !== null) throw new Error('CANNOT_REPLY_TO_REPLY');

    const trackId = parentCheck.rows[0].track_id;
    const query = `
      INSERT INTO comments (id, user_id, track_id, parent_comment_id, content, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id AS comment_id, track_id, user_id, parent_comment_id, content, track_timestamp, like_count, reply_count, created_at, updated_at
    `;
    const result = await db.query(query, [
      uuidv4(),
      userId,
      trackId,
      parentCommentId,
      content,
      new Date().toISOString(),
    ]);
    return result.rows[0];
  }

  static async checkCommentOwner(commentId, userId) {
    const result = await db.query(`SELECT user_id FROM comments WHERE id = $1`, [commentId]);
    if (!result.rows[0]) return null;
    return result.rows[0].user_id === userId ? result.rows[0] : null;
  }

  static async isCommentLikedByUser(commentId, userId) {
    const result = await db.query(
      `SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId]
    );
    return result.rows.length > 0;
  }
}

module.exports = CommentModel;
