const express = require('express');
const router  = express.Router();
const controller   = require('../controllers/discovery.controller');
const asyncHandler = require('../utils/async-handler');
const { authenticate }         = require('../middleware/auth');
const { generalLimiter }       = require('../middleware/rate-limiter');


router.get(
  '/tracks/:track_id/related',
  generalLimiter,
  asyncHandler(controller.getRelatedTracks)
);

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


module.exports = router;