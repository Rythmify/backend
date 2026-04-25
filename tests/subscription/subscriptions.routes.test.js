jest.mock('../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../src/services/subscriptions.service', () => ({
  listPlans: jest.fn(),
  getMySubscription: jest.fn(),
  createCheckout: jest.fn(),
  mockConfirmPayment: jest.fn(),
  cancelMySubscription: jest.fn(),
  listMyTransactions: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { verifyToken } = require('../../src/config/jwt');
const subscriptionsService = require('../../src/services/subscriptions.service');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const FREE_PLAN_ID = '22222222-2222-2222-2222-222222222222';
const PREMIUM_PLAN_ID = '33333333-3333-3333-3333-333333333333';
const USER_SUBSCRIPTION_ID = '44444444-4444-4444-4444-444444444444';
const TRANSACTION_ID = '55555555-5555-5555-5555-555555555555';

const freePlan = {
  subscription_plan_id: FREE_PLAN_ID,
  name: 'free',
  display_name: 'Free',
  price: '0.00',
  duration_days: null,
  track_limit: 3,
  playlist_limit: 2,
};

const premiumPlan = {
  subscription_plan_id: PREMIUM_PLAN_ID,
  name: 'premium',
  display_name: 'Go+',
  price: '4.99',
  duration_days: 30,
  track_limit: 3,
  playlist_limit: null,
};

const artistPremiumPlan = {
  ...premiumPlan,
  display_name: 'Artist Pro',
  track_limit: null,
};

const authHeader = { Authorization: 'Bearer valid-token' };

beforeEach(() => {
  jest.clearAllMocks();
  verifyToken.mockReturnValue({ sub: USER_ID, role: 'listener' });
});

describe('subscriptions routes', () => {
  it('GET /subscriptions/plans returns free, Go+, and Artist Pro publicly', async () => {
    subscriptionsService.listPlans.mockResolvedValue({
      items: [freePlan, premiumPlan, artistPremiumPlan],
    });

    const response = await request(app).get('/api/v1/subscriptions/plans');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [freePlan, premiumPlan, artistPremiumPlan],
      },
      message: 'Subscription plans fetched successfully.',
    });
    expect(subscriptionsService.listPlans).toHaveBeenCalledWith({
      userId: null,
      role: null,
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('GET /subscriptions/plans uses optional auth for authenticated listeners', async () => {
    subscriptionsService.listPlans.mockResolvedValue({ items: [freePlan, premiumPlan] });

    const response = await request(app).get('/api/v1/subscriptions/plans').set(authHeader);

    expect(response.status).toBe(200);
    expect(subscriptionsService.listPlans).toHaveBeenCalledWith({
      userId: USER_ID,
      role: 'listener',
    });
  });

  it('GET /subscriptions/plans ignores invalid optional auth and stays public', async () => {
    verifyToken.mockImplementation(() => {
      throw new Error('bad token');
    });
    subscriptionsService.listPlans.mockResolvedValue({
      items: [freePlan, premiumPlan, artistPremiumPlan],
    });

    const response = await request(app)
      .get('/api/v1/subscriptions/plans')
      .set({ Authorization: 'Bearer invalid-token' });

    expect(response.status).toBe(200);
    expect(subscriptionsService.listPlans).toHaveBeenCalledWith({
      userId: null,
      role: null,
    });
  });

  it('GET /subscriptions/me returns authenticated user subscription', async () => {
    const subscription = {
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
    };
    subscriptionsService.getMySubscription.mockResolvedValue(subscription);

    const response = await request(app).get('/api/v1/subscriptions/me').set(authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: subscription,
      message: 'Subscription fetched successfully.',
    });
    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith({
      userId: USER_ID,
      role: 'listener',
    });
  });

  it('GET /subscriptions/me requires authentication', async () => {
    const response = await request(app).get('/api/v1/subscriptions/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization header missing',
      },
    });
    expect(subscriptionsService.getMySubscription).not.toHaveBeenCalled();
  });

  it('POST /subscriptions/checkout returns a pending mock checkout', async () => {
    const checkout = {
      transaction_id: TRANSACTION_ID,
      user_subscription_id: USER_SUBSCRIPTION_ID,
      checkout_status: 'pending',
      payment_method: 'mock',
      payment_url: `https://mock-stripe.rythmify.local/checkout/${TRANSACTION_ID}`,
      plan: premiumPlan,
    };
    subscriptionsService.createCheckout.mockResolvedValue(checkout);

    const response = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set(authHeader)
      .send({ subscription_plan_id: PREMIUM_PLAN_ID });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: checkout,
      message: 'Mock subscription checkout created successfully.',
    });
    expect(subscriptionsService.createCheckout).toHaveBeenCalledWith({
      userId: USER_ID,
      role: 'listener',
      subscriptionPlanId: PREMIUM_PLAN_ID,
    });
  });

  it('POST /subscriptions/checkout requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .send({ subscription_plan_id: PREMIUM_PLAN_ID });

    expect(response.status).toBe(401);
    expect(subscriptionsService.createCheckout).not.toHaveBeenCalled();
  });

  it('POST /subscriptions/mock-confirm/:transaction_id confirms payment', async () => {
    const confirmation = {
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
    };
    subscriptionsService.mockConfirmPayment.mockResolvedValue(confirmation);

    const response = await request(app)
      .post(`/api/v1/subscriptions/mock-confirm/${TRANSACTION_ID}`)
      .set(authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: confirmation,
      message: 'Mock subscription payment confirmed successfully.',
    });
    expect(subscriptionsService.mockConfirmPayment).toHaveBeenCalledWith({
      userId: USER_ID,
      role: 'listener',
      transactionId: TRANSACTION_ID,
    });
  });

  it('POST /subscriptions/mock-confirm/:transaction_id validates transaction UUID params', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app)
      .post('/api/v1/subscriptions/mock-confirm/not-a-uuid')
      .set(authHeader);

    consoleErrorSpy.mockRestore();

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'transaction_id must be a valid UUID.',
    });
    expect(subscriptionsService.mockConfirmPayment).not.toHaveBeenCalled();
  });

  it('POST /subscriptions/cancel disables auto-renew', async () => {
    const canceled = {
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: false,
      end_date: '2026-05-24',
    };
    subscriptionsService.cancelMySubscription.mockResolvedValue(canceled);

    const response = await request(app).post('/api/v1/subscriptions/cancel').set(authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: canceled,
      message: 'Subscription auto-renew canceled successfully.',
    });
    expect(subscriptionsService.cancelMySubscription).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it('POST /subscriptions/cancel requires authentication', async () => {
    const response = await request(app).post('/api/v1/subscriptions/cancel');

    expect(response.status).toBe(401);
    expect(subscriptionsService.cancelMySubscription).not.toHaveBeenCalled();
  });

  it('GET /subscriptions/transactions returns paginated transactions', async () => {
    const transactions = [
      {
        transaction_id: TRANSACTION_ID,
        user_subscription_id: USER_SUBSCRIPTION_ID,
        amount: '4.99',
        payment_method: 'mock',
        payment_status: 'paid',
        paid_at: '2026-04-24T20:30:00.000Z',
        created_at: '2026-04-24T20:29:00.000Z',
      },
    ];
    const pagination = { limit: 5, offset: 10, total: 7 };
    subscriptionsService.listMyTransactions.mockResolvedValue({
      data: transactions,
      pagination,
    });

    const response = await request(app)
      .get('/api/v1/subscriptions/transactions')
      .query({ limit: '5', offset: '10', payment_status: 'paid' })
      .set(authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: transactions,
      message: 'Subscription transactions fetched successfully.',
      pagination,
    });
    expect(subscriptionsService.listMyTransactions).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: '5',
      offset: '10',
      paymentStatus: 'paid',
    });
  });

  it('GET /subscriptions/transactions requires authentication', async () => {
    const response = await request(app).get('/api/v1/subscriptions/transactions');

    expect(response.status).toBe(401);
    expect(subscriptionsService.listMyTransactions).not.toHaveBeenCalled();
  });
});
