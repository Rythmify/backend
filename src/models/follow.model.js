const db = require('../config/db');

exports.getFollowing = async (userId, limit, offset) => {
  const query = `
    SELECT u.id, u.display_name, u.username, u.profile_picture 
    FROM followers f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1
    ORDER BY u.display_name ASC
    LIMIT $2 OFFSET $3
    `;
  const { rows } = await db.query(query, [userId, limit, offset]);
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM followers WHERE follower_id = $1
    `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);
  
  return { items: rows, total, limit, offset };
};

exports.getFollowers = async (userId, limit, offset) => {
  const query = `
    SELECT u.id, u.display_name, u.username, u.profile_picture
    FROM followers f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = $1
    ORDER BY u.display_name ASC
    LIMIT $2 OFFSET $3
    `;
  const { rows } = await db.query(query, [userId, limit, offset]);
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total FROM followers WHERE following_id = $1
    `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);
  
  return { items: rows, total, limit, offset };
};

exports.searchMyFollowing = async (userId, query, limit, offset) => {
  const searchQuery = `
    SELECT u.id, u.display_name, u.username, u.profile_picture
    FROM followers f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 AND (u.display_name ILIKE $2 OR u.username ILIKE $2)
    ORDER BY u.display_name ASC
    LIMIT $3 OFFSET $4
    `;
  const { rows } = await db.query(searchQuery, [userId, `%${query}%`, limit, offset]);
  
  // Get total count for search results
  const countQuery = `
    SELECT COUNT(*) as total FROM followers f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 AND (u.display_name ILIKE $2 OR u.username ILIKE $2)
    `;
  const { rows: countRows } = await db.query(countQuery, [userId, `%${query}%`]);
  const total = parseInt(countRows[0].total);
  
  return { items: rows, total, query };
};

exports.getSuggestedUsers = async (userId, limit, offset) => {
  const query = `
    SELECT DISTINCT u.id, u.display_name, u.username, u.profile_picture, u.followers_count
    FROM users u
    WHERE u.id != $1
      AND u.id NOT IN (
        SELECT following_id FROM followers WHERE follower_id = $1
      )
      AND u.deleted_at IS NULL
    ORDER BY u.followers_count DESC
    LIMIT $2 OFFSET $3
    `;
  const { rows } = await db.query(query, [userId, limit, offset]);
  
  // Get total count
  const countQuery = `
    SELECT COUNT(DISTINCT u.id) as total FROM users u
    WHERE u.id != $1
      AND u.id NOT IN (
        SELECT following_id FROM followers WHERE follower_id = $1
      )
      AND u.deleted_at IS NULL
    `;
  const { rows: countRows } = await db.query(countQuery, [userId]);
  const total = parseInt(countRows[0].total);
  
  return { items: rows, total, limit, offset };
};

exports.getFollowStatus = async (userId, targetUserId) => {
  const followingQuery = `
    SELECT 1 FROM followers 
    WHERE follower_id = $1 AND following_id = $2
  `;
  const { rows: followingRows } = await db.query(followingQuery, [userId, targetUserId]);
  const isFollowing = followingRows.length > 0;

  const followedByQuery = `
    SELECT 1 FROM followers 
    WHERE follower_id = $1 AND following_id = $2
  `;
  const { rows: followedByRows } = await db.query(followedByQuery, [targetUserId, userId]);
  const isFollowedBy = followedByRows.length > 0;

  const blockingQuery = `
    SELECT 1 FROM blocks 
    WHERE blocker_id = $1 AND blocked_id = $2
  `;
  const { rows: blockingRows } = await db.query(blockingQuery, [userId, targetUserId]);
  const isBlocking = blockingRows.length > 0;

  const blockedByQuery = `
    SELECT 1 FROM blocks 
    WHERE blocker_id = $1 AND blocked_id = $2
  `;
  const { rows: blockedByRows } = await db.query(blockedByQuery, [targetUserId, userId]);
  const isBlockedBy = blockedByRows.length > 0;

  return {
    is_following: isFollowing,
    is_followed_by: isFollowedBy,
    is_blocking: isBlocking,
    is_blocked_by: isBlockedBy
  };
};
