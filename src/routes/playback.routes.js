// ============================================================
// routes/playback.routes.js
// Owner : Saja Aboulmagd (BE-2)
// Modules: Module 5 — Playback & Streaming
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/playback.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const {
  playbackEventLimiter,
  playbackWriteLimiter,
} = require('../middleware/rate-limiter');
const { validateUuidParam } = require('../middleware/validate-params');
const asyncHandler = require('../utils/async-handler');

router.post(
  '/tracks/:track_id/play',
  optionalAuthenticate,
  validateUuidParam('track_id'),
  playbackEventLimiter,
  asyncHandler(controller.playTrack)
);
router.get(
  '/tracks/:track_id/playback-state',
  optionalAuthenticate,
  asyncHandler(controller.getPlaybackState)
);
router.get('/me/history', authenticate, asyncHandler(controller.getRecentlyPlayed));
router.delete(
  '/me/history',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.clearListeningHistory)
);
router.get('/me/listening-history', authenticate, asyncHandler(controller.getListeningHistory));
router.post(
  '/me/playback/sync',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.syncPlayback)
);
router.get('/me/player/state', authenticate, asyncHandler(controller.getPlayerState));
router.post(
  '/me/player/state',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.savePlayerState)
);
router.post(
  '/me/player/queue/context',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.addQueueContext)
);
router.patch(
  '/me/player/queue',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.reorderPlayerQueue)
);
router.delete(
  '/me/player/queue',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.clearPlayerQueue)
);
router.delete(
  '/me/player/queue/items/:queue_item_id',
  authenticate,
  playbackWriteLimiter,
  asyncHandler(controller.removeQueueItem)
);

module.exports = router;
