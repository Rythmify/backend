// ============================================================
// routes/subscriptions.routes.js
// Owner : Omar Hamdy (BE-1)
// Modules: Module 12 - Premium Subscription
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscriptions.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/validate-params');
const asyncHandler = require('../utils/async-handler');

router.get('/plans', optionalAuthenticate, asyncHandler(controller.listPlans));
router.get('/me', authenticate, asyncHandler(controller.getMySubscription));
router.post('/checkout', authenticate, asyncHandler(controller.createCheckout));
router.post(
  '/mock-confirm/:transaction_id',
  authenticate,
  validateUuidParam('transaction_id'),
  asyncHandler(controller.mockConfirmPayment)
);
router.post('/cancel', authenticate, asyncHandler(controller.cancelMySubscription));
if (process.env.NODE_ENV === 'development') {
  router.post(
    '/me/dev-reset',
    authenticate,
    asyncHandler(controller.resetMySubscriptionForTesting)
  );
}
router.get('/transactions', authenticate, asyncHandler(controller.listMyTransactions));

module.exports = router;
