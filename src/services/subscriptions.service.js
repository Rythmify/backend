// ============================================================
// services/subscriptions.service.js
// Owner : Omar Hamdy (BE-1)
// All business logic, rules & cross-module orchestration
// No direct SQL here - delegate to models/
// ============================================================

const subscriptionsModel = require('../models/subscription.model');
const AppError = require('../utils/app-error');
const PLAN_NAMES = require('../constants/subscription-plans');
const PAYMENT_STATUSES = require('../constants/payment-statuses');

const UUID_SHAPE_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const PAYMENT_STATUS_VALUES = new Set(Object.values(PAYMENT_STATUSES));

const assertAuthenticated = (userId) => {
  if (!userId) {
    throw new AppError('Authenticated user is required.', 401, 'UNAUTHORIZED');
  }
};

const assertValidUuid = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    throw new AppError(`${fieldName} is required.`, 400, 'VALIDATION_FAILED');
  }

  if (typeof value !== 'string' || !UUID_SHAPE_REGEX.test(value.trim())) {
    throw new AppError(`${fieldName} must be a valid UUID.`, 400, 'VALIDATION_FAILED');
  }
};

const parsePaginationNumber = ({ value, field, defaultValue, min, max = null }) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  const exceedsMax = max !== null && parsed > max;

  if (!Number.isInteger(parsed) || parsed < min || exceedsMax) {
    if (field === 'limit') {
      throw new AppError('limit must be an integer between 1 and 50.', 400, 'VALIDATION_FAILED');
    }

    throw new AppError(
      'offset must be an integer greater than or equal to 0.',
      400,
      'VALIDATION_FAILED'
    );
  }

  return parsed;
};

const assertPaymentStatus = (paymentStatus) => {
  if (paymentStatus === undefined || paymentStatus === null || paymentStatus === '') {
    return null;
  }

  if (!PAYMENT_STATUS_VALUES.has(paymentStatus)) {
    throw new AppError(
      `payment_status must be one of: ${Array.from(PAYMENT_STATUS_VALUES).join(', ')}.`,
      400,
      'VALIDATION_FAILED'
    );
  }

  return paymentStatus;
};

const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const toTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
};

const formatPlan = (plan) => ({
  subscription_plan_id: plan.subscription_plan_id,
  name: plan.name,
  price: plan.price,
  duration_days: plan.duration_days,
  track_limit: plan.track_limit,
  playlist_limit: plan.playlist_limit,
});

const formatJoinedPlan = (row) => ({
  subscription_plan_id: row.subscription_plan_id,
  name: row.plan_name,
  price: row.plan_price,
  duration_days: row.plan_duration_days,
  track_limit: row.plan_track_limit,
  playlist_limit: row.plan_playlist_limit,
});

const isUnlimited = (limit) => limit === null || limit === undefined;

const buildUsage = ({ tracksUploaded, playlistsCreated, plan, premiumActive }) => ({
  tracks_uploaded: tracksUploaded,
  track_limit: plan.track_limit,
  playlists_created: playlistsCreated,
  playlist_limit: plan.playlist_limit,
  can_upload_track:
    premiumActive || isUnlimited(plan.track_limit) || tracksUploaded < plan.track_limit,
  can_create_playlist:
    premiumActive || isUnlimited(plan.playlist_limit) || playlistsCreated < plan.playlist_limit,
  offline_listening_enabled: premiumActive,
});

const buildSubscriptionResponse = ({
  subscription = null,
  plan,
  tracksUploaded,
  playlistsCreated,
}) => {
  const premiumActive = Boolean(subscription);

  return {
    user_subscription_id: subscription?.user_subscription_id || null,
    status: 'active',
    auto_renew: premiumActive ? subscription.auto_renew : false,
    start_date: premiumActive ? toDateOnly(subscription.start_date) : null,
    end_date: premiumActive ? toDateOnly(subscription.end_date) : null,
    plan,
    usage: buildUsage({
      tracksUploaded,
      playlistsCreated,
      plan,
      premiumActive,
    }),
  };
};

const formatTransaction = (transaction) => ({
  transaction_id: transaction.transaction_id,
  user_subscription_id: transaction.user_subscription_id,
  amount: transaction.amount,
  payment_method: transaction.payment_method,
  payment_status: transaction.payment_status,
  paid_at: toTimestamp(transaction.paid_at),
  created_at: toTimestamp(transaction.created_at),
});

exports.listPlans = async () => {
  const plans = await subscriptionsModel.findAllPlans();
  return { items: plans.map(formatPlan) };
};

exports.getMySubscription = async ({ userId }) => {
  assertAuthenticated(userId);

  const [activeSubscription, freePlan, tracksUploaded, playlistsCreated] = await Promise.all([
    subscriptionsModel.findActiveSubscriptionByUserId(userId),
    subscriptionsModel.findPlanByName(PLAN_NAMES.FREE),
    subscriptionsModel.countUserUploadedTracks(userId),
    subscriptionsModel.countUserCreatedPlaylists(userId),
  ]);

  if (!freePlan) {
    throw new AppError('Free subscription plan was not found.', 404, 'SUBSCRIPTION_PLAN_NOT_FOUND');
  }

  if (activeSubscription) {
    return buildSubscriptionResponse({
      subscription: activeSubscription,
      plan: formatJoinedPlan(activeSubscription),
      tracksUploaded,
      playlistsCreated,
    });
  }

  return buildSubscriptionResponse({
    plan: formatPlan(freePlan),
    tracksUploaded,
    playlistsCreated,
  });
};

exports.hasOfflineListeningEntitlement = async (userId) => {
  const subscription = await exports.getMySubscription({ userId });
  return Boolean(subscription?.usage?.offline_listening_enabled);
};

exports.assertCanUploadTrack = async (userId) => {
  assertAuthenticated(userId);
  assertValidUuid(userId, 'user_id');

  const [activeSubscription, freePlan, tracksUploaded] = await Promise.all([
    subscriptionsModel.findActiveSubscriptionByUserId(userId),
    subscriptionsModel.findPlanByName(PLAN_NAMES.FREE),
    subscriptionsModel.countUserUploadedTracks(userId),
  ]);

  if (activeSubscription) {
    return;
  }

  if (!freePlan) {
    throw new AppError('Free subscription plan was not found.', 404, 'SUBSCRIPTION_PLAN_NOT_FOUND');
  }

  if (isUnlimited(freePlan.track_limit) || tracksUploaded < freePlan.track_limit) {
    return;
  }

  throw new AppError(
    'Free plan track upload limit reached. Upgrade to premium for unlimited uploads.',
    403,
    'SUBSCRIPTION_LIMIT_REACHED'
  );
};

exports.createCheckout = async ({ userId, subscriptionPlanId }) => {
  assertAuthenticated(userId);
  assertValidUuid(subscriptionPlanId, 'subscription_plan_id');

  const plan = await subscriptionsModel.findPlanById(subscriptionPlanId.trim());

  if (!plan) {
    throw new AppError('Subscription plan not found.', 404, 'SUBSCRIPTION_PLAN_NOT_FOUND');
  }

  if (plan.name !== PLAN_NAMES.PREMIUM) {
    throw new AppError(
      'Free plan is not eligible for checkout.',
      422,
      'SUBSCRIPTION_PLAN_NOT_ELIGIBLE'
    );
  }

  const activeSubscription = await subscriptionsModel.findActiveSubscriptionByUserId(userId);
  if (activeSubscription) {
    throw new AppError(
      'User already has an active premium subscription.',
      409,
      'SUBSCRIPTION_ALREADY_ACTIVE'
    );
  }

  const pendingCheckout = await subscriptionsModel.findPendingCheckoutByUserId({
    userId,
    planId: plan.subscription_plan_id,
  });
  if (pendingCheckout) {
    throw new AppError(
      'User already has a pending checkout for this plan.',
      409,
      'SUBSCRIPTION_CHECKOUT_PENDING'
    );
  }

  const checkout = await subscriptionsModel.createPendingCheckout({
    userId,
    planId: plan.subscription_plan_id,
    durationDays: plan.duration_days,
    amount: plan.price,
  });

  return {
    transaction_id: checkout.transaction.transaction_id,
    user_subscription_id: checkout.subscription.user_subscription_id,
    checkout_status: checkout.transaction.payment_status,
    payment_method: checkout.transaction.payment_method,
    payment_url: `https://mock-stripe.rythmify.local/checkout/${checkout.transaction.transaction_id}`,
    plan: formatPlan(plan),
  };
};

exports.mockConfirmPayment = async ({ userId, transactionId }) => {
  assertAuthenticated(userId);
  assertValidUuid(transactionId, 'transaction_id');

  const existingTransaction = await subscriptionsModel.findTransactionForUser({
    transactionId: transactionId.trim(),
    userId,
  });

  if (!existingTransaction) {
    throw new AppError(
      'Subscription transaction not found.',
      404,
      'SUBSCRIPTION_TRANSACTION_NOT_FOUND'
    );
  }

  if (existingTransaction.payment_status === PAYMENT_STATUSES.PAID) {
    throw new AppError(
      'Subscription transaction is already paid.',
      409,
      'SUBSCRIPTION_TRANSACTION_ALREADY_PAID'
    );
  }

  if (existingTransaction.payment_status === PAYMENT_STATUSES.FAILED) {
    throw new AppError(
      'Failed subscription transactions cannot be confirmed.',
      422,
      'VALIDATION_FAILED'
    );
  }

  const durationDays = existingTransaction.plan_duration_days ?? 30;
  const result = await subscriptionsModel.confirmTransactionPayment({
    transactionId: existingTransaction.transaction_id,
    userSubscriptionId: existingTransaction.user_subscription_id,
    durationDays,
  });

  return {
    transaction_id: result.transaction.transaction_id,
    payment_status: result.transaction.payment_status,
    paid_at: toTimestamp(result.transaction.paid_at),
    subscription: {
      user_subscription_id: result.subscription.user_subscription_id,
      status: result.subscription.status,
      auto_renew: result.subscription.auto_renew,
      start_date: toDateOnly(result.subscription.start_date),
      end_date: toDateOnly(result.subscription.end_date),
      plan: formatJoinedPlan(existingTransaction),
    },
  };
};

exports.cancelMySubscription = async ({ userId }) => {
  assertAuthenticated(userId);

  const activeSubscription = await subscriptionsModel.findActiveSubscriptionByUserId(userId);
  if (!activeSubscription) {
    throw new AppError('Active premium subscription not found.', 404, 'SUBSCRIPTION_NOT_FOUND');
  }

  if (!activeSubscription.auto_renew) {
    throw new AppError(
      'Subscription auto-renew is already canceled.',
      409,
      'SUBSCRIPTION_ALREADY_CANCELED'
    );
  }

  const canceled = await subscriptionsModel.cancelAutoRenew(
    activeSubscription.user_subscription_id
  );

  return {
    user_subscription_id: canceled.user_subscription_id,
    status: canceled.status,
    auto_renew: canceled.auto_renew,
    end_date: toDateOnly(canceled.end_date),
  };
};

exports.listMyTransactions = async ({ userId, limit, offset, paymentStatus }) => {
  assertAuthenticated(userId);

  const parsedLimit = parsePaginationNumber({
    value: limit,
    field: 'limit',
    defaultValue: 20,
    min: 1,
    max: 50,
  });
  const parsedOffset = parsePaginationNumber({
    value: offset,
    field: 'offset',
    defaultValue: 0,
    min: 0,
  });
  const normalizedPaymentStatus = assertPaymentStatus(paymentStatus);

  const [transactions, total] = await Promise.all([
    subscriptionsModel.listTransactionsByUser({
      userId,
      limit: parsedLimit,
      offset: parsedOffset,
      paymentStatus: normalizedPaymentStatus,
    }),
    subscriptionsModel.countTransactionsByUser({
      userId,
      paymentStatus: normalizedPaymentStatus,
    }),
  ]);

  return {
    data: transactions.map(formatTransaction),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
    },
  };
};

exports.assertValidUuid = assertValidUuid;
exports.parsePaginationNumber = parsePaginationNumber;
exports.assertPaymentStatus = assertPaymentStatus;
