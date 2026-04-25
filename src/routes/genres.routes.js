const express = require('express');
const router = express.Router();
const controller = require('../controllers/genres.controller');
const feedController = require('../controllers/feed.controller');
const asyncHandler = require('../utils/async-handler');
const { optionalAuthenticate, authenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rate-limiter');
const { validateUuidParam } = require('../middleware/validate-params');

// GET /api/v1/genres
router.get('/', asyncHandler(controller.getAllGenres));

// Full genre page (aggregates tracks, albums, playlists, artists in one call)
router.get(
  '/:genre_id/page',
  generalLimiter,
  optionalAuthenticate,
  asyncHandler(controller.getGenrePage)
);

// called when user clicks see all for a genre on the homepage (e.g. "Trending in Pop").
// or when moving to the tab for playlist or albums in a genre page.
router.get('/:genre_id/tracks', generalLimiter, asyncHandler(controller.getGenreTracks));

router.get('/:genre_id/albums', generalLimiter, asyncHandler(controller.getGenreAlbums));

router.get('/:genre_id/playlists', generalLimiter, asyncHandler(controller.getGenrePlaylists));

router.get(
  '/:genre_id/artists',
  generalLimiter,
  optionalAuthenticate,
  asyncHandler(controller.getGenreArtists)
);

// Genre trending like / unlike
router.post(
  '/:genre_id/like',
  authenticate,
  validateUuidParam('genre_id'),
  asyncHandler(feedController.likeGenreTrending)
);
router.delete(
  '/:genre_id/like',
  authenticate,
  validateUuidParam('genre_id'),
  asyncHandler(feedController.unlikeGenreTrending)
);

module.exports = router;
