const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authLimiter, refreshLimiter } = require('../middleware/rate-limiter');
const { validateRegister } = require('../middleware/validate-register');
const asyncHandler = require('../utils/async-handler');
const { authenticate } = require('../middleware/auth');

router.post('/register', authLimiter, validateRegister, asyncHandler(controller.register));
router.post('/verify-email', authLimiter, asyncHandler(controller.verifyEmail));
router.post('/resend-verification', authLimiter, asyncHandler(controller.resendVerification));
router.post('/login', authLimiter, asyncHandler(controller.login));
router.post('/refresh', refreshLimiter, asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.post('/forgot-password', authLimiter, asyncHandler(controller.requestPasswordReset));
router.post('/reset-password', authLimiter, asyncHandler(controller.resetPassword));
router.post('/verify-email-change', authLimiter, asyncHandler(controller.verifyEmailChange));

// Protected routes
router.post('/change-email', authenticate, asyncHandler(controller.changeEmail));
router.post('/google', authLimiter, asyncHandler(controller.googleLogin));

// GitHub OAuth routes
router.get('/oauth/github', asyncHandler(controller.githubOAuth));
router.get('/oauth/github/callback', asyncHandler(controller.githubOAuthCallback));

router.delete('/me', authenticate, asyncHandler(controller.deleteAccount));

module.exports = router;
