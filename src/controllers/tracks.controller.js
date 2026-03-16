// ============================================================
// controllers/tracks.controller.js
// ============================================================
const AppError = require('../utils/app-error');
const { success } = require('../utils/api-response');
const tracksService = require('../services/tracks.service');

const uploadTrack = async (req, res) => {
  const { title } = req.body;

  const audioFile = req.files?.audio_file?.[0];
  const coverImageFile = req.files?.cover_image?.[0] || null;

  if (!audioFile) {
    throw new AppError('Audio file is required', 400, 'VALIDATION_FAILED');
  }

  if (!title || !title.trim()) {
    throw new AppError('Title is required', 400, 'VALIDATION_FAILED');
  }

  const track = await tracksService.uploadTrack({
    user: req.user,
    audioFile,
    coverImageFile,
    body: req.body,
  });

  return success(res, track, 'Track created and queued for processing.', 201);
};

module.exports = {
  uploadTrack,
};
