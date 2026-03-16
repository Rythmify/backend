// ============================================================
// routes/tracks.routes.js
// Owner : Saja Aboulmagd (BE-2)
// Modules: Module 4 — Audio Upload & Track Management
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/tracks.controller');
const { authenticate } = require('../middleware/auth');
const { uploadTrackFiles  } = require('../middleware/multer.js');
const asyncHandler = require('../utils/async-handler');

// upload track
router.post(
  '/',
  authenticate,
  uploadTrackFiles .fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
  ]),
  asyncHandler(controller.uploadTrack)
);


module.exports = router;
