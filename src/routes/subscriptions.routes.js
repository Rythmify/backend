// ============================================================
// routes/subscriptions.routes.js
// Owner : Omar Hamdy (BE-1)
// Modules: Module 12 — Premium Subscription
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscriptions.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// TODO: Add route definitions here
// Example:
// router.get('/', authenticate, asyncHandler(controller.getAll));

module.exports = router;
