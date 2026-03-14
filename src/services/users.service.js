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

exports.updateMyAccount = async (userId, fields) => {
    // validate gender if provided
    
    if (fields.gender && !['male', 'female'].includes(fields.gender)) {
    throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
        { field: 'gender', issue: 'Must be one of male, female' }
    ]);
    }

    if (fields.date_of_birth) {
    const date = new Date(fields.date_of_birth);
    
    if (isNaN(date.getTime())) {
        throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
        { field: 'date_of_birth', issue: 'Must be a valid date (YYYY-MM-DD)' }
    ]);
    }
    
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 13);

    if (date > minAge) {
        throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
        { field: 'date_of_birth', issue: 'You must be at least 13 years old' }
        ]);
    }
    }

    const updated = await userModel.updateAccount(userId, fields);
    if (!updated) {
        throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
    }

    return updated;
};


// PATCH /users/me/role
exports.switchRole = async (userId, role) => {
    // only artist and listener are self-assignable
    if (!['artist', 'listener'].includes(role)) {
    throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
        { field: 'role', issue: 'Must be one of artist, listener' }
    ]);
    }

    // get current user to check existing role
    const user = await userModel.findById(userId);
    if (!user) {
        throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
    }

    if (user.role === role) {
        throw new AppError(`User already has the ${role} role.`, 409, 'RESOURCE_ALREADY_EXISTS');
    }

    return await userModel.updateRole(userId, role);
};