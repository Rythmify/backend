const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const {
  getSuggestedUsers,
  getSuggestedArtists,
} = require('../controllers/followdiscovery.controller');

router.use(authenticate);

router.get('/suggested', asyncHandler(getSuggestedUsers));
router.get('/suggested/artists', asyncHandler(getSuggestedArtists));

module.exports = router;
