const controller = require('../../../src/controllers/subscriptions.controller');
const subscriptionsService = require('../../../src/services/subscriptions.service');
const api = require('../../../src/utils/api-response');

jest.mock('../../../src/services/subscriptions.service');
jest.mock('../../../src/utils/api-response', () => ({
  success: jest.fn(),
}));

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

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
  duration_days: null,
  duration_minutes: 5,
  track_limit: 3,
  playlist_limit: null,
};

beforeEach(() => jest.clearAllMocks());

describe('subscriptions.controller', () => {
  it('listPlans returns public plans through success', async () => {
    const req = {};
    const res = mkRes();
    const plans = { items: [freePlan, premiumPlan] };
    subscriptionsService.listPlans.mockResolvedValue(plans);

    await controller.listPlans(req, res);

    expect(subscriptionsService.listPlans).toHaveBeenCalledWith({
      userId: null,
      role: null,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      plans,
      'Subscription plans fetched successfully.'
    );
  });

  it('getMySubscription extracts req.user.id before other user id aliases', async () => {
    const req = {
      user: {
        id: USER_ID,
        sub: 'sub-user',
        user_id: 'legacy-user',
        role: 'artist',
      },
    };
    const res = mkRes();
    const subscription = { user_subscription_id: null, plan: freePlan };
    subscriptionsService.getMySubscription.mockResolvedValue(subscription);

    await controller.getMySubscription(req, res);

    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith({
      userId: USER_ID,
      role: 'artist',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      subscription,
      'Subscription fetched successfully.'
    );
  });

  it('getMySubscription falls back to req.user.sub', async () => {
    const req = { user: { sub: USER_ID } };
    const res = mkRes();
    subscriptionsService.getMySubscription.mockResolvedValue({ plan: freePlan });

    await controller.getMySubscription(req, res);

    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith({
      userId: USER_ID,
      role: null,
    });
  });

  it('getMySubscription passes null when no user id is present', async () => {
    const req = { user: {} };
    const res = mkRes();
    subscriptionsService.getMySubscription.mockResolvedValue({ plan: freePlan });

    await controller.getMySubscription(req, res);

    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith({
      userId: null,
      role: null,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      { plan: freePlan },
      'Subscription fetched successfully.'
    );
  });

  it('createCheckout passes authenticated user and request body plan id', async () => {
    const req = {
      user: { user_id: USER_ID },
      body: { subscription_plan_id: PREMIUM_PLAN_ID },
    };
    const res = mkRes();
    const checkout = {
      transaction_id: TRANSACTION_ID,
      user_subscription_id: USER_SUBSCRIPTION_ID,
      checkout_status: 'pending',
      payment_method: 'mock',
      payment_url: `https://mock-stripe.rythmify.local/checkout/${TRANSACTION_ID}`,
      plan: premiumPlan,
    };
    subscriptionsService.createCheckout.mockResolvedValue(checkout);

    await controller.createCheckout(req, res);

    expect(subscriptionsService.createCheckout).toHaveBeenCalledWith({
      userId: USER_ID,
      role: null,
      subscriptionPlanId: PREMIUM_PLAN_ID,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      checkout,
      'Mock subscription checkout created successfully.',
      201
    );
  });

  it('mockConfirmPayment passes route transaction id and user id', async () => {
    const req = {
      user: { sub: USER_ID },
      params: { transaction_id: TRANSACTION_ID },
    };
    const res = mkRes();
    const confirmation = {
      transaction_id: TRANSACTION_ID,
      payment_status: 'paid',
      subscription: { user_subscription_id: USER_SUBSCRIPTION_ID },
    };
    subscriptionsService.mockConfirmPayment.mockResolvedValue(confirmation);

    await controller.mockConfirmPayment(req, res);

    expect(subscriptionsService.mockConfirmPayment).toHaveBeenCalledWith({
      userId: USER_ID,
      role: null,
      transactionId: TRANSACTION_ID,
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      confirmation,
      'Mock subscription payment confirmed successfully.'
    );
  });

  it('cancelMySubscription passes authenticated user id', async () => {
    const req = { user: { sub: USER_ID } };
    const res = mkRes();
    const canceled = {
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: false,
      end_date: '2026-04-24T20:05:00.000Z',
    };
    subscriptionsService.cancelMySubscription.mockResolvedValue(canceled);

    await controller.cancelMySubscription(req, res);

    expect(subscriptionsService.cancelMySubscription).toHaveBeenCalledWith({ userId: USER_ID });
    expect(api.success).toHaveBeenCalledWith(
      res,
      canceled,
      'Subscription auto-renew canceled successfully.'
    );
  });

  it('resetMySubscriptionForTesting passes authenticated user id and role', async () => {
    const req = { user: { sub: USER_ID, role: 'listener' } };
    const res = mkRes();
    const resetSubscription = {
      user_subscription_id: null,
      status: 'active',
      auto_renew: false,
      start_date: null,
      end_date: null,
      plan: freePlan,
    };
    subscriptionsService.resetMySubscriptionForTesting.mockResolvedValue(resetSubscription);

    await controller.resetMySubscriptionForTesting(req, res);

    expect(subscriptionsService.resetMySubscriptionForTesting).toHaveBeenCalledWith({
      userId: USER_ID,
      role: 'listener',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      resetSubscription,
      'Subscription reset for development testing successfully.'
    );
  });

  it('listMyTransactions passes query params and returns pagination through success', async () => {
    const req = {
      user: { sub: USER_ID },
      query: {
        limit: '5',
        offset: '10',
        payment_status: 'paid',
      },
    };
    const res = mkRes();
    const transactions = [{ transaction_id: TRANSACTION_ID, payment_status: 'paid' }];
    const pagination = { limit: 5, offset: 10, total: 7 };
    subscriptionsService.listMyTransactions.mockResolvedValue({
      data: transactions,
      pagination,
    });

    await controller.listMyTransactions(req, res);

    expect(subscriptionsService.listMyTransactions).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: '5',
      offset: '10',
      paymentStatus: 'paid',
    });
    expect(api.success).toHaveBeenCalledWith(
      res,
      transactions,
      'Subscription transactions fetched successfully.',
      200,
      pagination
    );
  });
});
