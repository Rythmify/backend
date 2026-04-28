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
const { downloadLimiter, trackWriteLimiter, uploadLimiter } = require('../middleware/rate-limiter');
const asyncHandler = require('../utils/async-handler');
const { validateUuidParam } = require('../middleware/validate-params');

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
router.get(
  '/:track_id/share-link',
  authenticate,
  validateUuidParam('track_id'),
  trackWriteLimiter,
  asyncHandler(controller.getPrivateShareLink)
);

router.get('/:track_id', optionalAuthenticate, asyncHandler(controller.getTrackById));
router.get(
  '/:track_id/fan-leaderboard',
  optionalAuthenticate,
  asyncHandler(controller.getTrackFanLeaderboard)
);
router.patch(
  '/:track_id/visibility',
  authenticate,
  validateUuidParam('track_id'),
  trackWriteLimiter,
  asyncHandler(controller.updateTrackVisibility)
);
router.patch(
  '/:track_id/cover',
  authenticate,
  validateUuidParam('track_id'),
  uploadLimiter,
  uploadImage.single('cover_image'),
  asyncHandler(controller.updateTrackCoverImage)
);
router.delete(
  '/:track_id',
  authenticate,
  validateUuidParam('track_id'),
  trackWriteLimiter,
  asyncHandler(controller.deleteTrack)
);
router.patch(
  '/:track_id',
  authenticate,
  validateUuidParam('track_id'),
  trackWriteLimiter,
  asyncHandler(controller.updateTrack)
);
router.get('/:track_id/stream', optionalAuthenticate, asyncHandler(controller.getTrackStream));
router.get(
  '/:track_id/offline-download',
  authenticate,
  validateUuidParam('track_id'),
  downloadLimiter,
  asyncHandler(controller.getTrackOfflineDownload)
);
router.get('/:track_id/waveform', optionalAuthenticate, asyncHandler(controller.getTrackWaveform));

const feedController = require('../controllers/feed.controller');
router.get('/:track_id/related', asyncHandler(feedController.getRelatedTracks));
router.post('/:track_id/like-radio', authenticate, asyncHandler(feedController.likeTrackRadio));
router.delete('/:track_id/like-radio', authenticate, asyncHandler(feedController.unlikeTrackRadio));

module.exports = router;
