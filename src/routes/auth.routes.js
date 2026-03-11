// ============================================================
// routes/auth.routes.js
// Owner : Omar Hamdy (BE-1)
// Modules: Module 1 — Authentication
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

module.exports = router;
