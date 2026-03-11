// ============================================================
// routes/admin.routes.js
// Owner : Omar Hamza (BE-5)
// Modules: Module 11 — Moderation & Admin
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

module.exports = router;
