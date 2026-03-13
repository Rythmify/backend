// ============================================================
// routes/auth.routes.js
// Owner : Omar Hamdy (BE-1)
// Module 1 — Authentication
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rate-limiter');
const { validateRegister } = require('../middleware/validate-register');
const asyncHandler = require('../utils/async-handler');

// Apply auth rate limiter to ALL routes in this file
router.use(authLimiter);

// POST /api/v1/auth/register
router.post('/register', validateRegister, asyncHandler(controller.register));

router.post('/login', asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
// i didn't implement the controllers yet
// router.post('/register',             asyncHandler(controller.register));
// router.post('/verify-email',         asyncHandler(controller.verifyEmail));
// router.post('/resend-verification',  asyncHandler(controller.resendVerification));
// router.post('/login',                asyncHandler(controller.login));
// router.post('/logout',               asyncHandler(controller.logout));

module.exports = router;
