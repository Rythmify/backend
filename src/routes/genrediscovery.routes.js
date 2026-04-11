const express = require('express');
const router = express.Router();
const controller = require('../controllers/genrediscovery.controller');
const asyncHandler = require('../utils/async-handler');
//const { authenticate } = require('../middleware/auth');
const { optionalAuthenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rate-limiter');

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

module.exports = router;
