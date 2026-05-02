jest.mock('../../../src/models/user.model');
const express = require('express');
const request = require('supertest');

const USER_ID = '11111111-1111-1111-1111-111111111111';

const loadSubscriptionsRouter = ({ nodeEnv }) => {
  jest.resetModules();
  process.env.NODE_ENV = nodeEnv;

  const resetMySubscriptionForTesting = jest.fn((req, res) =>
    res.status(200).json({
      data: {
        user_subscription_id: null,
        status: 'active',
        auto_renew: false,
      },
      message: 'Subscription reset for development testing successfully.',
    })
  );

  jest.doMock('../../../src/middleware/auth', () => ({
    authenticate: (req, res, next) => {
      req.user = { sub: USER_ID, role: 'listener' };
      next();
    },
    optionalAuthenticate: (req, res, next) => next(),
  }));

  jest.doMock('../../../src/controllers/subscriptions.controller', () => ({
    listPlans: jest.fn((req, res) => res.status(200).json({ data: { items: [] } })),
    getMySubscription: jest.fn(),
    createCheckout: jest.fn(),
    mockConfirmPayment: jest.fn(),
    cancelMySubscription: jest.fn(),
    listMyTransactions: jest.fn(),
    resetMySubscriptionForTesting,
  }));

  const router = require('../../../src/routes/subscriptions.routes');
  const app = express();
  app.use(express.json());
  app.use('/subscriptions', router);

  return { app, resetMySubscriptionForTesting };
};

describe('development subscription reset route registration', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    jest.dontMock('../../../src/middleware/auth');
    jest.dontMock('../../../src/controllers/subscriptions.controller');
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('registers POST /subscriptions/me/dev-reset in development', async () => {
    const { app, resetMySubscriptionForTesting } = loadSubscriptionsRouter({
      nodeEnv: 'development',
    });

    const response = await request(app).post('/subscriptions/me/dev-reset');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        user_subscription_id: null,
        status: 'active',
        auto_renew: false,
      },
      message: 'Subscription reset for development testing successfully.',
    });
    expect(resetMySubscriptionForTesting).toHaveBeenCalledTimes(1);
  });

  it('does not register POST /subscriptions/me/dev-reset outside development', async () => {
    const { app, resetMySubscriptionForTesting } = loadSubscriptionsRouter({ nodeEnv: 'test' });

    const response = await request(app).post('/subscriptions/me/dev-reset');

    expect(response.status).toBe(404);
    expect(resetMySubscriptionForTesting).not.toHaveBeenCalled();
  });
});

