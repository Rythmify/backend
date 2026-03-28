// ============================================================
// services/followers.service.js
// Owner : Beshoy Maher (BE-3)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const followModel = require('../models/follow.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

exports.getFollowing = async (userId, limit, offset) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return await followModel.getFollowing(userId, limit, offset);
};

exports.getFollowers = async (userId, limit, offset) => {
  const user = await userModel.findById(userId);   
    if (!user) {
        throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
    }
  return await followModel.getFollowers(userId, limit, offset);
};

exports.searchMyFollowing = async (userId, query, limit, offset) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return await followModel.searchMyFollowing(userId, query, limit, offset);
};

exports.getSuggestedUsersToFollow = async (userId, limit, offset) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return await followModel.getSuggestedUsers(userId, limit, offset);
};

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

