const userModel = require('../models/user.model');
const trackModel = require('../models/track.model');
const storageService = require('./storage.service');
const AppError = require('../utils/app-error');
const GENDER_TYPES = require('../constants/gender-types');
const USER_ROLES = require('../constants/user-roles');
const { validate: isUuid } = require('uuid');

// Parse and validate offset-style pagination values.
// Applies defaults when omitted and enforces endpoint bounds for limit/offset.
// Returns a normalized integer ready for model queries.
const parsePaginationNumber = ({ value, field, defaultValue, min, max = null }) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  const exceedsMax = max !== null && parsed > max;

  if (!Number.isInteger(parsed) || parsed < min || exceedsMax) {
    if (field === 'limit') {
      throw new AppError('limit must be an integer between 1 and 100.', 400, 'VALIDATION_FAILED');
    }

    throw new AppError(
      'offset must be an integer greater than or equal to 0.',
      400,
      'VALIDATION_FAILED'
    );
  }

  return parsed;
};

// full private profile for authenticated user
exports.getMe = async (userId) => {
  const user = await userModel.findFullById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return user;
};

exports.getUserById = async (targetId, requesterId) => {
  if (!isUuid(targetId)) {
    throw new AppError('user_id must be a valid UUID.', 400, 'VALIDATION_FAILED');
  }

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

// Return a public, paginated list of tracks for the requested user.
// Enforces UUID validation, limit/offset rules, and a hard 404 when the user does not exist.
exports.getUserTracks = async ({ userId, limit, offset }) => {
  // Reject malformed user-scoped paths before touching the database.
  if (!isUuid(userId)) {
    throw new AppError('user_id must be a valid UUID.', 400, 'VALIDATION_FAILED');
  }

  // Normalize pagination inputs once so both queries and response meta stay aligned.
  const parsedLimit = parsePaginationNumber({
    value: limit,
    field: 'limit',
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  const parsedOffset = parsePaginationNumber({
    value: offset,
    field: 'offset',
    defaultValue: 0,
    min: 0,
  });

  // The endpoint is user-scoped, so missing users must fail with 404 before listing tracks.
  const user = await userModel.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const { items, total } = await trackModel.findPublicTracksByUserId(userId, {
    limit: parsedLimit,
    offset: parsedOffset,
  });

  return {
    data: items,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

exports.updateMe = async (userId, fields) => {
  if (fields.username) {
    const usernameNormalized = fields.username.trim().toLowerCase();
    if (!usernameNormalized) {
      throw new AppError('Username cannot be empty.', 400, 'VALIDATION_FAILED');
    }
    fields.username = usernameNormalized;
    const existing = await userModel.findByUsername(usernameNormalized);
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

  if (fields.gender && !Object.values(GENDER_TYPES).includes(fields.gender)) {
    throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
      {
        field: 'gender',
        issue: `Must be one of ${GENDER_TYPES.MALE}, ${GENDER_TYPES.FEMALE}`,
      },
    ]);
  }

  if (fields.date_of_birth) {
    const date = new Date(fields.date_of_birth);

    if (isNaN(date.getTime())) {
      throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
        { field: 'date_of_birth', issue: 'Must be a valid date (YYYY-MM-DD)' },
      ]);
    }

    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 13);

    if (date > minAge) {
      throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
        { field: 'date_of_birth', issue: 'You must be at least 13 years old' },
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
  const allowedRoles = [USER_ROLES.ARTIST, USER_ROLES.LISTENER];
  if (!allowedRoles.includes(role)) {
    throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
      {
        field: 'role',
        issue: `Must be one of ${USER_ROLES.ARTIST}, ${USER_ROLES.LISTENER}`,
      },
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

exports.deleteMyAvatar = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (!user.profile_picture) {
    throw new AppError('No avatar to delete', 404, 'RESOURCE_NOT_FOUND');
  }
  
  // Delete from Azure Blob Storage before updating database
  await storageService.deleteAllVersionsByUrl(user.profile_picture);
  return await userModel.deleteAvatar(userId);
};
exports.uploadMyAvatar = async (userId, file) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Upload file to Azure Blob Storage
  const avatarKey = `avatars/${userId}/${Date.now()}-${file.originalname}`;
  const uploadedAvatar = await storageService.uploadImage(file, avatarKey);
  
  // Delete previous avatar if it exists
  if (user.profile_picture) {
    await storageService.deleteAllVersionsByUrl(user.profile_picture);
  }
  
  return await userModel.updateAvatar(userId, uploadedAvatar.url);
};

exports.uploadMyCoverPhoto = async (userId, file) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Upload file to Azure Blob Storage
  const coverKey = `covers/${userId}/${Date.now()}-${file.originalname}`;
  const uploadedCover = await storageService.uploadImage(file, coverKey);
  
  // Delete previous cover photo if it exists
  if (user.cover_photo) {
    await storageService.deleteAllVersionsByUrl(user.cover_photo);
  }
  
  return await userModel.updateCoverPhoto(userId, uploadedCover.url);
};

exports.deleteMyCoverPhoto = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (!user.cover_photo) {
    throw new AppError('No cover photo to delete', 404, 'RESOURCE_NOT_FOUND');
  }
  
  // Delete from Azure Blob Storage before updating database
  await storageService.deleteAllVersionsByUrl(user.cover_photo);
  return await userModel.deleteCoverPhoto(userId);
};

exports.getMyWebProfile = async (userId, { limit, offset }) => {
  const items = await userModel.findWebProfilesByUserId(userId);
  const total = items.length;

  return {
    data: items.slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total,
    },
  };
};
exports.addWebProfile = async (userId, platform, url) => {
  const existing = await userModel.findWebProfileByPlatform(userId, platform);
  if (existing) {
    throw new AppError(
      'A profile for this platform already exists.',
      409,
      'RESOURCE_ALREADY_EXISTS'
    );
  }
  return await userModel.createWebProfile(userId, platform, url);
};

exports.deleteWebProfile = async (userId, profileId) => {
  const profile = await userModel.findWebProfileById(profileId);
  if (!profile) {
    throw new AppError('Web profile not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (profile.user_id !== userId) {
    throw new AppError('You are not allowed to delete this profile.', 403, 'PERMISSION_DENIED');
  }
  return await userModel.deleteWebProfile(profileId);
};

exports.updatePrivacy = async (userId, isPrivate) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (user.is_private === isPrivate) {
    throw new AppError(
      `Profile is already ${isPrivate ? 'private' : 'public'}.`,
      400,
      'VALIDATION_FAILED'
    );
  }
  const updated = await userModel.updatePrivacy(userId, isPrivate);
  return updated;
};

exports.getMyContentSettings = async (userId) => {
  return await userModel.findContentSettingsByUserId(userId);
};

exports.updateMyContentSettings = async (userId, settings) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  const updated = await userModel.updateContentSettings(userId, settings);
  if (!updated) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }
  return updated;
};
exports.getMyPrivacySettings = async (userId) => {
  return await userModel.findPrivacySettingsByUserId(userId);
};

exports.updateMyPrivacySettings = async (userId, settings) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  const updated = await userModel.updatePrivacySettings(userId, settings);
  if (!updated) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }
  return updated;
};

exports.getMyGenres = async (userId, { limit, offset }) => {
  const items = await userModel.findGenresByUserId(userId);
  const total = items.length;

  return {
    data: items.slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total,
    },
  };
};

exports.replaceMyGenres = async (userId, genreIds) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  const updated = await userModel.replaceGenres(userId, genreIds);
  return {
    data: updated,
    pagination: {
      limit: updated.length,
      offset: 0,
      total: updated.length,
    },
  };
};

exports.completeOnboarding = async (userId, fields) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (user.display_name && user.gender && user.date_of_birth) {
    throw new AppError(
      'Profile onboarding has already been completed.',
      409,
      'ONBOARDING_ALREADY_COMPLETED'
    );
  }
  const updated = await userModel.completeOnboarding(userId, fields);
  return updated;
};
