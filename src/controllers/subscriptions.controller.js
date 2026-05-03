// ============================================================
// controllers/subscriptions.controller.js
// Owner : Omar Hamdy (BE-1)
// Receives validated requests -> calls service -> returns HTTP response
// ============================================================
const subscriptionsService = require('../services/subscriptions.service');
const { success } = require('../utils/api-response');

const getAuthenticatedUserId = (req) => req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? null;
const getAuthenticatedUserRole = (req) => req.user?.role ?? null;

exports.listPlans = async (req, res) => {
  const data = await subscriptionsService.listPlans({
    userId: getAuthenticatedUserId(req),
    role: getAuthenticatedUserRole(req),
  });
  return success(res, data, 'Subscription plans fetched successfully.');
};

exports.getMySubscription = async (req, res) => {
  const data = await subscriptionsService.getMySubscription({
    userId: getAuthenticatedUserId(req),
    role: getAuthenticatedUserRole(req),
  });
  return success(res, data, 'Subscription fetched successfully.');
};

exports.createCheckout = async (req, res) => {
  const data = await subscriptionsService.createCheckout({
    userId: getAuthenticatedUserId(req),
    role: getAuthenticatedUserRole(req),
    subscriptionPlanId: req.body?.subscription_plan_id,
  });
  return success(res, data, 'Mock subscription checkout created successfully.', 201);
};

exports.mockConfirmPayment = async (req, res) => {
  const data = await subscriptionsService.mockConfirmPayment({
    userId: getAuthenticatedUserId(req),
    role: getAuthenticatedUserRole(req),
    transactionId: req.params?.transaction_id,
  });
  return success(res, data, 'Mock subscription payment confirmed successfully.');
};

exports.cancelMySubscription = async (req, res) => {
  const data = await subscriptionsService.cancelMySubscription({
    userId: getAuthenticatedUserId(req),
  });
  return success(res, data, 'Subscription auto-renew canceled successfully.');
};

exports.resetMySubscriptionForTesting = async (req, res) => {
  const data = await subscriptionsService.resetMySubscriptionForTesting({
    userId: getAuthenticatedUserId(req),
    role: getAuthenticatedUserRole(req),
  });
  return success(res, data, 'Subscription reset for development testing successfully.');
};

exports.listMyTransactions = async (req, res) => {
  const result = await subscriptionsService.listMyTransactions({
    userId: getAuthenticatedUserId(req),
    limit: req.query?.limit,
    offset: req.query?.offset,
    paymentStatus: req.query?.payment_status,
  });

  return success(
    res,
    result.data,
    'Subscription transactions fetched successfully.',
    200,
    result.pagination
  );
};
