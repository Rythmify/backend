const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authLimiter, refreshLimiter } = require('../middleware/rate-limiter');
const { validateRegister } = require('../middleware/validate-register');
const asyncHandler = require('../utils/async-handler');


router.post('/register',        authLimiter,    validateRegister, asyncHandler(controller.register));
router.post('/verify-email',    authLimiter,    asyncHandler(controller.verifyEmail));
router.post('/login',           authLimiter,    asyncHandler(controller.login));
router.post('/refresh',         refreshLimiter, asyncHandler(controller.refresh));
router.post('/logout',                          asyncHandler(controller.logout));
router.post('/forgot-password', authLimiter,    asyncHandler(controller.requestPasswordReset));
router.post('/reset-password',  authLimiter,    asyncHandler(controller.resetPassword));


// i didn't implement the controllers yet


// router.post('/resend-verification',  asyncHandler(controller.resendVerification));


module.exports = router;
