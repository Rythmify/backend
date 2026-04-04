// ============================================================
// routes/playback.routes.js
// Owner : Saja Aboulmagd (BE-2)
// Modules: Module 5 — Playback & Streaming
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/playback.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

router.get('/player/state', authenticate, asyncHandler(controller.getPlayerState));

module.exports = router;
