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

const getTrackById = async (req, res) => {
  const {track_id} = req.params;
  const requesterUserId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const track = await tracksService.getTrackById(track_id, requesterUserId);

  return success(res, track, 'Track fetched successfully', 200);
}

const updateTrackVisibility = async (req, res) => {
  const { track_id } = req.params;
  const { is_public } = req.body;
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const track = await tracksService.updateTrackVisibility(track_id, userId, is_public);

  return success(res, track, 'Track visibility updated successfully', 200);
};

const getMyTracks = async (req, res) => {
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const page = req.query.page;
  const limit = req.query.limit;
  const status = req.query.status;

  const result = await tracksService.getMyTracks(userId, { page, limit, status });

  return success(res, result, 'My tracks fetched successfully', 200);
};

const deleteTrack = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  await tracksService.deleteTrack(track_id, userId);

  return success(res, null, 'Track deleted successfully', 200);
};

module.exports = {
  uploadTrack,
  getTrackById,
  updateTrackVisibility,
  getMyTracks,
  deleteTrack
};
