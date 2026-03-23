const express = require('express');
const router = express.Router();
const controller = require('../controllers/tags.controller');
const asyncHandler = require('../utils/async-handler');

// GET /api/v1/tags
router.get('/', asyncHandler(controller.getAllTags));

module.exports = router;