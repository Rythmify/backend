jest.mock('../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../src/models/subscription.model', () => ({
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

const request = require('supertest');
const app = require('../app');
const { verifyToken } = require('../src/config/jwt');
const subscriptionsModel = require('../src/models/subscription.model');
const subscriptionsService = require('../src/services/subscriptions.service');

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
  verifyToken.mockReturnValue({ sub: USER_ID });
  subscriptionsModel.countUserUploadedTracks.mockResolvedValue(2);
  subscriptionsModel.countUserCreatedPlaylists.mockResolvedValue(1);
});

describe('subscriptions module routes', () => {
  it('GET /subscriptions/plans returns free and premium plans publicly', async () => {
    subscriptionsModel.findAllPlans.mockResolvedValue([freePlan, premiumPlan]);

    const response = await request(app).get('/api/v1/subscriptions/plans');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [freePlan, premiumPlan],
      },
      message: 'Subscription plans fetched successfully.',
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });
});

describe('subscriptions.service', () => {
  it('GET /subscriptions/me returns effective free plan when no active premium exists', async () => {
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

  it('GET /subscriptions/me returns active premium plan and usage when active premium exists', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(activePremiumSubscription);
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

  it('POST /subscriptions/checkout rejects free plan with 422', async () => {
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

  it('POST /subscriptions/checkout creates pending subscription and pending transaction for premium', async () => {
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

  it('POST /subscriptions/mock-confirm/:transaction_id marks transaction paid and activates subscription', async () => {
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

  it('POST /subscriptions/mock-confirm/:transaction_id rejects already paid transaction with 409', async () => {
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

  it('POST /subscriptions/cancel sets auto_renew=false but keeps status active', async () => {
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

  it('POST /subscriptions/cancel returns 409 if already auto_renew=false', async () => {
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

  it('GET /subscriptions/transactions supports limit/offset/payment_status and returns real total', async () => {
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
    expect(result).toEqual({
      data: [
        {
          transaction_id: TRANSACTION_ID,
          user_subscription_id: USER_SUBSCRIPTION_ID,
          amount: '4.99',
          payment_method: 'mock',
          payment_status: 'paid',
          paid_at: '2026-04-24T20:30:00.000Z',
          created_at: '2026-04-24T20:29:00.000Z',
        },
      ],
      pagination: {
        limit: 5,
        offset: 10,
        total: 7,
      },
    });
  });
});
