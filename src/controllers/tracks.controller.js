// ============================================================
// controllers/tracks.controller.js
// ============================================================
const AppError = require('../utils/app-error');
const { success } = require('../utils/api-response');
const tracksService = require('../services/tracks.service');

/* Validates upload input and delegates new track creation plus processing kickoff. */
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

/* Returns a single track while forwarding requester identity and optional private token. */
const getTrackById = async (req, res) => {
  const { track_id } = req.params;
  const { secret_token } = req.query || {};
  const requesterUserId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const track = await tracksService.getTrackById(track_id, requesterUserId, secret_token || null);

  return success(res, track, 'Track fetched successfully', 200);
};

/* Handles owner requests to switch a track between public and private visibility. */
const updateTrackVisibility = async (req, res) => {
  const { track_id } = req.params;
  const { is_public } = req.body;
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const track = await tracksService.updateTrackVisibility(track_id, userId, is_public);

  return success(res, track, 'Track visibility updated successfully', 200);
};

/* Returns the owner-only private share link payload for a specific track. */
const getPrivateShareLink = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const data = await tracksService.getPrivateShareLink(track_id, userId);

  return success(res, data, 'Private share link fetched successfully.', 200);
};

/* Lists the authenticated user's tracks using pagination and optional status filtering. */
const getMyTracks = async (req, res) => {
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  const page = req.query.page;
  const limit = req.query.limit;
  const status = req.query.status;

  const result = await tracksService.getMyTracks(userId, { page, limit, status });

  return success(res, result, 'My tracks fetched successfully', 200);
};

/* Deletes a track owned by the authenticated user and returns no-content on success. */
const deleteTrack = async (req, res) => {
  const { track_id } = req.params;
  const userId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;

  await tracksService.deleteTrack(track_id, userId);

  return res.status(204).send();
};

/* Applies editable metadata updates for an owned track, including optional cover replacement. */
const updateTrack = async (req, res) => {
  const userId = req.user?.sub || req.user?.id || req.user?.user_id;

  const updatedTrack = await tracksService.updateTrack({
    trackId: req.params.track_id,
    userId,
    payload: req.body,
    coverImageFile: req.file || null,
  });

  return success(res, updatedTrack, 'Track updated successfully', 200);
};

/* Returns the resolved stream URL for an accessible track. */
const getTrackStream = async (req, res) => {
  const requesterUserId = req.user?.sub || req.user?.id || req.user?.user_id || null;
  const { secret_token } = req.query || {};

  const data = await tracksService.getTrackStream(
    req.params.track_id,
    requesterUserId,
    secret_token || null
  );

  return success(res, data, 'Track stream fetched successfully', 200);
};

/* Returns waveform peak data for an accessible track once processing is complete. */
const getTrackWaveform = async (req, res) => {
  const requesterUserId = req.user?.sub || req.user?.id || req.user?.user_id || null;
  const { secret_token } = req.query || {};

  const data = await tracksService.getTrackWaveform(
    req.params.track_id,
    requesterUserId,
    secret_token || null
  );

  return success(res, data, 'Track waveform fetched successfully', 200);
};

module.exports = {
  uploadTrack,
  getTrackById,
  updateTrackVisibility,
  getPrivateShareLink,
  getMyTracks,
  deleteTrack,
  updateTrack,
  getTrackStream,
  getTrackWaveform,
};
