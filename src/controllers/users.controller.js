// ============================================================
// controllers/users.controller.js
// Owner : Omar Hamdy (BE-1)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const usersService = require('../services/users.service');
const { success } = require('../utils/api-response');

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

exports.updateMe = async (req, res) => {
  const fields = {};

  if (req.body.display_name !== undefined) fields.display_name = req.body.display_name;
  if (req.body.username     !== undefined) fields.username     = req.body.username;
  if (req.body.first_name   !== undefined) fields.first_name   = req.body.first_name;
  if (req.body.last_name    !== undefined) fields.last_name    = req.body.last_name;
  if (req.body.bio          !== undefined) fields.bio          = req.body.bio;
  if (req.body.city         !== undefined) fields.city         = req.body.city;
  if (req.body.country      !== undefined) fields.country      = req.body.country;

  const data = await usersService.updateMe(req.user.sub, fields);
  return success(res, data, 'Profile updated successfully.');
};


exports.updateMyAccount = async (req, res) => {
  const fields = {};

  if (req.body.date_of_birth !== undefined) fields.date_of_birth = req.body.date_of_birth;
  if (req.body.gender        !== undefined) fields.gender        = req.body.gender;

  const data = await usersService.updateMyAccount(req.user.sub, fields);
  return success(res, data, 'Account updated successfully.');
};


exports.switchRole = async (req, res) => {
  const userId = req.user.sub;
  const {role} = req.body;

  const data = await usersService.switchRole(userId, role);
  
  return success(res, data, 'Role switched successfully.');
};