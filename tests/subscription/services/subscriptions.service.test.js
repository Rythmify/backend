jest.mock('../../../src/models/subscription.model', () => ({
  findAllPlans: jest.fn(),
  findPlanById: jest.fn(),
  findPlanByName: jest.fn(),
  findUserRoleById: jest.fn(),
  findActiveSubscriptionByUserId: jest.fn(),
  withSubscriptionRefreshLock: jest.fn(),
  markSubscriptionExpired: jest.fn(),
  createPaidRenewalTransaction: jest.fn(),
  updateSubscriptionEndDate: jest.fn(),
  expireCurrentPremiumSubscriptionForTesting: jest.fn(),
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

jest.mock('../../../src/models/notification.model', () => ({
  createNotification: jest.fn(),
}));

const subscriptionsModel = require('../../../src/models/subscription.model');
const notificationModel = require('../../../src/models/notification.model');
const subscriptionsService = require('../../../src/services/subscriptions.service');

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
  duration_minutes: null,
  track_limit: 3,
  playlist_limit: 2,
};

const premiumPlan = {
  subscription_plan_id: PREMIUM_PLAN_ID,
  name: 'premium',
  price: '4.99',
  duration_days: null,
  duration_minutes: 5,
  track_limit: null,
  playlist_limit: null,
};

const freePlanResponse = {
  ...freePlan,
  display_name: 'Free',
};

const listenerPremiumPlanResponse = {
  ...premiumPlan,
  display_name: 'Go+',
  track_limit: freePlan.track_limit,
};

const artistPremiumPlanResponse = {
  ...premiumPlan,
  display_name: 'Artist Pro',
  track_limit: null,
};

const activePremiumSubscription = {
  user_subscription_id: USER_SUBSCRIPTION_ID,
  status: 'active',
  auto_renew: true,
  start_date: '2099-04-24T20:00:00.000Z',
  end_date: '2099-04-24T20:05:00.000Z',
  subscription_plan_id: PREMIUM_PLAN_ID,
  plan_name: 'premium',
  plan_price: '4.99',
  plan_duration_days: null,
  plan_duration_minutes: 5,
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
  plan_duration_days: null,
  plan_duration_minutes: 5,
  plan_track_limit: null,
  plan_playlist_limit: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  subscriptionsModel.countUserUploadedTracks.mockResolvedValue(2);
  subscriptionsModel.countUserCreatedPlaylists.mockResolvedValue(1);
  subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
  subscriptionsModel.findUserRoleById.mockResolvedValue('listener');
  subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
  subscriptionsModel.withSubscriptionRefreshLock.mockImplementation(async (userId, callback) => {
    const subscription = await subscriptionsModel.findActiveSubscriptionByUserId(userId);
    return callback({ subscription, client: {} });
  });
  subscriptionsModel.updateSubscriptionEndDate.mockImplementation(
    async ({ userSubscriptionId, endDate }) => ({
      user_subscription_id: userSubscriptionId,
      status: 'active',
      start_date: activePremiumSubscription.start_date,
      end_date: endDate,
      auto_renew: true,
    })
  );
  subscriptionsModel.expireCurrentPremiumSubscriptionForTesting.mockResolvedValue({
    user_subscription_id: USER_SUBSCRIPTION_ID,
    status: 'expired',
    auto_renew: false,
    end_date: '2026-04-24T20:00:00.000Z',
  });
  notificationModel.createNotification.mockResolvedValue({});
});

afterEach(() => {
  process.env.NODE_ENV = 'test';
});

describe('subscriptions.service', () => {
  it('listPlans without auth returns free plus listener and artist premium display variants', async () => {
    subscriptionsModel.findAllPlans.mockResolvedValue([freePlan, premiumPlan]);

    await expect(subscriptionsService.listPlans()).resolves.toEqual({
      items: [freePlanResponse, listenerPremiumPlanResponse, artistPremiumPlanResponse],
    });
    expect(subscriptionsModel.findUserRoleById).not.toHaveBeenCalled();
  });

  it('listPlans returns only the listener premium display variant for authenticated listeners', async () => {
    subscriptionsModel.findAllPlans.mockResolvedValue([freePlan, premiumPlan]);
    subscriptionsModel.findUserRoleById.mockResolvedValue('listener');

    await expect(
      subscriptionsService.listPlans({ userId: USER_ID, role: 'artist' })
    ).resolves.toEqual({
      items: [freePlanResponse, listenerPremiumPlanResponse],
    });
  });

  it('listPlans returns only the artist premium display variant for authenticated artists', async () => {
    subscriptionsModel.findAllPlans.mockResolvedValue([freePlan, premiumPlan]);
    subscriptionsModel.findUserRoleById.mockResolvedValue('artist');

    await expect(subscriptionsService.listPlans({ userId: USER_ID })).resolves.toEqual({
      items: [freePlanResponse, artistPremiumPlanResponse],
    });
  });

  it('listPlans returns only available free plan when premium plan is missing', async () => {
    subscriptionsModel.findAllPlans.mockResolvedValue([freePlan]);

    await expect(subscriptionsService.listPlans()).resolves.toEqual({
      items: [freePlanResponse],
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
      plan: freePlanResponse,
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
      start_date: new Date('2099-04-24T20:00:00.000Z'),
      end_date: new Date('2099-04-24T20:05:00.000Z'),
    });
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(5);
    subscriptionsModel.countUserCreatedPlaylists.mockResolvedValue(4);

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(result).toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: true,
      start_date: '2099-04-24T20:00:00.000Z',
      end_date: '2099-04-24T20:05:00.000Z',
      plan: listenerPremiumPlanResponse,
      usage: {
        tracks_uploaded: 5,
        track_limit: 3,
        playlists_created: 4,
        playlist_limit: null,
        can_upload_track: true,
        can_create_playlist: true,
        offline_listening_enabled: true,
      },
    });
  });

  it('getMySubscription formats active premium as Artist Pro for current artist role', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(activePremiumSubscription);
    subscriptionsModel.findPlanByName.mockResolvedValue(freePlan);
    subscriptionsModel.findUserRoleById.mockResolvedValue('artist');

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(result.plan).toEqual(artistPremiumPlanResponse);
    expect(result.usage.track_limit).toBeNull();
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

  it('GET subscription before end_date returns active premium and creates no renewal transaction', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:04:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      start_date: '2026-04-24T20:00:00.000Z',
      end_date: '2026-04-24T20:05:00.000Z',
    });

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(result.user_subscription_id).toBe(USER_SUBSCRIPTION_ID);
    expect(result.usage.offline_listening_enabled).toBe(true);
    expect(subscriptionsModel.createPaidRenewalTransaction).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('GET subscription after end_date with auto_renew=true creates a paid renewal and extends by 5 minutes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      start_date: '2026-04-24T19:55:00.000Z',
      end_date: '2026-04-24T20:00:00.000Z',
    });

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.createPaidRenewalTransaction).toHaveBeenCalledTimes(1);
    expect(subscriptionsModel.createPaidRenewalTransaction).toHaveBeenCalledWith(
      {
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        amount: '4.99',
        paidAt: new Date('2026-04-24T20:01:00.000Z'),
      },
      {}
    );
    expect(subscriptionsModel.updateSubscriptionEndDate).toHaveBeenCalledWith(
      {
        userSubscriptionId: USER_SUBSCRIPTION_ID,
        endDate: new Date('2026-04-24T20:05:00.000Z'),
      },
      {}
    );
    expect(result.end_date).toBe('2026-04-24T20:05:00.000Z');
    expect(result.usage.offline_listening_enabled).toBe(true);
    jest.useRealTimers();
  });

  it('GET subscription after multiple missed periods creates one transaction per missed 5-minute period', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:16:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      start_date: '2026-04-24T19:55:00.000Z',
      end_date: '2026-04-24T20:00:00.000Z',
    });

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.createPaidRenewalTransaction).toHaveBeenCalledTimes(3);
    expect(
      subscriptionsModel.createPaidRenewalTransaction.mock.calls.map(([payload]) =>
        payload.paidAt.toISOString()
      )
    ).toEqual(['2026-04-24T20:05:00.000Z', '2026-04-24T20:10:00.000Z', '2026-04-24T20:15:00.000Z']);
    expect(result.end_date).toBe('2026-04-24T20:20:00.000Z');
    jest.useRealTimers();
  });

  it('GET subscription after end_date with auto_renew=false expires it and returns free limits', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      auto_renew: false,
      end_date: '2026-04-24T20:00:00.000Z',
    });

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.markSubscriptionExpired).toHaveBeenCalledWith(
      USER_SUBSCRIPTION_ID,
      {}
    );
    expect(subscriptionsModel.createPaidRenewalTransaction).not.toHaveBeenCalled();
    expect(result.user_subscription_id).toBeNull();
    expect(result.plan.name).toBe('free');
    expect(result.usage.offline_listening_enabled).toBe(false);
    jest.useRealTimers();
  });

  it('GET subscription expires auto-renewing subscriptions when plan duration is missing', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      auto_renew: true,
      end_date: '2026-04-24T20:00:00.000Z',
      plan_duration_days: null,
      plan_duration_minutes: null,
    });

    const result = await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.markSubscriptionExpired).toHaveBeenCalledWith(
      USER_SUBSCRIPTION_ID,
      {}
    );
    expect(subscriptionsModel.createPaidRenewalTransaction).not.toHaveBeenCalled();
    expect(result.user_subscription_id).toBeNull();
    expect(result.plan.name).toBe('free');
    jest.useRealTimers();
  });

  it('calling GET subscription twice after renewal does not create duplicate transactions', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    const storedSubscription = {
      ...activePremiumSubscription,
      start_date: '2026-04-24T19:55:00.000Z',
      end_date: '2026-04-24T20:00:00.000Z',
    };
    subscriptionsModel.findActiveSubscriptionByUserId.mockImplementation(
      async () => storedSubscription
    );
    subscriptionsModel.updateSubscriptionEndDate.mockImplementation(
      async ({ userSubscriptionId, endDate }) => {
        storedSubscription.end_date = endDate;
        return {
          user_subscription_id: userSubscriptionId,
          status: 'active',
          start_date: storedSubscription.start_date,
          end_date: endDate,
          auto_renew: true,
        };
      }
    );

    await subscriptionsService.getMySubscription({ userId: USER_ID });
    await subscriptionsService.getMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.createPaidRenewalTransaction).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('resetMySubscriptionForTesting expires only the authenticated user subscription and returns effective free state in development', async () => {
    process.env.NODE_ENV = 'development';
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);

    const result = await subscriptionsService.resetMySubscriptionForTesting({
      userId: USER_ID,
      role: 'listener',
    });

    expect(subscriptionsModel.expireCurrentPremiumSubscriptionForTesting).toHaveBeenCalledWith(
      USER_ID
    );
    expect(result).toMatchObject({
      user_subscription_id: null,
      status: 'active',
      auto_renew: false,
      start_date: null,
      end_date: null,
      plan: freePlanResponse,
    });
  });

  it('resetMySubscriptionForTesting is disabled outside development', async () => {
    process.env.NODE_ENV = 'test';

    await expect(
      subscriptionsService.resetMySubscriptionForTesting({
        userId: USER_ID,
        role: 'listener',
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIPTION_TEST_TOOLS_DISABLED',
    });

    expect(subscriptionsModel.expireCurrentPremiumSubscriptionForTesting).not.toHaveBeenCalled();
  });

  it('getEffectiveActivePlanForUser refreshes non-renewing expiry for playlist limit checks', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      auto_renew: false,
      end_date: '2026-04-24T20:00:00.000Z',
    });

    const plan = await subscriptionsService.getEffectiveActivePlanForUser(USER_ID);

    expect(plan).toEqual(freePlan);
    expect(subscriptionsModel.markSubscriptionExpired).toHaveBeenCalledWith(
      USER_SUBSCRIPTION_ID,
      {}
    );
    jest.useRealTimers();
  });

  it('getEffectiveActivePlanForUser rejects when no active subscription or free plan exists', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(null);

    await expect(subscriptionsService.getEffectiveActivePlanForUser(USER_ID)).rejects.toMatchObject(
      {
        statusCode: 404,
        code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
      }
    );
  });

  it('getEffectiveActivePlanForUser keeps auto-renewed premium unlimited for playlist limit checks', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      end_date: '2026-04-24T20:00:00.000Z',
    });

    const plan = await subscriptionsService.getEffectiveActivePlanForUser(USER_ID);

    expect(plan).toMatchObject({
      name: 'premium',
      duration_minutes: 5,
      playlist_limit: null,
    });
    expect(subscriptionsModel.createPaidRenewalTransaction).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
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

  it('assertCanUploadTrack rejects when the free plan is missing', async () => {
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue(null);
    subscriptionsModel.findPlanByName.mockResolvedValue(null);
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(0);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
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

  it('assertCanUploadTrack refreshes expired non-renewing premium users back to free limits', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      auto_renew: false,
      end_date: '2026-04-24T20:00:00.000Z',
    });
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(3);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'SUBSCRIPTION_LIMIT_REACHED',
    });
    expect(subscriptionsModel.markSubscriptionExpired).toHaveBeenCalledWith(
      USER_SUBSCRIPTION_ID,
      {}
    );
    jest.useRealTimers();
  });

  it('assertCanUploadTrack keeps auto-renewed premium users unlimited', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00.000Z'));
    subscriptionsModel.findActiveSubscriptionByUserId.mockResolvedValue({
      ...activePremiumSubscription,
      end_date: '2026-04-24T20:00:00.000Z',
    });
    subscriptionsModel.countUserUploadedTracks.mockResolvedValue(99);

    await expect(subscriptionsService.assertCanUploadTrack(USER_ID)).resolves.toBeUndefined();

    expect(subscriptionsModel.createPaidRenewalTransaction).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
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
      durationMs: 5 * 60 * 1000,
      amount: '4.99',
    });
    expect(result).toEqual({
      transaction_id: TRANSACTION_ID,
      user_subscription_id: USER_SUBSCRIPTION_ID,
      checkout_status: 'pending',
      payment_method: 'mock',
      payment_url: `https://mock-stripe.rythmify.local/checkout/${TRANSACTION_ID}`,
      plan: listenerPremiumPlanResponse,
    });
  });

  it('createCheckout still rejects display-only plan names as invalid plan ids', async () => {
    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: 'go_plus',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'subscription_plan_id must be a valid UUID.',
    });

    await expect(
      subscriptionsService.createCheckout({
        userId: USER_ID,
        subscriptionPlanId: 'artist_pro',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'subscription_plan_id must be a valid UUID.',
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
        start_date: '2026-04-24T20:30:00.000Z',
        end_date: '2026-04-24T20:35:00.000Z',
      },
    });

    const result = await subscriptionsService.mockConfirmPayment({
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
    });

    expect(subscriptionsModel.confirmTransactionPayment).toHaveBeenCalledWith({
      transactionId: TRANSACTION_ID,
      userSubscriptionId: USER_SUBSCRIPTION_ID,
      durationMs: 5 * 60 * 1000,
    });
    expect(result).toEqual({
      transaction_id: TRANSACTION_ID,
      payment_status: 'paid',
      paid_at: '2026-04-24T20:30:00.000Z',
      subscription: {
        user_subscription_id: USER_SUBSCRIPTION_ID,
        status: 'active',
        auto_renew: true,
        start_date: '2026-04-24T20:30:00.000Z',
        end_date: '2026-04-24T20:35:00.000Z',
        plan: listenerPremiumPlanResponse,
      },
    });
  });

  it('mockConfirmPayment sets end_date about 5 minutes after start_date', async () => {
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
        start_date: new Date('2026-04-24T20:30:00.000Z'),
        end_date: new Date('2026-04-24T20:35:00.000Z'),
      },
    });

    const result = await subscriptionsService.mockConfirmPayment({
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
    });

    const start = new Date(result.subscription.start_date).getTime();
    const end = new Date(result.subscription.end_date).getTime();
    expect(end - start).toBe(5 * 60 * 1000);
  });

  it('mockConfirmPayment creates artist pro activated notification for artist premium upgrades', async () => {
    subscriptionsModel.findUserRoleById.mockResolvedValue('artist');
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
        start_date: '2026-04-24T20:30:00.000Z',
        end_date: '2026-04-24T20:35:00.000Z',
      },
    });

    const result = await subscriptionsService.mockConfirmPayment({
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
    });

    expect(notificationModel.createNotification).toHaveBeenCalledWith({
      userId: USER_ID,
      actionUserId: null,
      type: 'artist_pro_activated',
      referenceId: null,
      referenceType: null,
    });
    expect(result.subscription.plan.display_name).toBe('Artist Pro');
  });

  it('mockConfirmPayment logs and continues when artist notification creation fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    subscriptionsModel.findUserRoleById.mockResolvedValue('artist');
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
        start_date: '2026-04-24T20:30:00.000Z',
        end_date: '2026-04-24T20:35:00.000Z',
      },
    });
    notificationModel.createNotification.mockRejectedValue(new Error('notify failed'));

    await expect(
      subscriptionsService.mockConfirmPayment({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
      })
    ).resolves.toMatchObject({
      transaction_id: TRANSACTION_ID,
      payment_status: 'paid',
    });
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Notification] Failed to create artist pro activated notification:',
      'notify failed'
    );
    consoleSpy.mockRestore();
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
      plan_duration_minutes: null,
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
        start_date: new Date('2026-04-24T20:30:00.000Z'),
        end_date: new Date('2026-05-24T20:30:00.000Z'),
      },
    });

    const result = await subscriptionsService.mockConfirmPayment({
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
    });

    expect(subscriptionsModel.confirmTransactionPayment).toHaveBeenCalledWith({
      transactionId: TRANSACTION_ID,
      userSubscriptionId: USER_SUBSCRIPTION_ID,
      durationMs: 30 * 24 * 60 * 60 * 1000,
    });
    expect(result.paid_at).toBe('2026-04-24T20:30:00.000Z');
    expect(result.subscription.start_date).toBe('2026-04-24T20:30:00.000Z');
    expect(result.subscription.end_date).toBe('2026-05-24T20:30:00.000Z');
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
      end_date: '2099-04-24T20:05:00.000Z',
    });

    const result = await subscriptionsService.cancelMySubscription({ userId: USER_ID });

    expect(subscriptionsModel.cancelAutoRenew).toHaveBeenCalledWith(USER_SUBSCRIPTION_ID);
    expect(result).toEqual({
      user_subscription_id: USER_SUBSCRIPTION_ID,
      status: 'active',
      auto_renew: false,
      end_date: '2099-04-24T20:05:00.000Z',
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

  it('buildRenewalSchedule returns no renewals for future or invalid dates', () => {
    expect(
      subscriptionsService.buildRenewalSchedule({
        previousEndDate: '2026-04-24T20:05:00.000Z',
        now: '2026-04-24T20:00:00.000Z',
        durationMs: 5 * 60 * 1000,
      })
    ).toEqual({
      renewalPaidAtDates: [],
      nextEndDate: new Date('2026-04-24T20:05:00.000Z'),
    });

    const invalidResult = subscriptionsService.buildRenewalSchedule({
      previousEndDate: 'not-a-date',
      now: '2026-04-24T20:00:00.000Z',
      durationMs: 5 * 60 * 1000,
    });

    expect(invalidResult.renewalPaidAtDates).toEqual([]);
    expect(Number.isNaN(invalidResult.nextEndDate.getTime())).toBe(true);
  });

  it('buildRenewalSchedule returns no renewals when duration is invalid', () => {
    expect(
      subscriptionsService.buildRenewalSchedule({
        previousEndDate: '2026-04-24T20:00:00.000Z',
        now: '2026-04-24T20:01:00.000Z',
        durationMs: 0,
      })
    ).toEqual({
      renewalPaidAtDates: [],
      nextEndDate: new Date('2026-04-24T20:00:00.000Z'),
    });
  });

  it('buildRenewalSchedule advances past now when max renewals caps catch-up periods', () => {
    const result = subscriptionsService.buildRenewalSchedule({
      previousEndDate: '2026-04-24T20:00:00.000Z',
      now: '2026-04-24T20:10:00.000Z',
      durationMs: 60 * 1000,
      maxRenewals: 2,
    });

    expect(result.renewalPaidAtDates.map((date) => date.toISOString())).toEqual([
      '2026-04-24T20:01:00.000Z',
      '2026-04-24T20:02:00.000Z',
    ]);
    expect(result.nextEndDate.toISOString()).toBe('2026-04-24T20:11:00.000Z');
  });

  it('getPlanDurationMs supports day-based plan durations', () => {
    expect(
      subscriptionsService.getPlanDurationMs({
        duration_minutes: null,
        duration_days: 2,
      })
    ).toBe(2 * 24 * 60 * 60 * 1000);
  });
});
