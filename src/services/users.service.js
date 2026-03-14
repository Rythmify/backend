const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

// full private profile for authenticated user
exports.getMe = async (userId) => {
  const user = await userModel.findFullById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return user;
};

exports.getUserById = async (targetId, requesterId) => {
  const user = await userModel.findPublicById(targetId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }

  if (!user.is_private) {
    return user;
  }

  if (!requesterId) {
    throw new AppError('This profile is private.', 403, 'RESOURCE_PRIVATE');
  }

  if (requesterId === targetId) {
    return user;
  }

  const following = await userModel.isFollowing(requesterId, targetId);
  if (!following) {
    throw new AppError('This profile is private.', 403, 'RESOURCE_PRIVATE');
  }

  return user;
};

exports.updateMe = async (userId, fields) => {
  if (fields.username) {
    const existing = await userModel.findByUsername(fields.username);
    if (existing && existing.id !== userId) {
      throw new AppError('Username already taken.', 409, 'RESOURCE_ALREADY_EXISTS');
    }
  }

  const updatedUser = await userModel.updateProfile(userId, fields);
  if (!updatedUser) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }

  return updatedUser;
};
