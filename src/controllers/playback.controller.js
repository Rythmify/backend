// ============================================================
// controllers/playback.controller.js
// Owner : Saja Aboulmagd (BE-2)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const playbackService = require('../services/playback.service');
const { success, error } = require('../utils/api-response');

const getAuthenticatedUserId = (req, res) => {
  const userId = req?.user?.sub || req?.user?.id || req?.user?.user_id;
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    return null;
  }
  return userId;
};

exports.getPlayerState = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const data = await playbackService.getPlayerState({ userId });
  return success(res, data, 'Player state fetched successfully.');
};

exports.savePlayerState = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const data = await playbackService.savePlayerState({
    userId,
    trackId: req.body?.track_id,
    positionSeconds: req.body?.position_seconds,
    volume: req.body?.volume,
    queue: req.body?.queue,
  });

  return success(res, data, 'Player state saved successfully.');
};
