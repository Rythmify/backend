// ============================================================
// services/playback.service.js
// Owner : Saja Aboulmagd (BE-2)
// All business logic, rules & cross-module orchestration
// No direct SQL here — delegate to models/
// ============================================================

const playerStateModel = require('../models/player-state.model');
const AppError = require('../utils/app-error');

exports.getPlayerState = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }

  return playerStateModel.findByUserId(userId);
};
