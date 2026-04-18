// ============================================================
// controllers/users.controller.js
// Owner : Omar Hamdy (BE-1)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const usersService = require('../services/users.service');
const { success } = require('../utils/api-response');
const AppError = require('../utils/app-error');

const parsePagination = (query) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

exports.getMe = async (req, res) => {
  const data = await usersService.getMe(req.user.sub);
  return success(res, data, 'Own profile returned successfully.', 200);
};

exports.getUserById = async (req, res) => {
  const targetId = req.params.user_id;
  const requesterId = req.user?.sub || null; // requesterId is optional for this endpoint

  const data = await usersService.getUserById(targetId, requesterId);

  return success(res, data, 'User profile returned successfully.', 200);
};

// Return a public, paginated list of a user's tracks.
// Validates through the service layer and only exposes the user-scoped listing payload.
exports.getUserTracks = async (req, res) => {
  const data = await usersService.getUserTracks({
    userId: req.params.user_id,
    limit: req.query.limit,
    offset: req.query.offset,
  });

  return success(res, data.data, 'User tracks fetched successfully', 200, data.pagination);
};

exports.updateMe = async (req, res) => {
  const fields = {};

  if (req.body.display_name !== undefined) fields.display_name = req.body.display_name;
  if (req.body.username !== undefined) fields.username = req.body.username;
  if (req.body.first_name !== undefined) fields.first_name = req.body.first_name;
  if (req.body.last_name !== undefined) fields.last_name = req.body.last_name;
  if (req.body.bio !== undefined) fields.bio = req.body.bio;
  if (req.body.city !== undefined) fields.city = req.body.city;
  if (req.body.country !== undefined) fields.country = req.body.country;

  const data = await usersService.updateMe(req.user.sub, fields);
  return success(res, data, 'Profile updated successfully.');
};

exports.updateMyAccount = async (req, res) => {
  const fields = {};

  if (req.body.date_of_birth !== undefined) fields.date_of_birth = req.body.date_of_birth;
  if (req.body.gender !== undefined) fields.gender = req.body.gender;

  const data = await usersService.updateMyAccount(req.user.sub, fields);
  return success(res, data, 'Account updated successfully.');
};

exports.switchRole = async (req, res) => {
  const userId = req.user.sub;
  const { role } = req.body;

  const data = await usersService.switchRole(userId, role);

  return success(res, data, 'Role switched successfully.');
};

exports.deleteMyAvatar = async (req, res) => {
  const data = await usersService.deleteMyAvatar(req.user.sub);
  return success(res, data, 'Your profile picture deleted successfully.');
};

exports.uploadMyAvatar = async (req, res) => {
  if (!req.file) {
    throw new AppError('No image file provided.', 400, 'VALIDATION_FAILED');
  }
  const data = await usersService.uploadMyAvatar(req.user.sub, req.file);
  return success(res, data, 'Avatar uploaded successfully.');
};
exports.uploadMyCoverPhoto = async (req, res) => {
  if (!req.file) {
    throw new AppError('No image file provided.', 400, 'VALIDATION_FAILED');
  }
  const data = await usersService.uploadMyCoverPhoto(req.user.sub, req.file);
  return success(res, data, 'Cover photo uploaded successfully.');
};
exports.deleteMyCoverPhoto = async (req, res) => {
  const data = await usersService.deleteMyCoverPhoto(req.user.sub);
  return success(res, data, 'Your cover photo deleted successfully.');
};
exports.getMyWebProfile = async (req, res) => {
  const pagination = parsePagination(req.query);
  const data = await usersService.getMyWebProfile(req.user.sub, pagination);
  return res.status(200).json(data);
};
exports.addWebProfile = async (req, res) => {
  const { platform, url } = req.body;
  const data = await usersService.addWebProfile(req.user.sub, platform, url);
  return success(res, data, 'Web profile link created.', 201);
};

exports.deleteWebProfile = async (req, res) => {
  const profileId = req.params.profile_id;
  const data = await usersService.deleteWebProfile(req.user.sub, profileId);
  return success(res, data, 'Web profile link deleted successfully.');
};

exports.updatePrivacy = async (req, res) => {
  const { is_private } = req.body;
  if (is_private === undefined) {
    throw new AppError('is_private field is required.', 400, 'VALIDATION_FAILED');
  }
  const data = await usersService.updatePrivacy(req.user.sub, is_private);
  return success(res, data, `Profile is now ${is_private ? 'private' : 'public'}.`);
};

exports.getMyContentSettings = async (req, res) => {
  const data = await usersService.getMyContentSettings(req.user.sub);
  return success(res, data, 'Content settings returned successfully.');
};

exports.updateMyContentSettings = async (req, res) => {
  const fields = {};
  if (req.body.rss_title !== undefined) fields.rss_title = req.body.rss_title;
  if (req.body.rss_language !== undefined) fields.rss_language = req.body.rss_language;
  if (req.body.rss_category !== undefined) fields.rss_category = req.body.rss_category;
  if (req.body.rss_explicit !== undefined) fields.rss_explicit = req.body.rss_explicit;
  if (req.body.rss_show_email !== undefined) fields.rss_show_email = req.body.rss_show_email;
  if (req.body.default_include_in_rss !== undefined)
    fields.default_include_in_rss = req.body.default_include_in_rss;
  if (req.body.default_license_type !== undefined)
    fields.default_license_type = req.body.default_license_type;

  const data = await usersService.updateMyContentSettings(req.user.sub, fields);
  return success(res, data, 'Content settings updated successfully.');
};

exports.getMyPrivacySettings = async (req, res) => {
  const data = await usersService.getMyPrivacySettings(req.user.sub);
  return success(res, data, 'Privacy settings returned successfully.');
};

exports.updateMyPrivacySettings = async (req, res) => {
  const fields = {};
  if (req.body.receive_messages_from_anyone !== undefined)
    fields.receive_messages_from_anyone = req.body.receive_messages_from_anyone;
  if (req.body.show_activities_in_discovery !== undefined)
    fields.show_activities_in_discovery = req.body.show_activities_in_discovery;
  if (req.body.show_as_top_fan !== undefined) fields.show_as_top_fan = req.body.show_as_top_fan;
  if (req.body.show_top_fans_on_tracks !== undefined)
    fields.show_top_fans_on_tracks = req.body.show_top_fans_on_tracks;
  const data = await usersService.updateMyPrivacySettings(req.user.sub, fields);
  return success(res, data, 'Privacy settings updated successfully.');
};

exports.getMyGenres = async (req, res) => {
  const pagination = parsePagination(req.query);
  const data = await usersService.getMyGenres(req.user.sub, pagination);
  return res.status(200).json(data);
};

exports.replaceMyGenres = async (req, res) => {
  const { genres } = req.body;
  if (!Array.isArray(genres)) {
    throw new AppError('genres must be an array.', 400, 'VALIDATION_FAILED');
  }
  if (genres.length > 10) {
    throw new AppError('Maximum of 10 genres allowed.', 400, 'VALIDATION_FAILED');
  }
  const data = await usersService.replaceMyGenres(req.user.sub, genres);
  return res.status(200).json(data);
};

exports.completeOnboarding = async (req, res) => {
  const fields = {};
  if (req.body.display_name !== undefined) fields.display_name = req.body.display_name;
  if (req.body.gender !== undefined) fields.gender = req.body.gender;
  if (req.body.date_of_birth !== undefined) fields.date_of_birth = req.body.date_of_birth;
  if (req.body.bio !== undefined) fields.bio = req.body.bio;
  if (req.body.city !== undefined) fields.city = req.body.city;
  if (req.body.country !== undefined) fields.country = req.body.country;

  const data = await usersService.completeOnboarding(req.user.sub, fields);
  return success(res, data, 'Profile onboarding completed successfully.');
};
