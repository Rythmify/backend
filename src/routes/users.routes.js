// ============================================================
// routes/users.routes.js
// Owner : Omar Hamdy (BE-1)
// Modules: Module 2 — User Profile & Identity
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

module.exports = router;
