// ============================================================
// services/users.service.js
// Owner : BE Team
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const userModel = require('../models/user.model');
const trackModel = require('../models/track.model');
const storageService = require('./storage.service');
const AppError = require('../utils/app-error');
const GENDER_TYPES = require('../constants/gender-types');
const USER_ROLES = require('../constants/user-roles');

// Accept PostgreSQL UUID-shaped ids used in seeded and test data.
// We intentionally do not enforce RFC UUID version/variant bits.
const UUID_SHAPED_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeUuidLike = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^\{/, '')
    .replace(/\}$/, '');

const isUuidShaped = (value) => UUID_SHAPED_REGEX.test(normalizeUuidLike(value));

/* Parses and validates offset-style pagination values for user listings. */
/* Applies defaults when omitted and enforces endpoint bounds for limit/offset. */
/* Returns a normalized integer ready for model queries. */
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

/* Ensures service methods only operate on valid user UUIDs before hitting the data layer. */
const assertValidUserId = (userId) => {
  if (!isUuidShaped(userId)) {
    throw new AppError('user_id must be a valid UUID.', 400, 'VALIDATION_FAILED');
  }
};

/* Normalizes username input and enforces uniqueness constraints. */
const normalizeAndValidateUsername = async (username, userId) => {
  const usernameNormalized = username.trim().toLowerCase();
  if (!usernameNormalized) {
    throw new AppError('Username cannot be empty.', 400, 'VALIDATION_FAILED');
  }

  const existing = await userModel.findByUsername(usernameNormalized);
  if (existing && existing.id !== userId) {
    throw new AppError('Username already taken.', 409, 'RESOURCE_ALREADY_EXISTS');
  }

  return usernameNormalized;
};

/* Validates gender field against allowed enum values. */
const validateGender = (gender) => {
  if (gender && !Object.values(GENDER_TYPES).includes(gender)) {
    throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
      {
        field: 'gender',
        issue: `Must be one of ${GENDER_TYPES.MALE}, ${GENDER_TYPES.FEMALE}`,
      },
    ]);
  }
};

/* Validates and enforces age requirement for date_of_birth field. */
const validateDateOfBirth = (dateOfBirthString) => {
  const date = new Date(dateOfBirthString);

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
};

/* Validates role input and enforces self-assignable role constraints. */
const validateRole = (role) => {
  const allowedRoles = [USER_ROLES.ARTIST, USER_ROLES.LISTENER];
  if (!allowedRoles.includes(role)) {
    throw new AppError('Validation failed', 400, 'VALIDATION_FAILED', [
      {
        field: 'role',
        issue: `Must be one of ${USER_ROLES.ARTIST}, ${USER_ROLES.LISTENER}`,
      },
    ]);
  }
};

/* Uploads avatar asset to blob storage and returns the public URL. */
const uploadAvatarAsset = async (userId, avatarFile) => {
  const avatarKey = `avatars/${userId}/${Date.now()}-${avatarFile.originalname}`;
  const uploadedAvatar = await storageService.uploadImage(avatarFile, avatarKey);
  return uploadedAvatar.url;
};

/* Removes the previous avatar asset only after the new URL has been persisted successfully. */
const deletePreviousAvatarIfReplaced = async (previousAvatarUrl, nextAvatarUrl) => {
  if (!previousAvatarUrl || !nextAvatarUrl || previousAvatarUrl === nextAvatarUrl) {
    return;
  }

  await storageService.deleteAllVersionsByUrl(previousAvatarUrl);
};

/* Uploads cover photo asset to blob storage and returns the public URL. */
const uploadCoverPhotoAsset = async (userId, coverPhotoFile) => {
  const coverKey = `covers/${userId}/${Date.now()}-${coverPhotoFile.originalname}`;
  const uploadedCover = await storageService.uploadImage(coverPhotoFile, coverKey);
  return uploadedCover.url;
};

/* Removes the previous cover photo asset only after the new URL has been persisted successfully. */
const deletePreviousCoverPhotoIfReplaced = async (previousCoverPhotoUrl, nextCoverPhotoUrl) => {
  if (!previousCoverPhotoUrl || !nextCoverPhotoUrl || previousCoverPhotoUrl === nextCoverPhotoUrl) {
    return;
  }

  await storageService.deleteAllVersionsByUrl(previousCoverPhotoUrl);
};

/* Loads a user for read operations with permission enforcement for private profiles. */
const getUserWithPrivacyCheck = async (targetId, requesterId) => {
  const normalizedTargetId = normalizeUuidLike(targetId);

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

  if (requesterId === normalizedTargetId) {
    return user;
  }

  const following = await userModel.isFollowing(requesterId, normalizedTargetId);
  if (!following) {
    throw new AppError('This profile is private.', 403, 'RESOURCE_PRIVATE');
  }

  return user;
};

/* Loads a user for ownership-sensitive operations and validates authorization. */
const getUserForOwnershipCheck = async (userId, operationMessage = 'User not found') => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError(operationMessage, 404, 'RESOURCE_NOT_FOUND');
  }
  return user;
};

/* Returns the full private profile for the authenticated user. */
exports.getMe = async (userId) => {
  const user = await userModel.findFullById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  return user;
};

/* Fetches a user profile with visibility enforcement for public/private access rules. */
exports.getUserById = async (targetId, requesterId) => {
  const normalizedTargetId = normalizeUuidLike(targetId);
  assertValidUserId(normalizedTargetId);
  return await getUserWithPrivacyCheck(normalizedTargetId, requesterId);
};

/* Returns a public, paginated list of tracks for the requested user. */
/* Enforces UUID validation, limit/offset rules, and a hard 404 when the user does not exist. */
exports.getUserTracks = async ({ userId, limit, offset }) => {
  const normalizedUserId = normalizeUuidLike(userId);

  // Reject malformed user-scoped paths before touching the database.
  assertValidUserId(normalizedUserId);

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
  const user = await userModel.findById(normalizedUserId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const { items, total } = await trackModel.findPublicTracksByUserId(normalizedUserId, {
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

/* Returns visible liked tracks for a user after enforcing profile privacy rules. */
exports.getUserLikedTracks = async ({ targetUserId, requesterUserId = null, limit, offset }) => {
  const normalizedTargetUserId = normalizeUuidLike(targetUserId);
  const normalizedRequesterUserId = requesterUserId ? normalizeUuidLike(requesterUserId) : null;

  assertValidUserId(normalizedTargetUserId);

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

  await getUserWithPrivacyCheck(normalizedTargetUserId, normalizedRequesterUserId);

  const { items, total } = await userModel.findVisibleLikedTracksByUserId({
    targetUserId: normalizedTargetUserId,
    requesterUserId: normalizedRequesterUserId,
    limit: parsedLimit,
    offset: parsedOffset,
  });

  return {
    data: items.map((track) => ({
      ...track,
      is_liked_by_me: Boolean(track.is_liked_by_me),
      is_reposted_by_me: Boolean(track.is_reposted_by_me),
      is_artist_followed_by_me: Boolean(track.is_artist_followed_by_me),
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Updates editable user profile metadata after validation and uniqueness checks. */
exports.updateMe = async (userId, fields) => {
  const updateData = {};

  if (fields.username !== undefined) {
    updateData.username = await normalizeAndValidateUsername(fields.username, userId);
  }

  if (fields.display_name !== undefined) {
    updateData.display_name = fields.display_name;
  }

  if (fields.first_name !== undefined) {
    updateData.first_name = fields.first_name;
  }

  if (fields.last_name !== undefined) {
    updateData.last_name = fields.last_name;
  }

  if (fields.bio !== undefined) {
    updateData.bio = fields.bio;
  }

  if (fields.city !== undefined) {
    updateData.city = fields.city;
  }

  if (fields.country !== undefined) {
    updateData.country = fields.country;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('No valid fields provided for update', 400, 'VALIDATION_FAILED');
  }

  const updatedUser = await userModel.updateProfile(userId, updateData);
  if (!updatedUser) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }

  return updatedUser;
};

/* Updates user account information after validation of age and gender constraints. */
exports.updateMyAccount = async (userId, fields) => {
  const updateData = {};

  if (fields.gender !== undefined) {
    validateGender(fields.gender);
    updateData.gender = fields.gender;
  }

  if (fields.date_of_birth !== undefined) {
    validateDateOfBirth(fields.date_of_birth);
    updateData.date_of_birth = fields.date_of_birth;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('No valid fields provided for update', 400, 'VALIDATION_FAILED');
  }

  const updated = await userModel.updateAccount(userId, updateData);
  if (!updated) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }

  return updated;
};

/* Switches user role to a self-assignable role after validation and permission checks. */
exports.switchRole = async (userId, role) => {
  validateRole(role);

  const user = await getUserForOwnershipCheck(userId);

  if (user.role === role) {
    throw new AppError(`User already has the ${role} role.`, 409, 'RESOURCE_ALREADY_EXISTS');
  }

  return await userModel.updateRole(userId, role);
};

/* Deletes user avatar after ownership verification. */
exports.deleteMyAvatar = async (userId) => {
  const user = await getUserForOwnershipCheck(userId);

  if (!user.profile_picture) {
    throw new AppError('No avatar to delete', 404, 'RESOURCE_NOT_FOUND');
  }

  // Delete from Azure Blob Storage before updating database
  await storageService.deleteAllVersionsByUrl(user.profile_picture);
  return await userModel.deleteAvatar(userId);
};

/* Uploads and persists a new user avatar, removing previous avatar if present. */
exports.uploadMyAvatar = async (userId, file) => {
  const user = await getUserForOwnershipCheck(userId);

  if (!file) {
    throw new AppError('Avatar file is required', 400, 'VALIDATION_FAILED');
  }

  const avatarUrl = await uploadAvatarAsset(userId, file);
  const updatedUser = await userModel.updateAvatar(userId, avatarUrl);

  if (!updatedUser) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }

  await deletePreviousAvatarIfReplaced(user.profile_picture, avatarUrl);

  return updatedUser;
};

/* Deletes user cover photo after ownership verification. */
exports.deleteMyCoverPhoto = async (userId) => {
  const user = await getUserForOwnershipCheck(userId);

  if (!user.cover_photo) {
    throw new AppError('No cover photo to delete', 404, 'RESOURCE_NOT_FOUND');
  }

  // Delete from Azure Blob Storage before updating database
  await storageService.deleteAllVersionsByUrl(user.cover_photo);
  return await userModel.deleteCoverPhoto(userId);
};

/* Uploads and persists a new user cover photo, removing previous cover photo if present. */
exports.uploadMyCoverPhoto = async (userId, file) => {
  const user = await getUserForOwnershipCheck(userId);

  if (!file) {
    throw new AppError('Cover photo file is required', 400, 'VALIDATION_FAILED');
  }

  const coverPhotoUrl = await uploadCoverPhotoAsset(userId, file);
  const updatedUser = await userModel.updateCoverPhoto(userId, coverPhotoUrl);

  if (!updatedUser) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }

  await deletePreviousCoverPhotoIfReplaced(user.cover_photo, coverPhotoUrl);

  return updatedUser;
};

/* Returns paginated web profiles for the authenticated user. */
exports.getMyWebProfile = async (userId, { limit, offset }) => {
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

  const items = await userModel.findWebProfilesByUserId(userId);
  const total = items.length;

  return {
    data: items.slice(parsedOffset, parsedOffset + parsedLimit),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Adds a new web profile for the authenticated user after uniqueness checks. */
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

/* Removes a web profile after ownership verification. */
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

/* Updates user profile privacy setting after permission checks. */
exports.updatePrivacy = async (userId, isPrivate) => {
  const user = await getUserForOwnershipCheck(userId);

  if (user.is_private === isPrivate) {
    throw new AppError(
      `Profile is already ${isPrivate ? 'private' : 'public'}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  return await userModel.updatePrivacy(userId, isPrivate);
};

/* Returns user content settings. */
exports.getMyContentSettings = async (userId) => {
  return await userModel.findContentSettingsByUserId(userId);
};

/* Updates user content settings after permission checks. */
exports.updateMyContentSettings = async (userId, settings) => {
  await getUserForOwnershipCheck(userId);

  const updated = await userModel.updateContentSettings(userId, settings);
  if (!updated) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }

  return updated;
};

/* Returns user privacy settings. */
exports.getMyPrivacySettings = async (userId) => {
  return await userModel.findPrivacySettingsByUserId(userId);
};

/* Updates user privacy settings after permission checks. */
exports.updateMyPrivacySettings = async (userId, settings) => {
  await getUserForOwnershipCheck(userId);

  const updated = await userModel.updatePrivacySettings(userId, settings);
  if (!updated) {
    throw new AppError('Nothing to update', 400, 'VALIDATION_FAILED');
  }

  return updated;
};

/* Returns paginated user favorite genres. */
exports.getMyGenres = async (userId, { limit, offset }) => {
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

  const items = await userModel.findGenresByUserId(userId);
  const total = items.length;

  return {
    data: items.slice(parsedOffset, parsedOffset + parsedLimit),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

/* Replaces user favorite genres after permission checks. */
exports.replaceMyGenres = async (userId, genreIds) => {
  await getUserForOwnershipCheck(userId);

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

/* Completes user onboarding with validated profile information. */
exports.completeOnboarding = async (userId, fields) => {
  const user = await getUserForOwnershipCheck(userId);

  if (user.display_name && user.gender && user.date_of_birth) {
    throw new AppError(
      'Profile onboarding has already been completed.',
      409,
      'ONBOARDING_ALREADY_COMPLETED'
    );
  }

  return await userModel.completeOnboarding(userId, fields);
};
