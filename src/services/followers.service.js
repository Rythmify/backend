// ============================================================
// services/followers.service.js
// Owner : Beshoy Maher (BE-3)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models
// ============================================================

const followModel = require('../models/follow.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

// ===== GET OPERATIONS =====

/**
 * Get users that a specific user is following
 */
exports.getFollowing = async (userId, limit, offset) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return await followModel.getFollowing(userId, limit, offset);
};

/**
 * Get users who follow a specific user
 */
exports.getFollowers = async (userId, limit, offset) => {
  const user = await userModel.findById(userId);   
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return await followModel.getFollowers(userId, limit, offset);
};

/**
 * Search within authenticated user's following list
 */
exports.searchMyFollowing = async (userId, query, limit, offset) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  // Validate query length
  if (query.trim().length === 0) {
    throw new AppError('Search query cannot be empty', 400, 'VALIDATION_FAILED');
  }
  
  return await followModel.searchMyFollowing(userId, query, limit, offset);
};

/**
 * Get suggested users to follow
 */
exports.getSuggestedUsersToFollow = async (userId, limit, offset) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return await followModel.getSuggestedUsers(userId, limit, offset);
};

/**
 * Get follow/block status between two users
 */
exports.getFollowStatus = async (userId, targetUserId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  const targetUser = await userModel.findById(targetUserId);
  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  return await followModel.getFollowStatus(userId, targetUserId);
};

// ===== FOLLOW/UNFOLLOW OPERATIONS =====

/**
 * Follow a user
 * Validation: target user exists, not self-follow, not blocked, not already following
 */
exports.followUser = async (followerId, userId) => {
  // Validate target user exists
  const targetUser = await userModel.findById(userId);
  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  // Delegate to model which handles edge cases and transactions
  return await followModel.followUser(followerId, userId);
};

/**
 * Unfollow a user
 * Validation: target user exists, currently following
 */
exports.unfollowUser = async (followerId, userId) => {
  // Validate target user exists
  const targetUser = await userModel.findById(userId);
  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  // Delegate to model which handles transactions
  return await followModel.unfollowUser(followerId, userId);
};

