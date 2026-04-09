// ============================================================
// routes/tracks.routes.js
// Owner : Saja Aboulmagd (BE-2)
// Modules: Module 4 — Audio Upload & Track Management
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/tracks.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { uploadTrackFiles, uploadImage } = require('../middleware/multer.js');
const asyncHandler = require('../utils/async-handler');
const { validateUuidParam } = require('../middleware/validate-params');

// upload track
router.post(
  '/',
  authenticate,
  uploadTrackFiles.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
  ]),
  asyncHandler(controller.uploadTrack)
);
router.get('/me', authenticate, asyncHandler(controller.getMyTracks));
router.get(
  '/:track_id/share-link',
  authenticate,
  validateUuidParam('track_id'),
  asyncHandler(controller.getPrivateShareLink)
);

router.get(
  '/:track_id',
  validateUuidParam('track_id'),
  optionalAuthenticate,
  asyncHandler(controller.getTrackById)
);
router.patch(
  '/:track_id/visibility',
  authenticate,
  validateUuidParam('track_id'),
  asyncHandler(controller.updateTrackVisibility)
);
router.delete(
  '/:track_id',
  authenticate,
  validateUuidParam('track_id'),
  asyncHandler(controller.deleteTrack)
);
router.patch(
  '/:track_id',
  authenticate,
  validateUuidParam('track_id'),
  uploadImage.single('cover_image'),
  asyncHandler(controller.updateTrack)
);
router.get(
  '/:track_id/stream',
  validateUuidParam('track_id'),
  optionalAuthenticate,
  asyncHandler(controller.getTrackStream)
);
router.get(
  '/:track_id/waveform',
  validateUuidParam('track_id'),
  optionalAuthenticate,
  asyncHandler(controller.getTrackWaveform)
);

module.exports = router;
