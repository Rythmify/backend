// ============================================================
// controllers/followers.controller.js
// Owner : Beshoy Maher (BE-3)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const followersService = require('../services/followers.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

exports.getFollowing = async (req, res) => {
  const userId = req.params.user_id;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const result = await followersService.getFollowing(userId, limit, offset);
  
  // Format response as UserListResponse with items and meta
  const responseData = {
    items: result.items,
    meta: {
      limit: result.limit,
      offset: result.offset,
      total: result.total
    }
  };
  
  return success(res, responseData, 'Following list returned successfully.', 200);
}

exports.getFollowers = async (req, res) => {
  const userId = req.params.user_id;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const result = await followersService.getFollowers(userId, limit, offset);
  
  // Format response as UserListResponse with items and meta
  const responseData = {
    items: result.items,
    meta: {
      limit: result.limit,
      offset: result.offset,
      total: result.total
    }
  };
  
  return success(res, responseData, 'Followers list returned successfully.', 200);
};

exports.getMyFollowing = async (req, res) => {
  const userId = req.user.sub;
  const searchQuery = req.query.q;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  // If no search query, return all following (paginated)
  if (!searchQuery) {
    const result = await followersService.getFollowing(userId, limit, offset);
    
    // Format response as UserListResponse
    const responseData = {
      items: result.items,
      meta: {
        limit: result.limit,
        offset: result.offset,
        total: result.total
      }
    };
    
    return success(res, responseData, 'Following list returned successfully.', 200);
  }

  // If search query provided, search within following
  const result = await followersService.searchMyFollowing(userId, searchQuery, limit, offset);
  
  // Format response as FollowingSearchResponse
  const responseData = {
    items: result.items,
    total: result.total,
    query: searchQuery
  };
  
  return success(res, responseData, 'Search results returned successfully.', 200);
};

exports.getSuggestedUsersToFollow = async (req, res) => {
  const userId = req.user.sub;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const result = await followersService.getSuggestedUsersToFollow(userId, limit, offset);
  
  // Format response as UserListResponse
  const responseData = {
    items: result.items,
    meta: {
      limit: result.limit,
      offset: result.offset,
      total: result.total
    }
  };
  
  return success(res, responseData, 'Suggested users returned successfully.', 200);
};

exports.getFollowStatus = async (req, res) => {
  const userId = req.user.sub;
  const targetUserId = req.params.user_id;
  const data = await followersService.getFollowStatus(userId, targetUserId);
  // Wrap in data property per OpenAPI spec
  return success(res, { ...data }, 'Follow status returned successfully.', 200);
};

/**
 * Follow a user
 * POST /users/{user_id}/follow
 * 
 * Returns:
 * - 201 Created: if new follow
 * - 200 OK: if already following (idempotent)
 */
exports.followUser = async (req, res) => {
  const followerId = req.user.sub;
  const userId = req.params.user_id;
  
  const result = await followersService.followUser(followerId, userId);
  
  // Idempotent: return 200 if already following, 201 if new follow
  const statusCode = result.alreadyFollowing ? 200 : 201;
  const message = result.alreadyFollowing 
    ? 'You are already following this user.' 
    : 'You are now following this user.';
  
  const responseData = {
    follower_id: result.follower_id,
    followed_id: result.followed_id,
    ...(result.created_at && { created_at: result.created_at })
  };
  
  return success(res, responseData, message, statusCode);
};

/**
 * Unfollow a user
 * DELETE /users/{user_id}/follow
 * 
 * Returns:
 * - 204 No Content: always (idempotent)
 */
exports.unfollowUser = async (req, res) => {
  const followerId = req.user.sub;
  const userId = req.params.user_id;
  
  await followersService.unfollowUser(followerId, userId);
  
  // 204 No Content - idempotent, no response body
  return res.status(204).send();
};
