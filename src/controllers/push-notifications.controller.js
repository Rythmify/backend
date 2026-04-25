// ============================================================
// controllers/push-notifications.controller.js
// ============================================================
const pushNotificationsService = require('../services/push-notifications.service');
const { success, error } = require('../utils/api-response');

exports.registerToken = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { token, platform } = req.body;

  await pushNotificationsService.registerToken({ userId, token, platform });

  return success(res, { success: true }, 'Push token registered.');
};

exports.unregisterToken = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return error(res, 'UNAUTHORIZED', 'Authentication required.', 401);

  const { token } = req.body;

  await pushNotificationsService.unregisterToken({ userId, token });

  return success(res, { success: true }, 'Push token removed.');
};
