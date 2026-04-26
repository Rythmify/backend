// ============================================================
// models/subscription.model.js
// PostgreSQL queries for subscription runtime endpoints
// All SQL lives HERE - no SQL outside models/
// ============================================================
const db = require('../config/db');

const PLAN_SELECT = `
  id AS subscription_plan_id,
  name,
  price,
  duration_days,
  duration_minutes,
  track_limit,
  playlist_limit
`;

const SUBSCRIPTION_WITH_PLAN_SELECT = `
  us.id AS user_subscription_id,
  us.status,
  us.start_date,
  us.end_date,
  us.auto_renew,
  sp.id AS subscription_plan_id,
  sp.name AS plan_name,
  sp.price AS plan_price,
  sp.duration_days AS plan_duration_days,
  sp.duration_minutes AS plan_duration_minutes,
  sp.track_limit AS plan_track_limit,
  sp.playlist_limit AS plan_playlist_limit
`;

const getExecutor = (client) => client || db;

const findAllPlans = async () => {
  const { rows } = await db.query(
    `
      SELECT ${PLAN_SELECT}
      FROM subscription_plans
      ORDER BY
        CASE name
          WHEN 'free' THEN 1
          WHEN 'premium' THEN 2
          ELSE 3
        END,
        price ASC,
        name ASC
    `
  );
  return rows;
};

const findPlanById = async (planId) => {
  const { rows } = await db.query(
    `
      SELECT ${PLAN_SELECT}
      FROM subscription_plans
      WHERE id = $1
      LIMIT 1
    `,
    [planId]
  );
  return rows[0] || null;
};

const findPlanByName = async (name) => {
  const { rows } = await db.query(
    `
      SELECT ${PLAN_SELECT}
      FROM subscription_plans
      WHERE name = $1
      LIMIT 1
    `,
    [name]
  );
  return rows[0] || null;
};

const findUserRoleById = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT role
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId]
  );
  return rows[0]?.role || null;
};

const findActiveSubscriptionByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT ${SUBSCRIPTION_WITH_PLAN_SELECT}
      FROM user_subscriptions us
      JOIN subscription_plans sp
        ON sp.id = us.subscription_plan_id
      WHERE us.user_id = $1
        AND us.status = 'active'
        AND sp.name = 'premium'
        AND (us.end_date IS NULL OR us.end_date > NOW())
      ORDER BY us.end_date DESC NULLS LAST, us.created_at DESC
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
};

const findPendingCheckoutByUserId = async ({ userId, planId }) => {
  const { rows } = await db.query(
    `
      SELECT
        us.id AS user_subscription_id,
        t.id AS transaction_id
      FROM user_subscriptions us
      JOIN transactions t
        ON t.user_subscription_id = us.id
      WHERE us.user_id = $1
        AND us.subscription_plan_id = $2
        AND us.status = 'pending'
        AND t.payment_status = 'pending'
      ORDER BY t.created_at DESC
      LIMIT 1
    `,
    [userId, planId]
  );
  return rows[0] || null;
};

const createPendingSubscription = async ({ userId, planId, durationMs }, client = null) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      INSERT INTO user_subscriptions (
        user_id,
        subscription_plan_id,
        status,
        start_date,
        end_date,
        auto_renew
      )
      VALUES (
        $1,
        $2,
        'pending',
        NOW(),
        CASE
          WHEN $3::double precision IS NULL THEN NULL
          ELSE NOW() + ($3::double precision * INTERVAL '1 millisecond')
        END,
        true
      )
      RETURNING
        id AS user_subscription_id,
        status,
        start_date,
        end_date,
        auto_renew,
        created_at
    `,
    [userId, planId, durationMs]
  );
  return rows[0] || null;
};

const createPendingTransaction = async ({ userSubscriptionId, amount }, client = null) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      INSERT INTO transactions (
        user_subscription_id,
        amount,
        payment_method,
        payment_status
      )
      VALUES ($1, $2, 'mock', 'pending')
      RETURNING
        id AS transaction_id,
        user_subscription_id,
        amount,
        payment_method,
        payment_status,
        paid_at,
        created_at
    `,
    [userSubscriptionId, amount]
  );
  return rows[0] || null;
};

const createPendingCheckout = async ({ userId, planId, durationMs, amount }) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const subscription = await createPendingSubscription({ userId, planId, durationMs }, client);
    const transaction = await createPendingTransaction(
      {
        userSubscriptionId: subscription.user_subscription_id,
        amount,
      },
      client
    );
    await client.query('COMMIT');
    return { subscription, transaction };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const findTransactionForUser = async ({ transactionId, userId }) => {
  const { rows } = await db.query(
    `
      SELECT
        t.id AS transaction_id,
        t.user_subscription_id,
        t.amount,
        t.payment_method,
        t.payment_status,
        t.paid_at,
        t.created_at,
        ${SUBSCRIPTION_WITH_PLAN_SELECT}
      FROM transactions t
      JOIN user_subscriptions us
        ON us.id = t.user_subscription_id
      JOIN subscription_plans sp
        ON sp.id = us.subscription_plan_id
      WHERE t.id = $1
        AND us.user_id = $2
      LIMIT 1
    `,
    [transactionId, userId]
  );
  return rows[0] || null;
};

const markTransactionPaid = async (transactionId, client = null) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      UPDATE transactions
      SET payment_status = 'paid',
          paid_at = NOW()
      WHERE id = $1
      RETURNING
        id AS transaction_id,
        user_subscription_id,
        amount,
        payment_method,
        payment_status,
        paid_at,
        created_at
    `,
    [transactionId]
  );
  return rows[0] || null;
};

const activateSubscription = async ({ userSubscriptionId, durationMs }, client = null) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      UPDATE user_subscriptions
      SET status = 'active',
          start_date = NOW(),
          end_date = CASE
            WHEN $2::double precision IS NULL THEN NULL
            ELSE NOW() + ($2::double precision * INTERVAL '1 millisecond')
          END,
          auto_renew = true
      WHERE id = $1
      RETURNING
        id AS user_subscription_id,
        status,
        start_date,
        end_date,
        auto_renew
    `,
    [userSubscriptionId, durationMs]
  );
  return rows[0] || null;
};

const confirmTransactionPayment = async ({ transactionId, userSubscriptionId, durationMs }) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const transaction = await markTransactionPaid(transactionId, client);
    const subscription = await activateSubscription({ userSubscriptionId, durationMs }, client);
    await client.query('COMMIT');
    return { transaction, subscription };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const findRefreshableSubscriptionByUserIdForUpdate = async (userId, client) => {
  const { rows } = await client.query(
    `
      SELECT ${SUBSCRIPTION_WITH_PLAN_SELECT}
      FROM user_subscriptions us
      JOIN subscription_plans sp
        ON sp.id = us.subscription_plan_id
      WHERE us.user_id = $1
        AND us.status = 'active'
        AND sp.name = 'premium'
      ORDER BY us.end_date DESC NULLS LAST, us.created_at DESC
      LIMIT 1
      FOR UPDATE OF us
    `,
    [userId]
  );
  return rows[0] || null;
};

const withSubscriptionRefreshLock = async (userId, callback) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const subscription = await findRefreshableSubscriptionByUserIdForUpdate(userId, client);
    const result = await callback({ subscription, client });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const markSubscriptionExpired = async (userSubscriptionId, client = null) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      UPDATE user_subscriptions
      SET status = 'expired'
      WHERE id = $1
      RETURNING
        id AS user_subscription_id,
        status,
        start_date,
        end_date,
        auto_renew
    `,
    [userSubscriptionId]
  );
  return rows[0] || null;
};

const createPaidRenewalTransaction = async (
  { userSubscriptionId, amount, paidAt },
  client = null
) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      INSERT INTO transactions (
        user_subscription_id,
        amount,
        payment_method,
        payment_status,
        paid_at,
        created_at
      )
      VALUES ($1, $2, 'mock', 'paid', $3, $3)
      RETURNING
        id AS transaction_id,
        user_subscription_id,
        amount,
        payment_method,
        payment_status,
        paid_at,
        created_at
    `,
    [userSubscriptionId, amount, paidAt]
  );
  return rows[0] || null;
};

const updateSubscriptionEndDate = async ({ userSubscriptionId, endDate }, client = null) => {
  const executor = getExecutor(client);
  const { rows } = await executor.query(
    `
      UPDATE user_subscriptions
      SET status = 'active',
          end_date = $2
      WHERE id = $1
      RETURNING
        id AS user_subscription_id,
        status,
        start_date,
        end_date,
        auto_renew
    `,
    [userSubscriptionId, endDate]
  );
  return rows[0] || null;
};

const cancelAutoRenew = async (userSubscriptionId) => {
  const { rows } = await db.query(
    `
      UPDATE user_subscriptions
      SET auto_renew = false
      WHERE id = $1
      RETURNING
        id AS user_subscription_id,
        status,
        auto_renew,
        end_date
    `,
    [userSubscriptionId]
  );
  return rows[0] || null;
};

const listTransactionsByUser = async ({ userId, limit, offset, paymentStatus = null }) => {
  const params = [userId];
  let statusFilter = '';

  if (paymentStatus) {
    params.push(paymentStatus);
    statusFilter = `AND t.payment_status = $${params.length}`;
  }

  params.push(limit, offset);
  const limitParam = params.length - 1;
  const offsetParam = params.length;

  const { rows } = await db.query(
    `
      SELECT
        t.id AS transaction_id,
        t.user_subscription_id,
        t.amount,
        t.payment_method,
        t.payment_status,
        t.paid_at,
        t.created_at
      FROM transactions t
      JOIN user_subscriptions us
        ON us.id = t.user_subscription_id
      WHERE us.user_id = $1
        ${statusFilter}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `,
    params
  );
  return rows;
};

const countTransactionsByUser = async ({ userId, paymentStatus = null }) => {
  const params = [userId];
  let statusFilter = '';

  if (paymentStatus) {
    params.push(paymentStatus);
    statusFilter = `AND t.payment_status = $${params.length}`;
  }

  const { rows } = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM transactions t
      JOIN user_subscriptions us
        ON us.id = t.user_subscription_id
      WHERE us.user_id = $1
        ${statusFilter}
    `,
    params
  );
  return rows[0]?.total || 0;
};

const countUserUploadedTracks = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM tracks
      WHERE user_id = $1
        AND deleted_at IS NULL
    `,
    [userId]
  );
  return rows[0]?.total || 0;
};

const countUserCreatedPlaylists = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM playlists
      WHERE user_id = $1
        AND deleted_at IS NULL
        AND type = 'regular'
    `,
    [userId]
  );
  return rows[0]?.total || 0;
};

module.exports = {
  findAllPlans,
  findPlanById,
  findPlanByName,
  findUserRoleById,
  findActiveSubscriptionByUserId,
  findPendingCheckoutByUserId,
  createPendingSubscription,
  createPendingTransaction,
  createPendingCheckout,
  findTransactionForUser,
  markTransactionPaid,
  activateSubscription,
  confirmTransactionPayment,
  withSubscriptionRefreshLock,
  markSubscriptionExpired,
  createPaidRenewalTransaction,
  updateSubscriptionEndDate,
  cancelAutoRenew,
  listTransactionsByUser,
  countTransactionsByUser,
  countUserUploadedTracks,
  countUserCreatedPlaylists,
};
