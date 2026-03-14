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
  const userId = req.user.sub;
  const { display_name, username, first_name, last_name, bio, city, country } = req.body;

  const data = await usersService.updateMe(userId, {
    display_name,
    username,
    first_name,
    last_name,
    bio,
    city,
    country,
  });

  return success(res, data, 'Profile updated successfully.');
};
