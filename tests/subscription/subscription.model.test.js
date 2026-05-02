jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const db = require('../../src/config/db');
const model = require('../../src/models/subscription.model');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';
const USER_SUBSCRIPTION_ID = '44444444-4444-4444-4444-444444444444';
const TRANSACTION_ID = '55555555-5555-5555-5555-555555555555';

const row = {
  subscription_plan_id: PLAN_ID,
  name: 'premium',
  price: '4.99',
  duration_days: null,
  duration_minutes: 5,
  track_limit: null,
  playlist_limit: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscription.model', () => {
  it('findAllPlans orders plans in stable subscription order', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findAllPlans()).resolves.toEqual([row]);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM subscription_plans'));
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("WHEN 'free' THEN 1");
    expect(sql).toContain("WHEN 'premium' THEN 2");
    expect(sql).toContain('price ASC');
    expect(sql).toContain('name ASC');
  });

  it('findPlanById returns the first matching plan or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findPlanById(PLAN_ID)).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [PLAN_ID]);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findPlanById(PLAN_ID)).resolves.toBeNull();
  });

  it('findPlanByName returns the first matching plan or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findPlanByName('premium')).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE name = $1'), ['premium']);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findPlanByName('premium')).resolves.toBeNull();
  });

  it('findUserRoleById returns the current user role or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ role: 'artist' }] });

    await expect(model.findUserRoleById(USER_ID)).resolves.toBe('artist');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), [USER_ID]);
    expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findUserRoleById(USER_ID)).resolves.toBeNull();
  });

  it('findActiveSubscriptionByUserId returns active non-expired premium subscription', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_subscription_id: USER_SUBSCRIPTION_ID }] });

    await expect(model.findActiveSubscriptionByUserId(USER_ID)).resolves.toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
    });

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('us.status ='), [USER_ID]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("sp.name = 'premium'");
    expect(sql).toContain('us.end_date > NOW()');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findActiveSubscriptionByUserId(USER_ID)).resolves.toBeNull();
  });

  it('findPendingCheckoutByUserId returns pending subscription transaction or null', async () => {
    const pending = {
      user_subscription_id: USER_SUBSCRIPTION_ID,
      transaction_id: TRANSACTION_ID,
    };
    db.query.mockResolvedValueOnce({ rows: [pending] });

    await expect(
      model.findPendingCheckoutByUserId({ userId: USER_ID, planId: PLAN_ID })
    ).resolves.toEqual(pending);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("t.payment_status = 'pending'"), [
      USER_ID,
      PLAN_ID,
    ]);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.findPendingCheckoutByUserId({ userId: USER_ID, planId: PLAN_ID })
    ).resolves.toBeNull();
  });

  it('createPendingSubscription inserts pending subscription with current timestamp window', async () => {
    const created = { user_subscription_id: USER_SUBSCRIPTION_ID, status: 'pending' };
    db.query.mockResolvedValueOnce({ rows: [created] });

    await expect(
      model.createPendingSubscription({
        userId: USER_ID,
        planId: PLAN_ID,
        durationMs: 5 * 60 * 1000,
      })
    ).resolves.toEqual(created);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_subscriptions'),
      [USER_ID, PLAN_ID, 5 * 60 * 1000]
    );
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("'pending'");
    expect(sql).toContain("INTERVAL '1 millisecond'");

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.createPendingSubscription({
        userId: USER_ID,
        planId: PLAN_ID,
        durationMs: null,
      })
    ).resolves.toBeNull();
  });

  it('createPendingTransaction inserts pending mock transaction', async () => {
    const created = { transaction_id: TRANSACTION_ID, payment_status: 'pending' };
    db.query.mockResolvedValueOnce({ rows: [created] });

    await expect(
      model.createPendingTransaction({
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        amount: '4.99',
      })
    ).resolves.toEqual(created);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions'), [
      USER_SUBSCRIPTION_ID,
      '4.99',
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("'mock'");
    expect(sql).toContain("'pending'");

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.createPendingTransaction({
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        amount: '4.99',
      })
    ).resolves.toBeNull();
  });

  it('findTransactionForUser joins subscription and plan ownership', async () => {
    const transaction = {
      transaction_id: TRANSACTION_ID,
      user_subscription_id: USER_SUBSCRIPTION_ID,
    };
    db.query.mockResolvedValueOnce({ rows: [transaction] });

    await expect(
      model.findTransactionForUser({
        transactionId: TRANSACTION_ID,
        userId: USER_ID,
      })
    ).resolves.toEqual(transaction);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE t.id = $1'), [
      TRANSACTION_ID,
      USER_ID,
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('JOIN user_subscriptions us');
    expect(sql).toContain('JOIN subscription_plans sp');
    expect(sql).toContain('AND us.user_id = $2');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.findTransactionForUser({
        transactionId: TRANSACTION_ID,
        userId: USER_ID,
      })
    ).resolves.toBeNull();
  });

  it('markTransactionPaid updates transaction status and paid_at', async () => {
    const paid = { transaction_id: TRANSACTION_ID, payment_status: 'paid' };
    db.query.mockResolvedValueOnce({ rows: [paid] });

    await expect(model.markTransactionPaid(TRANSACTION_ID)).resolves.toEqual(paid);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE transactions'), [
      TRANSACTION_ID,
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("payment_status = 'paid'");
    expect(sql).toContain('paid_at = NOW()');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.markTransactionPaid(TRANSACTION_ID)).resolves.toBeNull();
  });

  it('activateSubscription activates subscription with refreshed timestamp window', async () => {
    const activated = { user_subscription_id: USER_SUBSCRIPTION_ID, status: 'active' };
    db.query.mockResolvedValueOnce({ rows: [activated] });

    await expect(
      model.activateSubscription({
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        durationMs: 5 * 60 * 1000,
      })
    ).resolves.toEqual(activated);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_subscriptions'), [
      USER_SUBSCRIPTION_ID,
      5 * 60 * 1000,
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('start_date = NOW()');
    expect(sql).toContain("INTERVAL '1 millisecond'");
    expect(sql).toContain('auto_renew = true');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.activateSubscription({
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        durationMs: null,
      })
    ).resolves.toBeNull();
  });

  it('cancelAutoRenew disables auto-renew and returns the updated row', async () => {
    const canceled = { user_subscription_id: USER_SUBSCRIPTION_ID, auto_renew: false };
    db.query.mockResolvedValueOnce({ rows: [canceled] });

    await expect(model.cancelAutoRenew(USER_SUBSCRIPTION_ID)).resolves.toEqual(canceled);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET auto_renew = false'), [
      USER_SUBSCRIPTION_ID,
    ]);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.cancelAutoRenew(USER_SUBSCRIPTION_ID)).resolves.toBeNull();
  });

  it('expireCurrentPremiumSubscriptionForTesting expires only the current user premium row without deleting transactions', async () => {
    const expired = {
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'expired',
      auto_renew: false,
    };
    db.query.mockResolvedValueOnce({ rows: [expired] });

    await expect(model.expireCurrentPremiumSubscriptionForTesting(USER_ID)).resolves.toEqual(
      expired
    );

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_subscriptions'), [
      USER_ID,
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("status = 'expired'");
    expect(sql).toContain('auto_renew = false');
    expect(sql).toContain('end_date = NOW()');
    expect(sql).toContain('us.user_id = $1');
    expect(sql).toContain("sp.name = 'premium'");
    expect(sql).toContain("us.status IN ('active', 'pending')");
    expect(sql).not.toContain('DELETE FROM transactions');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.expireCurrentPremiumSubscriptionForTesting(USER_ID)).resolves.toBeNull();
  });

  it('listTransactionsByUser filters by payment_status when provided', async () => {
    const transaction = { transaction_id: TRANSACTION_ID, payment_status: 'paid' };
    db.query.mockResolvedValueOnce({ rows: [transaction] });

    await expect(
      model.listTransactionsByUser({
        userId: USER_ID,
        limit: 5,
        offset: 10,
        paymentStatus: 'paid',
      })
    ).resolves.toEqual([transaction]);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY t.created_at DESC'), [
      USER_ID,
      'paid',
      5,
      10,
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('t.payment_status = $2');
    expect(sql).toContain('LIMIT $3 OFFSET $4');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.listTransactionsByUser({
        userId: USER_ID,
        limit: 20,
        offset: 0,
        paymentStatus: null,
      })
    ).resolves.toEqual([]);
    expect(db.query.mock.calls[1][1]).toEqual([USER_ID, 20, 0]);
  });

  it('countTransactionsByUser returns total and supports no-row fallback', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 7 }] });

    await expect(
      model.countTransactionsByUser({ userId: USER_ID, paymentStatus: 'paid' })
    ).resolves.toBe(7);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)::int AS total'), [
      USER_ID,
      'paid',
    ]);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.countTransactionsByUser({ userId: USER_ID })).resolves.toBe(0);
  });

  it('countUserUploadedTracks counts non-deleted user tracks', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 3 }] });

    await expect(model.countUserUploadedTracks(USER_ID)).resolves.toBe(3);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM tracks'), [USER_ID]);
    expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.countUserUploadedTracks(USER_ID)).resolves.toBe(0);
  });

  it('countUserCreatedPlaylists counts non-deleted user playlists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 2 }] });

    await expect(model.countUserCreatedPlaylists(USER_ID)).resolves.toBe(2);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM playlists'), [USER_ID]);
    expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.countUserCreatedPlaylists(USER_ID)).resolves.toBe(0);
  });

  it('uses a database transaction when creating pending checkout', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ user_subscription_id: USER_SUBSCRIPTION_ID }] })
      .mockResolvedValueOnce({ rows: [{ transaction_id: TRANSACTION_ID }] })
      .mockResolvedValueOnce({});

    await expect(
      model.createPendingCheckout({
        userId: USER_ID,
        planId: PLAN_ID,
        durationMs: 5 * 60 * 1000,
        amount: '4.99',
      })
    ).resolves.toEqual({
      subscription: { user_subscription_id: USER_SUBSCRIPTION_ID },
      transaction: { transaction_id: TRANSACTION_ID },
    });

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back pending checkout transaction on failure', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce({});

    await expect(
      model.createPendingCheckout({
        userId: USER_ID,
        planId: PLAN_ID,
        durationMs: 5 * 60 * 1000,
        amount: '4.99',
      })
    ).rejects.toThrow('insert failed');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('uses a database transaction when confirming transaction payment', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ transaction_id: TRANSACTION_ID }] })
      .mockResolvedValueOnce({ rows: [{ user_subscription_id: USER_SUBSCRIPTION_ID }] })
      .mockResolvedValueOnce({});

    await expect(
      model.confirmTransactionPayment({
        transactionId: TRANSACTION_ID,
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        durationMs: 5 * 60 * 1000,
      })
    ).resolves.toEqual({
      transaction: { transaction_id: TRANSACTION_ID },
      subscription: { user_subscription_id: USER_SUBSCRIPTION_ID },
    });

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE transactions'),
      [TRANSACTION_ID]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE user_subscriptions'),
      [USER_SUBSCRIPTION_ID, 5 * 60 * 1000]
    );
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back confirmed payment transaction on failure', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ transaction_id: TRANSACTION_ID }] })
      .mockRejectedValueOnce(new Error('activate failed'))
      .mockResolvedValueOnce({});

    await expect(
      model.confirmTransactionPayment({
        transactionId: TRANSACTION_ID,
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        durationMs: 5 * 60 * 1000,
      })
    ).rejects.toThrow('activate failed');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('withSubscriptionRefreshLock locks active premium subscription and commits callback result', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    const lockedSubscription = { user_subscription_id: USER_SUBSCRIPTION_ID, status: 'active' };
    db.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [lockedSubscription] })
      .mockResolvedValueOnce({});
    const callback = jest.fn().mockResolvedValue('refresh-result');

    await expect(model.withSubscriptionRefreshLock(USER_ID, callback)).resolves.toBe(
      'refresh-result'
    );

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FOR UPDATE OF us'),
      [USER_ID]
    );
    expect(callback).toHaveBeenCalledWith({ subscription: lockedSubscription, client });
    expect(client.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('withSubscriptionRefreshLock rolls back and releases when callback fails', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    await expect(
      model.withSubscriptionRefreshLock(USER_ID, async () => {
        throw new Error('refresh failed');
      })
    ).rejects.toThrow('refresh failed');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('markSubscriptionExpired updates status using the supplied executor', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ user_subscription_id: USER_SUBSCRIPTION_ID, status: 'expired' }],
      }),
    };

    await expect(model.markSubscriptionExpired(USER_SUBSCRIPTION_ID, client)).resolves.toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'expired',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'expired'"),
      [USER_SUBSCRIPTION_ID]
    );
  });

  it('markSubscriptionExpired returns null when no row is updated', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.markSubscriptionExpired(USER_SUBSCRIPTION_ID)).resolves.toBeNull();
  });

  it('createPaidRenewalTransaction inserts a paid transaction at paidAt', async () => {
    const paidAt = new Date('2026-04-24T20:05:00.000Z');
    const transaction = { transaction_id: TRANSACTION_ID, payment_status: 'paid' };
    db.query.mockResolvedValueOnce({ rows: [transaction] });

    await expect(
      model.createPaidRenewalTransaction({
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        amount: '4.99',
        paidAt,
      })
    ).resolves.toEqual(transaction);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions'), [
      USER_SUBSCRIPTION_ID,
      '4.99',
      paidAt,
    ]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("'mock', 'paid'");
    expect(sql).toContain('paid_at');
    expect(sql).toContain('created_at');
  });

  it('createPaidRenewalTransaction returns null when insert returns no row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.createPaidRenewalTransaction({
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        amount: '4.99',
        paidAt: new Date('2026-04-24T20:05:00.000Z'),
      })
    ).resolves.toBeNull();
  });

  it('updateSubscriptionEndDate updates active end date and returns null when no row updates', async () => {
    const endDate = new Date('2026-04-24T20:10:00.000Z');
    db.query.mockResolvedValueOnce({
      rows: [{ user_subscription_id: USER_SUBSCRIPTION_ID, end_date: endDate }],
    });

    await expect(
      model.updateSubscriptionEndDate({ userSubscriptionId: USER_SUBSCRIPTION_ID, endDate })
    ).resolves.toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      end_date: endDate,
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SET status ='),
      [USER_SUBSCRIPTION_ID, endDate]
    );
    expect(db.query.mock.calls[0][0]).toContain('end_date = $2');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      model.updateSubscriptionEndDate({ userSubscriptionId: USER_SUBSCRIPTION_ID, endDate })
    ).resolves.toBeNull();
  });
});
