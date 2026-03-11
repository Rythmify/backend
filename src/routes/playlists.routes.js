// ============================================================
// routes/playlists.routes.js
// Owner : Alyaa Mohamed (BE-4)
// Modules: Module 7 — Playlists & Sets
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/playlists.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

module.exports = router;
