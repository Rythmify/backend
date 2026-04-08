const express = require('express');
const router = express.Router();
const controller = require('../controllers/genres.controller');
const asyncHandler = require('../utils/async-handler');

// GET /api/v1/genres
router.get('/', asyncHandler(controller.getAllGenres));

module.exports = router;
