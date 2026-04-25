jest.mock('../../src/models/subscription.model', () => ({
  findAllPlans: jest.fn(),
  findPlanById: jest.fn(),
  findPlanByName: jest.fn(),
  findActiveSubscriptionByUserId: jest.fn(),
  findPendingCheckoutByUserId: jest.fn(),
  createPendingCheckout: jest.fn(),
  findTransactionForUser: jest.fn(),
  confirmTransactionPayment: jest.fn(),
  cancelAutoRenew: jest.fn(),
  listTransactionsByUser: jest.fn(),
  countTransactionsByUser: jest.fn(),
  countUserUploadedTracks: jest.fn(),
  countUserCreatedPlaylists: jest.fn(),
}));

const subscriptionsModel = require('../../src/models/subscription.model');
const subscriptionsService = require('../../src/services/subscriptions.service');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const FREE_PLAN_ID = '22222222-2222-2222-2222-222222222222';
const PREMIUM_PLAN_ID = '33333333-3333-3333-3333-333333333333';
const USER_SUBSCRIPTION_ID = '44444444-4444-4444-4444-444444444444';
const TRANSACTION_ID = '55555555-5555-5555-5555-555555555555';

const freePlan = {
  subscription_plan_id: FREE_PLAN_ID,
  name: 'free',
  price: '0.00',
  duration_days: null,
  track_limit: 3,
  playlist_limit: 2,
};

const premiumPlan = {
  subscription_plan_id: PREMIUM_PLAN_ID,
  name: 'premium',
  price: '4.99',
  duration_days: 30,
  track_limit: null,
  playlist_limit: null,
};

const activePremiumSubscription = {
  user_subscription_id: USER_SUBSCRIPTION_ID,
  status: 'active',
  auto_renew: true,
  start_date: '2026-04-24',
  end_date: '2026-05-24',
  subscription_plan_id: PREMIUM_PLAN_ID,
  plan_name: 'premium',
  plan_price: '4.99',
  plan_duration_days: 30,
  plan_track_limit: null,
  plan_playlist_limit: null,
};

const pendingTransactionRow = {
  transaction_id: TRANSACTION_ID,
  user_subscription_id: USER_SUBSCRIPTION_ID,
  amount: '4.99',
  payment_method: 'mock',
  payment_status: 'pending',
  paid_at: null,
  created_at: '2026-04-24T20:29:00.000Z',
  subscription_plan_id: PREMIUM_PLAN_ID,
  plan_name: 'premium',
  plan_price: '4.99',
  plan_duration_days: 30,
  plan_track_limit: null,
  plan_playlist_limit: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  subscriptionsModel.countUserUploadedTracks.mockResolvedValue(2);
  subscriptionsModel.countUserCreatedPlaylists.mockResolvedValue(1);
});

describe('subscriptions.service', () => {
  it('listPlans returns plans in API items shape', async () => {
    subscriptionsModel.findAllPlans.mockResolvedValue([freePlan, premiumPlan]);

    await expect(subscriptionsService.listPlans()).resolves.toEqual({
      items: [freePlan, premiumPlan],
    });
  });

  it('rejects calls that require authentication when user id is missing', async () => {
    await expect(subscriptionsService.getMySubscription({ userId: null })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(subscriptionsModel.findActiveSubscriptionByUserId).not.toHaveBeenCalled();
  });

  it('getMySubscription returns effective free plan when no active premium exists', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(result).toEqual({
      user_subscription_id: null,
      status: 'active',
      auto_renew: false,
      start_date: null,
      end_date: null,
      plan: freePlan,
      usage: {
        tracks_uploaded: 2,
        track_limit: 3,
        playlists_created: 1,
        playlist_limit: 2,
        can_upload_track: true,
        can_create_playlist: true,
        offline_listening_enabled: false,
      },
    });
  });

  it('getMySubscription throws when the free plan is missing', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(null);

    await expect(subscriptionsService.getMySubscription({ userId: USER_ID })).rejects.toMatchObject(
      {
        statusCode: 404,
        code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
      }
    );
  });

  it('getMySubscription returns active premium plan and usage when active premium exists', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      start_date: new Date('2026-04-24T00:00:00.000Z'),
      end_date: new Date('2026-05-24T00:00:00.000Z'),
    });
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(5);
    subscriptionsModel.countUserCreatedPlaylists.mockResolvedValue(4);

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(result).toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: true,
      start_date: '2026-04-24',
      end_date: '2026-05-24',
      plan: premiumPlan,
      usage: {
        tracks_uploaded: 5,
        track_limit: null,
        playlists_created: 4,
        playlist_limit: null,
        can_upload_track: true,
        can_create_playlist: true,
        offline_listening_enabled: true,
      },
    });
  });

  it('hasOfflineListeningEntitlement returns true only for active premium users', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValueOnce(
      activePremiumSubscription
    );
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);

    await expect(subscriptionsService.hasOfflineListeningEntitlement(USER_ID)).resolves.toBe(true);

    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValueOnce(null);

    await expect(subscriptionsService.hasOfflineListeningEntitlement(USER_ID)).resolves.toBe(false);
  });

  it('assertCanUploadTrack allows active premium users', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(activePremiumSubscription);
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(99);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).resolves.toBeUndefined();

    expect(subscriptionsModel.findActiveSubscriptionByUserId).toHaveBeenCalledWith(USER_ID);
    expect(subscriptionsModel.countUserUploadedTracks).toHaveBeenCalledWith(USER_ID);
    expect(subscriptionsModel.countUserCreatedPlaylists).not.toHaveBeenCalled();
  });

  it('assertCanUploadTrack allows free users under track_limit', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(2);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).resolves.toBeUndefined();
  });

  it('assertCanUploadTrack rejects free users at track_limit', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(3);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'SUBSCRIPTION_LIMIT_REACHED',
      message: 'Free plan track upload limit reached. Upgrade to premium for unlimited uploads.',
    });
  });

  it('assertCanUploadTrack treats null track_limit as unlimited', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue({
      ...freePlan,
      track_limit: null,
    });
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(100);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).resolves.toBeUndefined();
  });

  it('assertCanUploadTrack does not treat pending checkout as premium', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(3);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'SUBSCRIPTION_LIMIT_REACHED',
    });
  });

  it('createCheckout validates missing and malformed subscription_plan_id', async () => {
    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: undefined,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'subscription_plan_id is required.',
    });

    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: 'not-a-uuid',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'subscription_plan_id must be a valid UUID.',
    });

    expect(subscriptionsModel.findPlanById).not.toHaveBeenCalled();
  });

  it('createCheckout rejects missing subscription plan with 404', async () => {
    subscriptionsModel.findPlanById.mockResolvedValue(null);

    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: PREMIUM_PLAN_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
    });
  });

  it('createCheckout rejects free plan with 422', async () => {
    subscriptionsModel.findPlanById.mockResolvedValue(freePlan);

    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: FREE_PLAN_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'SUBSCRIPTION_PLAN_NOT_ELIGIBLE',
    });
    expect(subscriptionsModel.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('createCheckout rejects active premium users with 409', async () => {
    subscriptionsModel.findPlanById.mockResolvedValue(premiumPlan);
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(activePremiumSubscription);

    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: PREMIUM_PLAN_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBSCRIPTION_ALREADY_ACTIVE',
    });
    expect(subscriptionsModel.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('createCheckout rejects existing pending checkout for the same plan', async () => {
    subscriptionsModel.findPlanById.mockResolvedValue(premiumPlan);
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPendingCheckoutByUserId.mockResolvedValue({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      transaction_id: TRANSACTION_ID,
    });

    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: PREMIUM_PLAN_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBSCRIPTION_CHECKOUT_PENDING',
    });
  });

  it('createCheckout creates pending subscription and pending transaction for premium', async () => {
    subscriptionsModel.findPlanById.mockResolvedValue(premiumPlan);
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPendingCheckoutByUserId.mockResolvedValue(null);
    subscriptionsModel.createPendingCheckout.mockResolvedValue({
      subscription: {
        user_subscription_id: USER_SUBSCRIPTION_ID,
        status: 'pending',
      },
      transaction: {
        transaction_id: TRANSACTION_ID,
        payment_method: 'mock',
        payment_status: 'pending',
      },
    });

    const result = await subscriptionsService.createCheckout({
      userId: USER_ID,
      subscriptionPlanId: PREMIUM_PLAN_ID,
    });

    expect(subscriptionsModel.createPendingCheckout).toHaveBeenCalledWith({
      userId: USER_ID,
      planId: PREMIUM_PLAN_ID,
      durationDays: 30,
      amount: '4.99',
    });
    expect(result).toEqual({
      transaction_id: TRANSACTION_ID,
      user_subscription_id: USER_SUBSCRIPTION_ID,
      checkout_status: 'pending',
      payment_method: 'mock',
      payment_url: `https://mock-stripe.rythmify.local/checkout/${TRANSACTION_ID}`,
      plan: premiumPlan,
    });
  });

  it('mockConfirmPayment activates subscription and marks transaction paid', async () => {
    subscriptionsModel.findTransactionForUser.mockResolvedValue(pendingTransactionRow);
    subscriptionsModel.confirmTransactionPayment.mockResolvedValue({
      transaction: {
        transaction_id: TRANSACTION_ID,
        payment_status: 'paid',
        paid_at: '2026-04-24T20:30:00.000Z',
      },
      subscription: {
        user_subscription_id: USER_SUBSCRIPTION_ID,
        status: 'active',
        auto_renew: true,
        start_date: '2026-04-24',
        end_date: '2026-05-24',
      },
    });

    const result = await subscriptionsService.mockConfirmPayment({
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
    });

    expect(subscriptionsModel.confirmTransactionPayment).toHaveBeenCalledWith({
      transactionId: TRANSACTION_ID,
      userSubscriptionId: USER_SUBSCRIPTION_ID,
      durationDays: 30,
    });
    expect(result).toEqual({
      transaction_id: TRANSACTION_ID,
      payment_status: 'paid',
      paid_at: '2026-04-24T20:30:00.000Z',
      subscription: {
        user_subscription_id: USER_SUBSCRIPTION_ID,
        status: 'active',
        auto_renew: true,
        start_date: '2026-04-24',
        end_date: '2026-05-24',
        plan: premiumPlan,
      },
    });
  });

  it('mockConfirmPayment rejects missing transactions with 404', async () => {
    subscriptionsModel.findTransactionForUser.mockResolvedValue(null);

    await expect(
      subscriptionsService.mockConfirmPayment({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIPTION_TRANSACTION_NOT_FOUND',
    });
  });

  it('mockConfirmPayment falls back to 30 days when premium duration is missing', async () => {
    subscriptionsModel.findTransactionForUser.mockResolvedValue({
      ...pendingTransactionRow,
      plan_duration_days: null,
    });
    subscriptionsModel.confirmTransactionPayment.mockResolvedValue({
      transaction: {
        transaction_id: TRANSACTION_ID,
        payment_status: 'paid',
        paid_at: new Date('2026-04-24T20:30:00.000Z'),
      },
      subscription: {
        user_subscription_id: USER_SUBSCRIPTION_ID,
        status: 'active',
        auto_renew: true,
        start_date: new Date('2026-04-24T00:00:00.000Z'),
        end_date: new Date('2026-05-24T00:00:00.000Z'),
      },
    });

    const result = await subscriptionsService.mockConfirmPayment({
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
    });

    expect(subscriptionsModel.confirmTransactionPayment).toHaveBeenCalledWith({
      transactionId: TRANSACTION_ID,
      userSubscriptionId: USER_SUBSCRIPTION_ID,
      durationDays: 30,
    });
    expect(result.paid_at).toBe('2026-04-24T20:30:00.000Z');
    expect(result.subscription.start_date).toBe('2026-04-24');
    expect(result.subscription.end_date).toBe('2026-05-24');
  });

  it('mockConfirmPayment rejects already paid transaction with 409', async () => {
    subscriptionsModel.findTransactionForUser.mockResolvedValue({
      ...pendingTransactionRow,
      payment_status: 'paid',
    });

    await expect(
      subscriptionsService.mockConfirmPayment({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBSCRIPTION_TRANSACTION_ALREADY_PAID',
    });
    expect(subscriptionsModel.confirmTransactionPayment).not.toHaveBeenCalled();
  });

  it('mockConfirmPayment rejects failed transactions', async () => {
    subscriptionsModel.findTransactionForUser.mockResolvedValue({
      ...pendingTransactionRow,
      payment_status: 'failed',
    });

    await expect(
      subscriptionsService.mockConfirmPayment({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_FAILED',
    });
  });

  it('cancelMySubscription disables auto-renew but keeps subscription active', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(activePremiumSubscription);
    subscriptionsModel.cancelAutoRenew.mockResolvedValue({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: false,
      end_date: '2026-05-24',
    });

    const result = await subscriptionsService.cancelMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.cancelAutoRenew).toHaveBeenCalledWith(USER_SUBSCRIPTION_ID);
    expect(result).toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: false,
      end_date: '2026-05-24',
    });
  });

  it('cancelMySubscription rejects when no active subscription exists', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);

    await expect(
      subscriptionsService.cancelMySubscription({ userId: USER_ID })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIPTION_NOT_FOUND',
    });
  });

  it('cancelMySubscription rejects already canceled subscription', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      auto_renew: false,
    });

    await expect(
      subscriptionsService.cancelMySubscription({ userId: USER_ID })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBSCRIPTION_ALREADY_CANCELED',
    });
    expect(subscriptionsModel.cancelAutoRenew).not.toHaveBeenCalled();
  });

  it('listMyTransactions supports limit/offset/payment_status and returns real total', async () => {
    subscriptionsModel.listTransactionsByUser.mockResolvedValue([
      {
        transaction_id: TRANSACTION_ID,
        user_subscription_id: USER_SUBSCRIPTION_ID,
        amount: '4.99',
        payment_method: 'mock',
        payment_status: 'paid',
        paid_at: '2026-04-24T20:30:00.000Z',
        created_at: '2026-04-24T20:29:00.000Z',
      },
    ]);
    subscriptionsModel.countTransactionsByUser.mockResolvedValue(7);

    const result = await subscriptionsService.listMyTransactions({
      userId: USER_ID,
      limit: '5',
      offset: '10',
      paymentStatus: 'paid',
    });

    expect(subscriptionsModel.listTransactionsByUser).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: 5,
      offset: 10,
      paymentStatus: 'paid',
    });
    expect(result.pagination).toEqual({
      limit: 5,
      offset: 10,
      total: 7,
    });
  });

  it('listMyTransactions defaults blank payment_status to no filter', async () => {
    subscriptionsModel.listTransactionsByUser.mockResolvedValue([]);
    subscriptionsModel.countTransactionsByUser.mockResolvedValue(0);

    await expect(
      subscriptionsService.listMyTransactions({
        userId: USER_ID,
        paymentStatus: '',
      })
    ).resolves.toEqual({
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });

    expect(subscriptionsModel.listTransactionsByUser).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: 20,
      offset: 0,
      paymentStatus: null,
    });
  });

  it('listMyTransactions validates pagination bounds', async () => {
    await expect(
      subscriptionsService.listMyTransactions({
        userId: USER_ID,
        limit: '51',
        offset: '0',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    await expect(
      subscriptionsService.listMyTransactions({
        userId: USER_ID,
        limit: '20',
        offset: '-1',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('listMyTransactions validates payment_status', async () => {
    await expect(
      subscriptionsService.listMyTransactions({
        userId: USER_ID,
        paymentStatus: 'refunded',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(subscriptionsModel.listTransactionsByUser).not.toHaveBeenCalled();
  });
});
