// ============================================================
// routes/feed.routes.js
// Owner : Omar Hamza (BE-5)
// Modules: Module 8 — Feed, Search & Discovery
// ============================================================
const express = require('express');
const router = express.Router();
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const controller = require('../controllers/feed.controller');
// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

router.get('/home', optionalAuthenticate, asyncHandler(controller.getHome));

router.get(
  '/home/more-of-what-you-like',
  authenticate,
  asyncHandler(controller.getMoreOfWhatYouLike)
);

router.get('/home/albums-for-you', authenticate, asyncHandler(controller.getAlbumsForYou));

router.get('/home/made-for-you/daily', authenticate, asyncHandler(controller.getDailyMix));

router.get('/home/made-for-you/weekly', authenticate, asyncHandler(controller.getWeeklyMix));

router.get('/home/mixes/:mixId', authenticate, asyncHandler(controller.getMixById));

module.exports = router;
