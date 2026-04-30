// ============================================================
// services/followers.service.js
// Owner : Beshoy Maher (BE-3)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models
// ============================================================

const followModel = require('../models/follow.model');
const followRequestModel = require('../models/follow-request.model');
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
  if (user.deleted_at) {
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
  if (user.deleted_at) {
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
 * Validation: target user exists, not self-follow, not blocked, user not suspended
 * Handles: Direct follow for public accounts, follow request for private accounts
 * Creates notification for successful follows (not for follow requests)
 */
exports.followUser = async (followerId, userId) => {
  // Validate follower is not suspended
  const follower = await userModel.findById(followerId);
  if (!follower) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (follower.is_suspended) {
    throw new AppError('Suspended users cannot perform this action', 403, 'USER_SUSPENDED');
  }

  // Validate target user exists and not deleted
  const targetUser = await userModel.findById(userId);
  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (targetUser.deleted_at) {
    throw new AppError('Target user not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Check if target user is private and create follow request instead of direct follow
  const isPrivate = targetUser.is_private === true;

  if (isPrivate) {
    // Create follow request for private account
    const requestResult = await followRequestModel.createFollowRequest(followerId, userId);
    return {
      ...requestResult,
      isRequest: true, // Flag to indicate this is a request, not a direct follow
    };
  } else {
    // Direct follow for public account
    const followResult = await followModel.followUser(followerId, userId);

    // FIX: Fire and forget
    notifyFollowIfNeeded({
      alreadyFollowing: followResult.alreadyFollowing,
      followerId,
      followedUserId: userId,
    }).catch((err) => console.error('Notification error:', err));

    return {
      ...followResult,
      isRequest: false, // Flag to indicate this is a direct follow
    };
  }
};

/**
 * Unfollow a user
 * Validation: target user exists, currently following
 */
exports.unfollowUser = async (followerId, userId) => {
  // Validate follower is not suspended
  const follower = await userModel.findById(followerId);
  if (!follower) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (follower.is_suspended) {
    throw new AppError('Suspended users cannot perform this action', 403, 'USER_SUSPENDED');
  }

  // Validate target user exists
  const targetUser = await userModel.findById(userId);
  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Delegate to model which handles transactions
  return await followModel.unfollowUser(followerId, userId);
};

async function notifyFollowIfNeeded({ alreadyFollowing, followerId, followedUserId }) {
  if (alreadyFollowing) return;
  if (followerId === followedUserId) return;

  const notificationsService = require('./notifications.service');
  await notificationsService.createNotification({
    userId: followedUserId,
    actionUserId: followerId,
    type: 'follow',
    referenceId: null,
    referenceType: null,
  });
}
