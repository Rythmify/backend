// ============================================================
// routes/insights.routes.js
// Creator insights routes.
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/insights.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

router.get('/me/insights', authenticate, asyncHandler(controller.getMyInsights));

module.exports = router;
