// ============================================================
// routes/playback.routes.js
// Owner : Saja Aboulmagd (BE-2)
// Modules: Module 5 — Playback & Streaming
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/playback.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

router.post('/tracks/:track_id/play', optionalAuthenticate, asyncHandler(controller.playTrack));
router.get(
  '/tracks/:track_id/playback-state',
  optionalAuthenticate,
  asyncHandler(controller.getPlaybackState)
);
router.get('/me/player/state', authenticate, asyncHandler(controller.getPlayerState));
router.post('/me/player/state', authenticate, asyncHandler(controller.savePlayerState));

module.exports = router;
