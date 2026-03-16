// ============================================================
// routes/tracks.routes.js
// Owner : Saja Aboulmagd (BE-2)
// Modules: Module 4 — Audio Upload & Track Management
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/tracks.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { uploadTrackFiles  } = require('../middleware/multer.js');
const asyncHandler = require('../utils/async-handler');

// upload track
router.post('/', authenticate, uploadTrackFiles .fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
  ]),
  asyncHandler(controller.uploadTrack)
);
router.get('/me',authenticate, asyncHandler(controller.getMyTracks));

router.get('/:track_id', optionalAuthenticate, asyncHandler(controller.getTrackById));
router.patch('/:track_id/visibility', authenticate, asyncHandler(controller.updateTrackVisibility));
router.delete('/:track_id', authenticate, asyncHandler(controller.deleteTrack));
module.exports = router;
