// ============================================================
// routes/auth.routes.js
// Owner : Omar Hamdy (BE-1)
// Module 1 — Authentication
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rate-limiter');
const {authenticate} = require('../middleware/auth');
const { validateRegister } = require('../middleware/validate-register');
const asyncHandler = require('../utils/async-handler');

// Apply auth rate limiter to ALL routes in this file
router.use(authLimiter);

// POST /api/v1/auth/register
router.post('/register',    validateRegister, asyncHandler(controller.register));
router.post('/verify-email', asyncHandler(controller.verifyEmail)); 
router.post('/resend-verification',   asyncHandler(controller.resendVerification));
router.post('/login',        asyncHandler(controller.login));
router.post('/refresh',      asyncHandler(controller.refresh));
router.post('/logout',       asyncHandler(controller.logout));    
router.post('/forgot-password', asyncHandler(controller.requestPasswordReset));
router.post('/reset-password', asyncHandler(controller.resetPassword));
router.post('/verify-email-change',   asyncHandler(controller.verifyEmailChange));

// Protected routes
router.post('/change-email',   authenticate, asyncHandler(controller.changeEmail));


// router.post('/resend-verification',  asyncHandler(controller.resendVerification));


module.exports = router;
