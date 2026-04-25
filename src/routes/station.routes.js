// ============================================================
// routes/station.routes.js
// Owner : Omar Hamza (BE-5)
// Station save/unsave + saved stations list
// ============================================================
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const stationController = require('../controllers/station.controller');
const { validateUuidParam } = require('../middleware/validate-params');

router.post(
  '/stations/:artist_id/like',
  authenticate,
  validateUuidParam('artist_id'),
  asyncHandler(stationController.likeStation)
);

router.delete(
  '/stations/:artist_id/like',
  authenticate,
  validateUuidParam('artist_id'),
  asyncHandler(stationController.unlikeStation)
);

router.get('/users/me/stations', authenticate, asyncHandler(stationController.getUserSavedStations));

module.exports = router;
