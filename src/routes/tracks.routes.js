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
const { uploadLimiter } = require('../middleware/rate-limiter');
const asyncHandler = require('../utils/async-handler');

// upload track
router.post(
  '/',
  authenticate,
  uploadLimiter,
  uploadTrackFiles.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
  ]),
  asyncHandler(controller.uploadTrack)
);
router.get('/me', authenticate, asyncHandler(controller.getMyTracks));
router.get('/:track_id/share-link', authenticate, asyncHandler(controller.getPrivateShareLink));

router.get('/:track_id', optionalAuthenticate, asyncHandler(controller.getTrackById));
router.patch('/:track_id/visibility', authenticate, asyncHandler(controller.updateTrackVisibility));
router.patch(
  '/:track_id/cover',
  authenticate,
  uploadImage.single('cover_image'),
  asyncHandler(controller.updateTrackCoverImage)
);
router.delete('/:track_id', authenticate, asyncHandler(controller.deleteTrack));
router.patch('/:track_id', authenticate, asyncHandler(controller.updateTrack));
router.get('/:track_id/stream', optionalAuthenticate, asyncHandler(controller.getTrackStream));
router.get('/:track_id/waveform', optionalAuthenticate, asyncHandler(controller.getTrackWaveform));

module.exports = router;
