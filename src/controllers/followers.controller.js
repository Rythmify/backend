// ============================================================
// controllers/followers.controller.js
// Owner : Beshoy Maher (BE-3)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const followersService = require('../services/followers.service');
const followRequestService = require('../services/follow-request.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

exports.getFollowing = async (req, res) => {
  const userId = req.params.user_id;
  // Validate pagination: limit between 1-100, offset >= 0
  let limit = parseInt(req.query.limit) || 10;
  let offset = parseInt(req.query.offset) || 0;
  limit = Math.min(Math.max(limit, 1), 100);
  offset = Math.max(offset, 0);
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
  // Validate pagination: limit between 1-100, offset >= 0
  let limit = parseInt(req.query.limit) || 10;
  let offset = parseInt(req.query.offset) || 0;
  limit = Math.min(Math.max(limit, 1), 100);
  offset = Math.max(offset, 0);
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
  // Validate pagination: limit between 1-100, offset >= 0
  let limit = parseInt(req.query.limit) || 10;
  let offset = parseInt(req.query.offset) || 0;
  limit = Math.min(Math.max(limit, 1), 100);
  offset = Math.max(offset, 0);

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
  // Validate pagination: limit between 1-100, offset >= 0
  let limit = parseInt(req.query.limit) || 10;
  let offset = parseInt(req.query.offset) || 0;
  limit = Math.min(Math.max(limit, 1), 100);
  offset = Math.max(offset, 0);
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
 * For public accounts:
 * - 201 Created: if new follow
 * - 200 OK: if already following (idempotent)
 * 
 * For private accounts:
 * - 202 Accepted: if follow request created
 * - Wait for user to accept the request to become followers
 */
exports.followUser = async (req, res) => {
  const followerId = req.user.sub;
  const userId = req.params.user_id;
  
  const result = await followersService.followUser(followerId, userId);
  
  // Handle follow request (private account)
  if (result.isRequest) {
    // 202 Accepted - follow request pending
    const statusCode = result.alreadyRequested ? 200 : 202;
    const message = result.alreadyRequested 
      ? 'You have already requested to follow this user.'
      : 'Follow request sent. Waiting for user to accept.';
    
    const responseData = {
      request_id: result.id,
      following_id: result.following_id,
      follower_id: result.follower_id,
      status: result.status,
      ...(result.created_at && { requested_at: result.created_at })
    };
    
    return success(res, responseData, message, statusCode);
  }
  
  // Handle direct follow (public account)
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
  
  // 204 No Content - idempotent, no response body, no error thrown
  res.status(204).send();
};

/**
 * Get pending follow requests
 * GET /users/me/follow-requests
 * 
 * Returns:
 * - 200 OK: paginated list of pending requests
 */
exports.getPendingFollowRequests = async (req, res) => {
  const userId = req.user.sub;
  // Validate pagination: limit between 1-100, offset >= 0
  let limit = parseInt(req.query.limit) || 10;
  let offset = parseInt(req.query.offset) || 0;
  limit = Math.min(Math.max(limit, 1), 100);
  offset = Math.max(offset, 0);

  const result = await followRequestService.getPendingFollowRequests(userId, limit, offset);
  
  const responseData = {
    items: result.items,
    meta: {
      limit: result.limit,
      offset: result.offset,
      total: result.total
    }
  };

  return success(res, responseData, 'Pending follow requests returned successfully.', 200);
};

/**
 * Accept a follow request
 * POST /users/me/follow-requests/{request_id}/accept
 * 
 * Returns:
 * - 201 Created: if new follow created
 * - 200 OK: if already accepted (idempotent)
 */
exports.acceptFollowRequest = async (req, res) => {
  const userId = req.user.sub;
  const requestId = req.params.request_id;

  const result = await followRequestService.acceptFollowRequest(requestId, userId);
  
  const statusCode = result.isNew ? 201 : 200;
  const message = result.isNew 
    ? 'Follow request accepted. User is now following you.'
    : 'Follow request already accepted.';

  return success(res, result, message, statusCode);
};

/**
 * Reject a follow request
 * POST /users/me/follow-requests/{request_id}/reject
 * 
 * Returns:
 * - 204 No Content: always (idempotent)
 */
exports.rejectFollowRequest = async (req, res) => {
  const userId = req.user.sub;
  const requestId = req.params.request_id;

  await followRequestService.rejectFollowRequest(requestId, userId);
  
  // 204 No Content - idempotent, no response body, no error thrown
  res.status(204).send();
};

/**
 * Cancel a follow request (by the requester)
 * DELETE /users/me/follow-requests/{request_id}
 * 
 * Returns:
 * - 204 No Content: always (idempotent)
 */
exports.cancelFollowRequest = async (req, res) => {
  const followerId = req.user.sub;
  const requestId = req.params.request_id;

  await followRequestService.cancelFollowRequest(requestId, followerId);
  
  // 204 No Content - idempotent, no response body, no error thrown
  res.status(204).send();
};
