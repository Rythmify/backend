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
  const userId = req.user.id;
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
  const userId = req.user.id;
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
  const userId = req.user.id;
  const targetUserId = req.params.user_id;
  const data = await followersService.getFollowStatus(userId, targetUserId);
  return success(res, data, 'Follow status returned successfully.', 200);
};

