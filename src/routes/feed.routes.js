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
const { validateUuidParam, validatePatternParam } = require('../middleware/validate-params');

const MIX_ID_REGEX = /^mix_genre_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public / optional-auth routes
router.get('/home', optionalAuthenticate, asyncHandler(controller.getHome));
router.get('/home/hot-for-you', optionalAuthenticate, asyncHandler(controller.getHotForYou));
router.get(
  '/home/trending-by-genre/:genre_id',
  optionalAuthenticate,
  validateUuidParam('genre_id'),
  asyncHandler(controller.getTrendingByGenre)
);
router.get('/home/stations', optionalAuthenticate, asyncHandler(controller.listStations));
router.get(
  '/home/stations/:artist_id/tracks',
  optionalAuthenticate,
  validateUuidParam('artist_id'),
  asyncHandler(controller.getStationTracks)
);
router.get(
  '/home/artists-to-watch',
  optionalAuthenticate,
  asyncHandler(controller.getArtistsToWatch)
);

// Authenticated routes
router.get(
  '/home/more-of-what-you-like',
  authenticate,
  asyncHandler(controller.getMoreOfWhatYouLike)
);
router.get('/home/albums-for-you', authenticate, asyncHandler(controller.getAlbumsForYou));
router.get('/home/made-for-you/daily', authenticate, asyncHandler(controller.getDailyMix));
router.get('/home/made-for-you/weekly', authenticate, asyncHandler(controller.getWeeklyMix));

// NOTE: :mixId route must come AFTER all static /home/* routes to avoid shadowing
router.get(
  '/home/mixes/:mixId',
  authenticate,
  validatePatternParam('mixId', MIX_ID_REGEX, 'mixId must match format mix_genre_<uuid>.'),
  asyncHandler(controller.getMixById)
);

module.exports = router;
