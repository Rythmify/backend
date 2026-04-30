// ============================================================
// services/subscriptions.service.js
// Owner : Omar Hamdy (BE-1)
// All business logic, rules & cross-module orchestration
// No direct SQL here - delegate to models/
// ============================================================

const subscriptionsModel = require('../models/subscription.model');
const notificationModel = require('../models/notification.model');
const AppError = require('../utils/app-error');
const PLAN_NAMES = require('../constants/subscription-plans');
const PAYMENT_STATUSES = require('../constants/payment-statuses');
const USER_ROLES = require('../constants/user-roles');

const UUID_SHAPE_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const PAYMENT_STATUS_VALUES = new Set(Object.values(PAYMENT_STATUSES));
const MAX_AUTO_RENEWALS_PER_REFRESH = 500;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const toTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
};

const getPlanDurationMs = (plan) => {
  if (plan.duration_minutes !== null && plan.duration_minutes !== undefined) {
    return Number(plan.duration_minutes) * MS_PER_MINUTE;
  }

  if (plan.duration_days !== null && plan.duration_days !== undefined) {
    return Number(plan.duration_days) * MS_PER_DAY;
  }

  return null;
};

const buildRenewalSchedule = ({
  previousEndDate,
  now = new Date(),
  durationMs,
  maxRenewals = MAX_AUTO_RENEWALS_PER_REFRESH,
}) => {
  const previousEndMs = new Date(previousEndDate).getTime();
  const nowMs = new Date(now).getTime();

  if (!Number.isFinite(previousEndMs) || !Number.isFinite(nowMs) || nowMs < previousEndMs) {
    return { renewalPaidAtDates: [], nextEndDate: new Date(previousEndMs) };
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { renewalPaidAtDates: [], nextEndDate: new Date(previousEndMs) };
  }

  const elapsedMs = nowMs - previousEndMs;
  const renewalCount = Math.min(maxRenewals, Math.max(1, Math.floor(elapsedMs / durationMs)));
  const renewalPaidAtDates = [];

  if (elapsedMs < durationMs) {
    renewalPaidAtDates.push(new Date(nowMs));
  } else {
    for (let index = 1; index <= renewalCount; index += 1) {
      renewalPaidAtDates.push(new Date(previousEndMs + durationMs * index));
    }
  }

  let periodsAdvanced = renewalCount;
  let nextEndMs = previousEndMs + durationMs * periodsAdvanced;
  while (nextEndMs <= nowMs && periodsAdvanced < maxRenewals) {
    nextEndMs += durationMs;
    periodsAdvanced += 1;
  }
  if (nextEndMs <= nowMs) {
    nextEndMs = nowMs + durationMs;
  }

  return {
    renewalPaidAtDates,
    nextEndDate: new Date(nextEndMs),
  };
};

const getPremiumDisplayNameForRole = (role) => (role === USER_ROLES.ARTIST ? 'Artist Pro' : 'Go+');

const getEffectiveRole = async ({ userId, fallbackRole = null }) => {
  if (!userId) {
    return fallbackRole;
  }

  const currentRole = await subscriptionsModel.findUserRoleById(userId);
  return currentRole || fallbackRole;
};

const getListenerTrackLimit = ({ freePlan = null, premiumPlan }) =>
  freePlan && Object.prototype.hasOwnProperty.call(freePlan, 'track_limit')
    ? freePlan.track_limit
    : premiumPlan.track_limit;

const formatPlanForRole = (plan, role = null, options = {}) => {
  const formatted = {
    subscription_plan_id: plan.subscription_plan_id,
    name: plan.name,
    display_name: plan.name === PLAN_NAMES.FREE ? 'Free' : getPremiumDisplayNameForRole(role),
    price: plan.price,
    duration_days: plan.duration_days,
    duration_minutes: plan.duration_minutes,
    track_limit: plan.track_limit,
    playlist_limit: plan.playlist_limit,
  };

  if (plan.name === PLAN_NAMES.PREMIUM) {
    formatted.track_limit =
      role === USER_ROLES.ARTIST
        ? null
        : getListenerTrackLimit({ freePlan: options.freePlan, premiumPlan: plan });
  }

  return formatted;
};

const formatJoinedPlanForRole = (row, role = null, options = {}) =>
  formatPlanForRole(
    {
      subscription_plan_id: row.subscription_plan_id,
      name: row.plan_name,
      price: row.plan_price,
      duration_days: row.plan_duration_days,
      duration_minutes: row.plan_duration_minutes,
      track_limit: row.plan_track_limit,
      playlist_limit: row.plan_playlist_limit,
    },
    role,
    options
  );

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
    start_date: premiumActive ? toTimestamp(subscription.start_date) : null,
    end_date: premiumActive ? toTimestamp(subscription.end_date) : null,
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

const formatRawPlanFromActiveSubscription = (subscription) => ({
  subscription_plan_id: subscription.subscription_plan_id,
  name: subscription.plan_name,
  price: subscription.plan_price,
  duration_days: subscription.plan_duration_days,
  duration_minutes: subscription.plan_duration_minutes,
  track_limit: subscription.plan_track_limit,
  playlist_limit: subscription.plan_playlist_limit,
});

exports.refreshUserSubscription = async (userId) => {
  assertAuthenticated(userId);

  return subscriptionsModel.withSubscriptionRefreshLock(
    userId,
    async ({ subscription, client }) => {
      if (!subscription) {
        return null;
      }

      if (!subscription.end_date || new Date(subscription.end_date).getTime() > Date.now()) {
        return subscription;
      }

      if (!subscription.auto_renew) {
        await subscriptionsModel.markSubscriptionExpired(subscription.user_subscription_id, client);
        return null;
      }

      const durationMs = getPlanDurationMs(formatRawPlanFromActiveSubscription(subscription));
      if (!durationMs) {
        await subscriptionsModel.markSubscriptionExpired(subscription.user_subscription_id, client);
        return null;
      }

      const { renewalPaidAtDates, nextEndDate } = buildRenewalSchedule({
        previousEndDate: subscription.end_date,
        durationMs,
      });

      for (const paidAt of renewalPaidAtDates) {
        await subscriptionsModel.createPaidRenewalTransaction(
          {
            userSubscriptionId: subscription.user_subscription_id,
            amount: subscription.plan_price,
            paidAt,
          },
          client
        );
      }

      const updated = await subscriptionsModel.updateSubscriptionEndDate(
        {
          userSubscriptionId: subscription.user_subscription_id,
          endDate: nextEndDate,
        },
        client
      );

      return {
        ...subscription,
        status: updated?.status || subscription.status,
        start_date: updated?.start_date || subscription.start_date,
        end_date: updated?.end_date || nextEndDate,
        auto_renew: updated?.auto_renew ?? subscription.auto_renew,
      };
    }
  );
};

exports.getEffectiveActivePlanForUser = async (userId) => {
  assertAuthenticated(userId);

  const [activeSubscription, freePlan] = await Promise.all([
    exports.refreshUserSubscription(userId),
    subscriptionsModel.findPlanByName(PLAN_NAMES.FREE),
  ]);

  if (activeSubscription) {
    return formatRawPlanFromActiveSubscription(activeSubscription);
  }

  if (!freePlan) {
    throw new AppError('Free subscription plan was not found.', 404, 'SUBSCRIPTION_PLAN_NOT_FOUND');
  }

  return freePlan;
};

exports.listPlans = async ({ userId = null, role = null } = {}) => {
  const [plans, effectiveRole] = await Promise.all([
    subscriptionsModel.findAllPlans(),
    getEffectiveRole({ userId, fallbackRole: role }),
  ]);
  const freePlan = plans.find((plan) => plan.name === PLAN_NAMES.FREE);
  const premiumPlan = plans.find((plan) => plan.name === PLAN_NAMES.PREMIUM);
  const items = [];

  if (freePlan) {
    items.push(formatPlanForRole(freePlan));
  }

  if (!premiumPlan) {
    return { items };
  }

  if (!userId) {
    items.push(
      formatPlanForRole(premiumPlan, USER_ROLES.LISTENER, { freePlan }),
      formatPlanForRole(premiumPlan, USER_ROLES.ARTIST, { freePlan })
    );
    return { items };
  }

  items.push(formatPlanForRole(premiumPlan, effectiveRole, { freePlan }));
  return { items };
};

exports.getMySubscription = async ({ userId, role = null }) => {
  assertAuthenticated(userId);

  const [activeSubscription, freePlan, tracksUploaded, playlistsCreated, effectiveRole] =
    await Promise.all([
      exports.refreshUserSubscription(userId),
      subscriptionsModel.findPlanByName(PLAN_NAMES.FREE),
      subscriptionsModel.countUserUploadedTracks(userId),
      subscriptionsModel.countUserCreatedPlaylists(userId),
      getEffectiveRole({ userId, fallbackRole: role }),
    ]);

  if (!freePlan) {
    throw new AppError('Free subscription plan was not found.', 404, 'SUBSCRIPTION_PLAN_NOT_FOUND');
  }

  if (activeSubscription) {
    return buildSubscriptionResponse({
      subscription: activeSubscription,
      plan: formatJoinedPlanForRole(activeSubscription, effectiveRole, { freePlan }),
      tracksUploaded,
      playlistsCreated,
    });
  }

  return buildSubscriptionResponse({
    plan: formatPlanForRole(freePlan, effectiveRole),
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
    exports.refreshUserSubscription(userId),
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

exports.createCheckout = async ({ userId, subscriptionPlanId, role = null }) => {
  assertAuthenticated(userId);
  assertValidUuid(subscriptionPlanId, 'subscription_plan_id');

  const [plan, freePlan, effectiveRole] = await Promise.all([
    subscriptionsModel.findPlanById(subscriptionPlanId.trim()),
    subscriptionsModel.findPlanByName(PLAN_NAMES.FREE),
    getEffectiveRole({ userId, fallbackRole: role }),
  ]);

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

  const activeSubscription = await exports.refreshUserSubscription(userId);
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
    durationMs: getPlanDurationMs(plan),
    amount: plan.price,
  });

  return {
    transaction_id: checkout.transaction.transaction_id,
    user_subscription_id: checkout.subscription.user_subscription_id,
    checkout_status: checkout.transaction.payment_status,
    payment_method: checkout.transaction.payment_method,
    payment_url: `https://mock-stripe.rythmify.local/checkout/${checkout.transaction.transaction_id}`,
    plan: formatPlanForRole(plan, effectiveRole, { freePlan }),
  };
};

exports.mockConfirmPayment = async ({ userId, transactionId, role = null }) => {
  assertAuthenticated(userId);
  assertValidUuid(transactionId, 'transaction_id');

  const [existingTransaction, freePlan, effectiveRole] = await Promise.all([
    subscriptionsModel.findTransactionForUser({
      transactionId: transactionId.trim(),
      userId,
    }),
    subscriptionsModel.findPlanByName(PLAN_NAMES.FREE),
    getEffectiveRole({ userId, fallbackRole: role }),
  ]);

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

  const durationMs =
    getPlanDurationMs({
      duration_minutes: existingTransaction.plan_duration_minutes,
      duration_days: existingTransaction.plan_duration_days,
    }) ?? 30 * MS_PER_DAY;
  const result = await subscriptionsModel.confirmTransactionPayment({
    transactionId: existingTransaction.transaction_id,
    userSubscriptionId: existingTransaction.user_subscription_id,
    durationMs,
  });

  // Trigger artist pro activated notification if user is upgrading to premium artist plan
  if (
    existingTransaction.plan_name === PLAN_NAMES.PREMIUM &&
    (effectiveRole === USER_ROLES.ARTIST || effectiveRole === 'artist')
  ) {
    notificationModel
      .createNotification({
        userId,
        actionUserId: null,
        type: 'artist_pro_activated',
        referenceId: null,
        referenceType: null,
      })
      .catch((err) =>
        console.error(
          '[Notification] Failed to create artist pro activated notification:',
          err?.message
        )
      );
  }

  return {
    transaction_id: result.transaction.transaction_id,
    payment_status: result.transaction.payment_status,
    paid_at: toTimestamp(result.transaction.paid_at),
    subscription: {
      user_subscription_id: result.subscription.user_subscription_id,
      status: result.subscription.status,
      auto_renew: result.subscription.auto_renew,
      start_date: toTimestamp(result.subscription.start_date),
      end_date: toTimestamp(result.subscription.end_date),
      plan: formatJoinedPlanForRole(existingTransaction, effectiveRole, { freePlan }),
    },
  };
};

exports.cancelMySubscription = async ({ userId }) => {
  assertAuthenticated(userId);

  const activeSubscription = await exports.refreshUserSubscription(userId);
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
    end_date: toTimestamp(canceled.end_date),
  };
};

exports.resetMySubscriptionForTesting = async ({ userId, role = null }) => {
  assertAuthenticated(userId);

  if (process.env.NODE_ENV !== 'development') {
    throw new AppError(
      'This endpoint is only available in development.',
      404,
      'SUBSCRIPTION_TEST_TOOLS_DISABLED'
    );
  }

  await subscriptionsModel.expireCurrentPremiumSubscriptionForTesting(userId);

  return exports.getMySubscription({ userId, role });
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
exports.getPremiumDisplayNameForRole = getPremiumDisplayNameForRole;
exports.formatPlanForRole = formatPlanForRole;
exports.getPlanDurationMs = getPlanDurationMs;
exports.buildRenewalSchedule = buildRenewalSchedule;
