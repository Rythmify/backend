// ============================================================
// routes/users.routes.js
// Owner : Omar Hamdy (BE-1)
// Modules: Module 2 — User Profile & Identity
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');


router.get('/me', authenticate ,asyncHandler(controller.getMe));
router.patch('/me', authenticate, asyncHandler(controller.updateMe));
router.get('/:user_id', optionalAuthenticate, asyncHandler(controller.getUserById));

module.exports = router;