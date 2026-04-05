const express = require('express');
const router = express.Router();
const controller = require('../controllers/discovery.controller');
const asyncHandler = require('../utils/async-handler');
const { authenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rate-limiter');

router.get('/tracks/:track_id/related', generalLimiter, asyncHandler(controller.getRelatedTracks));

router.get(
  '/home/hot-for-you',
  generalLimiter,
  authenticate,
  asyncHandler(controller.getHotForYou)
);

router.get(
  '/home/trending-by-genre/:genre_id',
  generalLimiter,
  asyncHandler(controller.getTrendingByGenre)
);

// Full genre page (aggregates tracks, albums, playlists, artists in one call)
router.get(
  '/genres/:genre_id/page',
  generalLimiter,
  authenticate,
  asyncHandler(controller.getGenrePage)
);

// called when user clicks see all for a genre on the homepage (e.g. "Trending in Pop").
// or when moving to the tab for playlist or albums in a genre page.
router.get('/genres/:genre_id/tracks', generalLimiter, asyncHandler(controller.getGenreTracks));

router.get('/genres/:genre_id/albums', generalLimiter, asyncHandler(controller.getGenreAlbums));

router.get(
  '/genres/:genre_id/playlists',
  generalLimiter,
  asyncHandler(controller.getGenrePlaylists)
);

router.get(
  '/genres/:genre_id/artists',
  generalLimiter,
  authenticate,
  asyncHandler(controller.getGenreArtists)
);

module.exports = router;
