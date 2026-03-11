// ============================================================
// routes/followers.routes.js
// Owner : Beshoy Maher (BE-3)
// Modules: Module 3 — Followers & Social Graph
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/followers.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

module.exports = router;
